# Java 버전

마인크래프트 버전별 Java 요구사항과 이미지 태그 선택 가이드입니다.

## 지원하는 Java 버전

| 이미지 태그 | Java 버전 | 기반 OS | 아키텍처 | 비고 |
|-----------|-----------|---------|---------|------|
| `latest`, `stable` | Java 25 | Ubuntu | amd64, arm64 | 기본값; `stable`은 최신 릴리즈 버전 |
| `java25` | Java 25 | Ubuntu | amd64, arm64 | |
| `java25-alpine` | Java 25 | Alpine | amd64, arm64 | |
| `java25-jdk` | Java 25 | Ubuntu+JDK | amd64, arm64 | 전체 JDK 포함 |
| `java21` | Java 21 | Ubuntu | amd64, arm64 | |
| `java21-jdk` | Java 21 | Ubuntu+JDK | amd64, arm64 | 전체 JDK 포함 |
| `java21-alpine` | Java 21 | Alpine | amd64, arm64 | |
| `java17` | Java 17 | Ubuntu | amd64, arm64, armv7 | |
| `java16` | Java 16 | Ubuntu | amd64, arm64, armv7 | |
| `java11` | Java 11 | Ubuntu | amd64, arm64, armv7 | 레거시 |
| `java8` | Java 8 | Ubuntu | amd64, arm64, armv7 | Forge 1.17 이하 |

!!! info "`stable` 태그"
    `stable` 태그는 항상 가장 최신 **릴리즈** 버전의 이미지를 가리킵니다.
    사전 릴리즈 빌드를 포함할 수 있는 `latest`와 달리, `stable`은 안정적인
    프로덕션용 이미지를 제공합니다.

### 지원 중단된 태그

!!! warning "지원 중단된 태그"
    다음 태그들은 **지원 중단(deprecated)** 되었으며 새로운 배포에서 사용하지 마십시오:

    - `java23`, `java23-alpine`, `java23-jdk` -- 대신 `java25`를 사용하세요
    - `java24`, `java24-graalvm` -- 대신 `java25`를 사용하세요
    - `java17-alpine` -- 대신 `java17` 또는 `java21-alpine`을 사용하세요
    - `java25-graalvm`, `java21-graalvm`, `java17-graalvm` -- **모든 GraalVM 태그가 지원 중단됨** (아래 참조)

### 프로그래밍 방식 접근

지원되는 이미지 태그의 전체 목록과 메타데이터를 JSON으로 확인할 수 있습니다:

```
https://raw.githubusercontent.com/itzg/docker-minecraft-server/refs/heads/master/images.json
```

## 버전별 Java 요구사항

| 마인크래프트 버전 | 최소 Java | 권장 Java |
|-----------------|----------|----------|
| 1.21+ | Java 21 | Java 21 또는 25 |
| 1.20.5 - 1.20.6 | Java 21 | Java 21 |
| 1.18 - 1.20.4 | Java 17 | Java 17/21 |
| 1.17 | Java 16 | Java 17 |
| 1.12 - 1.16.5 | Java 8 | Java 8/11 |
| 1.11 이하 | Java 8 | Java 8 |

## Java 버전 선택 방법

### Docker CLI

```bash
docker run -d -e EULA=TRUE itzg/minecraft-server:java21
```

### Docker Compose

```yaml
services:
  mc:
    image: itzg/minecraft-server:java21
    environment:
      EULA: "TRUE"
      VERSION: "1.20.4"
```

## Forge 서버 Java 버전

Forge는 특정 Java 버전이 필요합니다:

| Forge/마인크래프트 버전 | 필요 Java |
|----------------------|----------|
| Forge 1.20.5+ | Java 21 |
| Forge 1.18 - 1.20.4 | Java 17 |
| Forge 1.17.x | Java 16/17 |
| **Forge 1.16.5 이하** | **Java 8 필수** |

### Forge 1.16.5 예제

```yaml
services:
  mc:
    image: itzg/minecraft-server:java8
    environment:
      EULA: "TRUE"
      TYPE: "FORGE"
      VERSION: "1.16.5"
```

