# Minecraft Docker Server Manager

Docker를 사용하여 여러 Minecraft Java Edition 서버를 관리하는 DevOps 솔루션입니다.

## 주요 기능

- **멀티 서버 관리**: 단일 호스트에서 여러 Minecraft 서버 실행
- **호스트네임 기반 라우팅**: mc-router를 통해 `server.local:25565`로 접속
- **nip.io 매직 DNS**: `server.<ip>.nip.io`로 클라이언트 설정 없이 접속
- **오토 스케일링**: 접속 시 서버 시작, 유휴 시간 후 자동 종료
- **대화형 CLI**: @clack/prompts 기반의 아름다운 터미널 UI
- **월드 관리**: 서버 간 월드 할당, 잠금, 해제

## 빠른 시작

```bash
# CLI 전역 설치
npm install -g @minecraft-docker/mcctl

# 플랫폼 초기화
mcctl init

# 서버 생성 (대화형 모드)
mcctl create
```

## 아키텍처

```text
┌──────────────────────┐
│  mc-router (:25565)  │
│  호스트네임 라우팅     │
├──────────────────────┤
│ server1.local ─→     │
│  mc-server1          │
│ server2.local ─→     │
│  mc-server2          │
└──────────────────────┘
```

## 문서

- [설치](getting-started/installation.md) - 플랫폼 설정
- [빠른 시작](getting-started/quickstart.md) - 첫 서버 만들기
- [CLI 명령어](cli/commands.md) - 전체 명령어 참조
- [설정](configuration/environment.md) - 환경 변수

## 링크

- [GitHub 저장소](https://github.com/smallmiro/minecraft-server-manager)
- [itzg/minecraft-server 문서](https://docker-minecraft-server.readthedocs.io/)
