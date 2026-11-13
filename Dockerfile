# syntax=docker/dockerfile:1
# Raftaar: one image — the React frontend served by the Spring Boot backend, with the Apprise CLI inside for
# notifications.

# The frontend bundle and the backend jar are the same on every CPU, so both are built once on the build machine's
# own platform ($BUILDPLATFORM), at full speed. Only the small runtime stage is assembled per target platform.

# ---- 1. frontend ------------------------------------------------------------------------------------------
FROM --platform=$BUILDPLATFORM node:22-alpine AS web
WORKDIR /web
COPY frontend/package.json frontend/package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

# ---- 2. backend -------------------------------------------------------------------------------------------
FROM --platform=$BUILDPLATFORM eclipse-temurin:25-jdk AS api
WORKDIR /api
# Dependencies first so they're cached between builds.
COPY backend/mvnw backend/pom.xml ./
COPY backend/.mvn .mvn
RUN --mount=type=cache,target=/root/.m2 chmod +x mvnw && ./mvnw -q -B dependency:go-offline
COPY backend/src src
RUN --mount=type=cache,target=/root/.m2 ./mvnw -q -B -DskipTests package && cp target/*.jar /api/app.jar

# ---- 3. runtime -------------------------------------------------------------------------------------------
FROM eclipse-temurin:25-jre
# curl: health check. python3 + Apprise (in its own virtualenv): notifications. Bump APPRISE_VERSION to update it.
ARG APPRISE_VERSION=2.1.0
RUN apt-get update && apt-get install -y --no-install-recommends curl python3 python3-venv \
    && python3 -m venv /opt/apprise \
    && /opt/apprise/bin/pip install --no-cache-dir "apprise==${APPRISE_VERSION}" \
    && /opt/apprise/bin/apprise --version \
    && apt-get purge -y --auto-remove python3-venv && rm -rf /var/lib/apt/lists/* /root/.cache \
    && useradd --system --uid 10001 --user-group --home /app raftaar \
    && mkdir -p /app/static /data && chown -R raftaar:raftaar /app /data
WORKDIR /app
COPY --from=api /api/app.jar /app/app.jar
COPY --from=web /web/dist /app/static
COPY docker/entrypoint.sh /app/entrypoint.sh
RUN chmod 755 /app/entrypoint.sh

ARG VERSION=dev
ENV PORT=8080 \
    APP_STATIC_DIR=/app/static \
    STORAGE_DIR=/data \
    APPRISE_BIN=/opt/apprise/bin/apprise \
    APP_VERSION=${VERSION} \
    JAVA_OPTS="-XX:MaxRAMPercentage=75"
LABEL org.opencontainers.image.title="Raftaar" \
      org.opencontainers.image.description="Self-hosted vehicle log: fuel and mileage, services and reminders, papers." \
      org.opencontainers.image.version="${VERSION}"
VOLUME ["/data"]
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 CMD curl -fsS http://localhost:${PORT}/api/health || exit 1
# The entrypoint fixes folder ownership as root, then runs the app as PUID/PGID (default: the "raftaar" user).
ENTRYPOINT ["/app/entrypoint.sh"]
