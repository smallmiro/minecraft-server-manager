#!/usr/bin/env python3
"""
mDNS Publisher for Minecraft Server Manager

Monitors Docker container events and broadcasts mDNS (Bonjour/Zeroconf) A records
for containers with 'mc-router.host' labels, enabling automatic hostname discovery.
"""

import logging
import os
import signal
import socket
import sys
import threading
import time
from typing import Dict, Optional

import docker
from flask import Flask, jsonify
from zeroconf import IPVersion, ServiceInfo, Zeroconf

# Configuration
LOG_LEVEL = os.environ.get("LOG_LEVEL", "INFO").upper()
HEALTH_PORT = int(os.environ.get("HEALTH_PORT", "5353"))
LABEL_HOST = "mc-router.host"

# Setup logging
logging.basicConfig(
    level=getattr(logging, LOG_LEVEL, logging.INFO),
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)

# Flask app for health endpoint
app = Flask(__name__)

# Global state
registered_services: Dict[str, ServiceInfo] = {}
zeroconf: Optional[Zeroconf] = None
docker_client: Optional[docker.DockerClient] = None
shutdown_event = threading.Event()


def get_host_ip() -> str:
    """Get the primary IP address of the host."""
    try:
        # Create a socket to determine the primary IP
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception as e:
        logger.warning(f"Failed to get host IP via socket: {e}")
        # Fallback to hostname resolution
        return socket.gethostbyname(socket.gethostname())


def hostname_to_mdns_name(hostname: str) -> str:
    """Convert hostname to mDNS service name (remove .local suffix)."""
    if hostname.endswith(".local"):
        return hostname[:-6]  # Remove ".local"
    return hostname


def register_mdns(hostname: str, ip: str) -> bool:
    """Register an mDNS A record for the given hostname."""
    global zeroconf, registered_services

    if not zeroconf:
        logger.error("Zeroconf not initialized")
        return False

    if hostname in registered_services:
        logger.warning(f"Hostname {hostname} already registered, skipping")
        return False

    try:
        # Create service info for A record
        # Using _http._tcp as a workaround since zeroconf primarily handles services
        # For pure A records, we register a dummy service that resolves to our IP
        name = hostname_to_mdns_name(hostname)

        service_info = ServiceInfo(
            type_="_minecraft._tcp.local.",
            name=f"{name}._minecraft._tcp.local.",
            addresses=[socket.inet_aton(ip)],
            port=25565,
            properties={"server": name},
            server=hostname if hostname.endswith(".local") else f"{hostname}.local.",
        )

        zeroconf.register_service(service_info)
        registered_services[hostname] = service_info
        logger.info(f"Registered mDNS: {hostname} -> {ip}")
        return True

    except Exception as e:
        logger.error(f"Failed to register mDNS for {hostname}: {e}")
        return False


def unregister_mdns(hostname: str) -> bool:
    """Unregister an mDNS A record."""
    global zeroconf, registered_services

    if not zeroconf:
        logger.error("Zeroconf not initialized")
        return False

    if hostname not in registered_services:
        logger.warning(f"Hostname {hostname} not registered, skipping")
        return False

    try:
        service_info = registered_services.pop(hostname)
        zeroconf.unregister_service(service_info)
        logger.info(f"Unregistered mDNS: {hostname}")
        return True

    except Exception as e:
        logger.error(f"Failed to unregister mDNS for {hostname}: {e}")
        return False


def scan_existing_containers(client: docker.DockerClient, host_ip: str) -> None:
    """Scan and register existing containers with mc-router.host labels."""
    try:
        containers = client.containers.list()
        for container in containers:
            hostname = container.labels.get(LABEL_HOST)
            if hostname:
                logger.info(f"Found existing container {container.name} with hostname {hostname}")
                register_mdns(hostname, host_ip)
    except Exception as e:
        logger.error(f"Failed to scan existing containers: {e}")


