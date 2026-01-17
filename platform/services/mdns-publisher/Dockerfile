FROM python:3.12-slim

LABEL maintainer="Minecraft Server Manager"
LABEL description="mDNS Publisher for automatic hostname discovery"

WORKDIR /app

# Install curl for health check
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY mdns_publisher.py .

# Environment variables
ENV LOG_LEVEL=INFO
ENV HEALTH_PORT=5353
ENV PYTHONUNBUFFERED=1

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:${HEALTH_PORT}/health || exit 1

# Run the application
CMD ["python", "mdns_publisher.py"]
