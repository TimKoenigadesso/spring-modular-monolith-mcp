# ── Stage 1: Build ────────────────────────────────────────────────────────────
FROM eclipse-temurin:25-jdk AS build
WORKDIR /workspace

# Maven Wrapper + pom.xml zuerst (Layer-Cache für Dependencies)
COPY .mvn .mvn
COPY mvnw pom.xml ./
RUN chmod +x mvnw && \
    ./mvnw dependency:go-offline -q 2>/dev/null || true

# Quellcode kopieren und bauen
COPY src src
RUN ./mvnw package -DskipTests \
    -Dspotless.check.skip=true \
    -Dspotless.apply.skip=true \
    -Dnullaway.enabled=false \
    -Dcheckstyle.skip=true \
    -q

# ── Stage 2: Runtime ──────────────────────────────────────────────────────────
FROM eclipse-temurin:25-jre
WORKDIR /app

COPY --from=build /workspace/target/*.jar app.jar

# Spring Profile cloud-run aktivieren
ENV SPRING_PROFILES_ACTIVE=cloud-run
ENV PORT=8080

EXPOSE 8080

ENTRYPOINT ["java", \
  "-XX:+UseContainerSupport", \
  "-XX:MaxRAMPercentage=75", \
  "-Dotel.sdk.disabled=true", \
  "-jar", "app.jar"]