def handle_container_event(event: dict, host_ip: str) -> None:
    """Handle Docker container start/die events."""
    global docker_client

    if not docker_client:
        return

    action = event.get("Action")
    container_id = event.get("id")

    if action not in ("start", "die"):
        return

    try:
        if action == "start":
            container = docker_client.containers.get(container_id)
            hostname = container.labels.get(LABEL_HOST)
            if hostname:
                logger.info(f"Container {container.name} started with hostname {hostname}")
                register_mdns(hostname, host_ip)

        elif action == "die":
            # Container is gone, so we need to get hostname from event attributes
            attrs = event.get("Actor", {}).get("Attributes", {})
            hostname = attrs.get(LABEL_HOST)
            if hostname:
                logger.info(f"Container died with hostname {hostname}")
                unregister_mdns(hostname)

    except docker.errors.NotFound:
        logger.debug(f"Container {container_id} not found (probably already removed)")
    except Exception as e:
        logger.error(f"Error handling container event: {e}")


def docker_event_listener(host_ip: str) -> None:
    """Listen for Docker container events."""
    global docker_client, shutdown_event

    while not shutdown_event.is_set():
        try:
            if not docker_client:
                docker_client = docker.from_env()
                logger.info("Connected to Docker daemon")

                # Scan existing containers on (re)connect
                scan_existing_containers(docker_client, host_ip)

            # Listen for events with timeout
            events = docker_client.events(
                decode=True,
                filters={"type": "container", "event": ["start", "die"]},
            )

            for event in events:
                if shutdown_event.is_set():
                    break
                handle_container_event(event, host_ip)

        except docker.errors.APIError as e:
            logger.error(f"Docker API error: {e}")
            docker_client = None
            time.sleep(5)
        except Exception as e:
            logger.error(f"Docker event listener error: {e}")
            docker_client = None
            time.sleep(5)


def cleanup() -> None:
    """Cleanup all registered services and close zeroconf."""
    global zeroconf, registered_services

    logger.info("Cleaning up...")

    # Unregister all services
    for hostname in list(registered_services.keys()):
        unregister_mdns(hostname)

    # Close zeroconf
    if zeroconf:
        zeroconf.close()
        zeroconf = None

    logger.info("Cleanup complete")


def signal_handler(signum, frame):
    """Handle shutdown signals."""
    logger.info(f"Received signal {signum}, shutting down...")
    shutdown_event.set()
    cleanup()
    sys.exit(0)


# Health check endpoints
@app.route("/health")
def health():
    """Health check endpoint."""
    return jsonify({
        "status": "healthy",
        "registered_hostnames": list(registered_services.keys()),
        "count": len(registered_services),
    })


@app.route("/")
def index():
    """Root endpoint with service info."""
    return jsonify({
        "service": "mdns-publisher",
        "version": "1.0.0",
        "endpoints": {
            "/health": "Health check",
            "/": "This page",
        },
    })


def run_health_server():
    """Run the Flask health check server."""
    app.run(host="0.0.0.0", port=HEALTH_PORT, threaded=True)


def main():
    """Main entry point."""
    global zeroconf

    logger.info("Starting mDNS Publisher")

    # Setup signal handlers
    signal.signal(signal.SIGTERM, signal_handler)
    signal.signal(signal.SIGINT, signal_handler)

    # Get host IP
    host_ip = get_host_ip()
    logger.info(f"Host IP: {host_ip}")

    # Initialize Zeroconf
    try:
        zeroconf = Zeroconf(ip_version=IPVersion.V4Only)
        logger.info("Zeroconf initialized")
    except Exception as e:
        logger.error(f"Failed to initialize Zeroconf: {e}")
        sys.exit(1)

    # Start health check server in background thread
    health_thread = threading.Thread(target=run_health_server, daemon=True)
    health_thread.start()
    logger.info(f"Health server started on port {HEALTH_PORT}")

    # Start Docker event listener (blocking)
    try:
        docker_event_listener(host_ip)
    except KeyboardInterrupt:
        pass
    finally:
        cleanup()


if __name__ == "__main__":
    main()