### Forge 1.20.1 예제

```yaml
services:
  mc:
    image: itzg/minecraft-server:java17
    environment:
      EULA: "TRUE"
      TYPE: "FORGE"
      VERSION: "1.20.1"
```

## 흔한 오류와 해결법

### "class file version 65.0" 오류

Java 21 이상이 필요합니다:

```yaml
image: itzg/minecraft-server:java21
```

### "Unsupported class file major version" 오류

Java 버전이 너무 높습니다. 낮은 버전을 사용하세요:

```yaml
# Forge 1.16.5의 경우
image: itzg/minecraft-server:java8
```

### 모드 호환성 문제

일부 모드는 특정 Java 버전이 필요합니다. 모드 문서를 확인하세요.

## 아키텍처별 태그

다양한 CPU 아키텍처를 지원합니다:

| 태그 | Java | Linux | 아키텍처 |
|-----|------|-------|---------|
| `latest`, `stable` | 25 | Ubuntu | amd64, arm64 |
| `java25` | 25 | Ubuntu | amd64, arm64 |
| `java25-alpine` | 25 | Alpine | amd64, arm64 |
| `java25-jdk` | 25 | Ubuntu+JDK | amd64, arm64 |
| `java21` | 21 | Ubuntu | amd64, arm64 |
| `java21-jdk` | 21 | Ubuntu+JDK | amd64, arm64 |
| `java21-alpine` | 21 | Alpine | amd64, arm64 |
| `java17` | 17 | Ubuntu | amd64, arm64, armv7 |
| `java16` | 16 | Ubuntu | amd64, arm64, armv7 |
| `java11` | 11 | Ubuntu | amd64, arm64, armv7 |
| `java8` | 8 | Ubuntu | amd64, arm64, armv7 |

### ARM 장치 (Raspberry Pi 등)

```yaml
image: itzg/minecraft-server:java17
# java17은 armv7 지원 (Raspberry Pi 3/4 32비트)
# java21+는 arm64만 지원 (Raspberry Pi 4/5 64비트)
```

## GraalVM 변형 (지원 중단)

!!! danger "모든 GraalVM 태그 지원 중단"
    GraalVM 이미지 변형(`java25-graalvm`, `java21-graalvm`, `java17-graalvm`)은
    **모두 지원 중단(deprecated)** 되었으며 향후 릴리즈에서 제거될 예정입니다.

    **마이그레이션**: 표준 OpenJDK 기반 태그(`java25`, `java21`, `java17`)로 전환하세요.

    이전에 GraalVM 이미지는 Auto-Pause(`ENABLE_AUTOPAUSE`) 기능과도 호환되지 않았습니다.

## 버전 선택 가이드

```
Minecraft 1.21+ --> java21 또는 latest (Java 25)
Minecraft 1.18-1.20.4 --> java17 또는 java21
Forge 1.16.5 이하 --> java8 (필수)
모드팩 --> 모드팩 요구사항 확인
```

!!! tip "잘 모르겠다면"
    Minecraft 1.20.5 이상에는 `java21`을 사용하세요. `latest`/`stable` 태그는 이제
    Java 25를 사용하며, 모든 최신 마인크래프트 버전에서 동작합니다.

## 예제: 버전별 구성

### 최신 Paper 서버

```yaml
services:
  mc:
    image: itzg/minecraft-server:java21
    environment:
      EULA: "TRUE"
      TYPE: "PAPER"
      VERSION: "LATEST"
```

### 레거시 Forge 모드팩

```yaml
services:
  mc:
    image: itzg/minecraft-server:java8
    environment:
      EULA: "TRUE"
      TYPE: "FORGE"
      VERSION: "1.12.2"
      FORGE_VERSION: "14.23.5.2860"
```

### Fabric 1.20.4

```yaml
services:
  mc:
    image: itzg/minecraft-server:java17
    environment:
      EULA: "TRUE"
      TYPE: "FABRIC"
      VERSION: "1.20.4"
```
