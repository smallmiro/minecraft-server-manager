# syntax=docker/dockerfile:1
# =============================================================================
# BlueMap CLI renderer
# =============================================================================
# Offline world-map renderer used by scripts/render-map.sh. BlueMap runs as a
# standalone CLI (no Minecraft server required), so it is safe to use alongside
# mc-router auto-scaling.
#
# BlueMap 5.x ships as a Java 25 build (class-file major version 69), so the
# base image MUST be a Java 25 runtime. Earlier JREs fail with
# UnsupportedClassVersionError.
#
# The image is built on demand by render-map.sh (idempotent). Run it as the
# host user so generated files stay owned by the caller:
#   docker run --rm --user "$(id -u):$(id -g)" mcctl-bluemap:<ver> -c /work/config -r -g
# =============================================================================
FROM eclipse-temurin:25-jre

# Pinned BlueMap CLI release. Bump both values together; verify the checksum
# against the GitHub release asset before changing.
ARG BLUEMAP_VERSION=5.22
ARG BLUEMAP_SHA256=a2289d649f6a83e04cf222abcd3d4f2df4e32e61147015f921c05066f63eefb7

ADD "https://github.com/BlueMap-Minecraft/BlueMap/releases/download/v${BLUEMAP_VERSION}/bluemap-${BLUEMAP_VERSION}-cli.jar" \
    /opt/bluemap/bluemap-cli.jar
# Make the dir traversable and the jar world-readable so the image can run as a
# non-root host user (--user $(id -u):$(id -g)).
RUN echo "${BLUEMAP_SHA256}  /opt/bluemap/bluemap-cli.jar" | sha256sum -c - \
    && chmod 755 /opt/bluemap \
    && chmod 644 /opt/bluemap/bluemap-cli.jar

WORKDIR /work
ENTRYPOINT ["java", "-jar", "/opt/bluemap/bluemap-cli.jar"]
