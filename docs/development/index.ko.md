# 개발 가이드

minecraft-docker 프로젝트의 개발 환경 설정, 프로젝트 구조, 기여 가이드라인을 안내합니다.

## 사전 요구 사항

기여하기 전에 다음 도구가 설치되어 있어야 합니다:

- **Node.js** >= 18.0.0
- **pnpm** >= 8.0.0
- **Docker Engine** 20.10+
- **Docker Compose** v2.0+
- **Git** 버전 관리용

## 빠른 설정

```bash
# 저장소 클론
git clone https://github.com/smallmiro/minecraft-server-manager.git
cd minecraft-server-manager

# 의존성 설치
pnpm install

# 모든 패키지 빌드
pnpm build

# 개발용으로 CLI 전역 링크
cd platform/services/cli
pnpm link --global

# 설치 확인
mcctl --version
```

## 프로젝트 구조

이 프로젝트는 **pnpm 모노레포** 구조를 사용합니다.

### 모노레포 패키지

| 패키지 | 이름 | 설명 |
|--------|------|------|
| `platform/services/shared` | `@minecraft-docker/shared` | 공유 타입, 도메인 모델, 유틸리티 |
| `platform/services/mod-source-modrinth` | `@minecraft-docker/mod-source-modrinth` | Modrinth 모드 소스 어댑터 |
| `platform/services/cli` | `@minecraft-docker/mcctl` | CLI 도구 (주요 사용자용 패키지) |
| `platform/services/mcctl-api` | `@minecraft-docker/mcctl-api` | REST API 서비스 |
| `platform/services/mcctl-console` | `@minecraft-docker/mcctl-console` | 웹 콘솔 UI |

### 빌드 순서

pnpm은 의존성 순서에 따라 자동으로 패키지를 빌드합니다:

```text
1. @minecraft-docker/shared        (의존성 없음)
2. @minecraft-docker/mod-source-modrinth  (shared에 의존)
3. @minecraft-docker/mcctl         (shared, mod-source-modrinth에 의존)
4. @minecraft-docker/mcctl-api     (shared에 의존)
5. @minecraft-docker/mcctl-console (shared에 의존)
```

### 디렉토리 레이아웃

```text
minecraft/
|-- package.json              # 루트 워크스페이스
|-- pnpm-workspace.yaml       # pnpm 워크스페이스 설정
|-- tsconfig.base.json        # 공유 TypeScript 설정
|
|-- platform/
|   |-- docker-compose.yml    # 메인 오케스트레이션
|   |-- .env                  # 환경 설정
|   |
|   |-- services/
|   |   |-- shared/           # @minecraft-docker/shared
|   |   |-- mod-source-modrinth/  # @minecraft-docker/mod-source-modrinth
|   |   |-- cli/              # @minecraft-docker/mcctl
|   |   |-- mcctl-api/        # REST API
|   |   +-- mcctl-console/    # 웹 UI
|   |
|   +-- scripts/              # Bash 관리 스크립트
|
|-- docs/                     # MkDocs 문서
|-- e2e/                      # E2E 테스트
+-- templates/                # npm 패키지 템플릿
```

## 사용 가능한 스크립트

### 루트 레벨

| 명령어 | 설명 |
|--------|------|
| `pnpm install` | 모든 의존성 설치 |
| `pnpm build` | 모든 패키지 빌드 (의존성 순서 준수) |
| `pnpm clean` | 모든 빌드 출력 정리 |
| `pnpm test` | 모든 테스트 실행 |
| `pnpm test:e2e` | E2E 테스트 실행 |

### 패키지 레벨

각 패키지 디렉토리에서 다음을 실행할 수 있습니다:

| 명령어 | 설명 |
|--------|------|
| `pnpm build` | 이 패키지 빌드 |
| `pnpm dev` | 감시 모드 (변경 시 재빌드) |
| `pnpm test` | 패키지 테스트 실행 |
| `pnpm clean` | 빌드 출력 정리 |

## 개발 워크플로우

### 1. 기능 브랜치 생성

```bash
git checkout develop
git pull origin develop
git checkout -b feature/123-my-feature
```

### 2. 변경 사항 구현

TDD (테스트 주도 개발) 워크플로우를 따르세요:

1. **Red**: 실패하는 테스트 작성
2. **Green**: 테스트를 통과하는 최소한의 코드 작성
3. **Refactor**: 테스트가 통과하는 상태에서 코드 정리

### 3. 빌드 및 테스트

```bash
# 모든 패키지 빌드
pnpm build

# 테스트 실행
pnpm test

# E2E 테스트 실행 (Docker 필요)
pnpm test:e2e
```

### 4. 변경 사항 커밋

컨벤셔널 커밋 메시지를 사용하세요:

```bash
git commit -m "feat(cli): add new mod command (#123)"
git commit -m "fix(api): correct auth token validation"
git commit -m "docs: update installation guide"
```

### 5. Pull Request 생성

```bash
git push origin feature/123-my-feature
```

그런 다음 GitHub에서 `develop` 브랜치로 PR을 생성합니다.

## 아키텍처 개요

이 프로젝트는 **Hexagonal Architecture** (포트 & 어댑터)와 **Clean Architecture** 원칙을 따릅니다:

```text
+-------------------+
|    CLI Layer      |  명령어, 인자 파싱
+--------+----------+
         |
+--------v----------+
| Application Layer |  유스케이스, 비즈니스 로직
+--------+----------+
         |
+--------v----------+
|   Domain Layer    |  엔티티, 값 객체
+--------+----------+
         |
+--------v----------+
| Infrastructure    |  어댑터, 외부 서비스
+-------------------+
```

### 핵심 개념

- **Value Objects**: 생성 시 유효성 검사되는 불변 객체 (예: `ServerName.create("myserver")`)
- **Use Cases**: 인터랙티브 및 CLI 모드를 지원하는 비즈니스 로직
- **Ports**: 외부 의존성을 위한 인터페이스
- **Adapters**: 구체적인 구현체

자세한 내용은 [CLI 아키텍처](cli-architecture.md)를 참조하세요.

## 관련 문서

- [CLI 아키텍처](cli-architecture.md) - CLI의 상세 아키텍처
- [에이전트 협업](agent-collaboration.md) - 멀티 에이전트 개발 워크플로우
- [CLI 명령어](../cli/commands.md) - 전체 CLI 레퍼런스

## 문제 해결

### 빌드 오류

빌드 오류가 발생하면:

```bash
# 정리 후 재빌드
pnpm clean
pnpm install
pnpm build
```

### 링크 문제

링크 후 `mcctl` 명령어를 찾을 수 없는 경우:

```bash
# npm 전역 bin 경로 확인
npm config get prefix

# 필요시 PATH에 추가
export PATH="$PATH:$(npm config get prefix)/bin"
```

### Docker 문제

Docker가 실행 중이고 사용자에게 권한이 있는지 확인하세요:

```bash
# Docker 상태 확인
docker --version
docker compose version

# 권한 거부 시 사용자를 docker 그룹에 추가
sudo usermod -aG docker $USER
newgrp docker
```
