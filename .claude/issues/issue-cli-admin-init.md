# feat: mcctl admin init 명령어 구현

## 개요

Admin 서비스의 초기 설정을 대화형으로 진행하는 `mcctl admin init` 명령어를 구현합니다.

## 관련 문서

- [plan.md - Phase 8.2](../../../plan.md#phase-8-admin-service-web-관리-콘솔)
- [prd.md - Section 10.6](../../../prd.md#106-cli-명령어)

## 구현 목록

### 대화형 초기화 플로우

```
$ mcctl admin init

┌  Admin Service 초기화
│
◆  API 접근 모드를 선택하세요:
│  ● internal (기본값, mcctl-console 전용)
│  ○ api-key (외부 도구 연동)
│  ○ ip-whitelist (신뢰된 네트워크)
│  ○ api-key-ip (최고 보안)
│  ○ open (개발 전용)
│
◆  관리자 계정을 생성합니다.
│  Username: admin
│  Password: ••••••••
│  Confirm: ••••••••
│
◇  설정 파일 생성 중...
│
└  ✓ Admin 서비스가 초기화되었습니다!
   mcctl admin start 로 서비스를 시작하세요.
```

### 기능 구현

- [ ] `commands/admin/index.ts` - admin 명령어 라우터
- [ ] `commands/admin/init.ts` - init 명령어
- [ ] `lib/admin-config.ts` - 설정 파일 관리
- [ ] `lib/admin-compose.ts` - Docker Compose 동적 생성

### 생성되는 파일

- [ ] `~/.minecraft-servers/.mcctl-admin.yml` - Admin 설정
- [ ] `~/.minecraft-servers/docker-compose.mcctl-admin.yml` - Docker Compose

### 설정 항목

- [ ] API 접근 모드 선택
- [ ] API 키 자동 생성 (mctk_xxxxxx 형식)
- [ ] IP 화이트리스트 설정 (해당 모드일 경우)
- [ ] 관리자 계정 생성
- [ ] 세션 시크릿 자동 생성
- [ ] 저장소 타입 선택 (yaml/sqlite)

## 테스트

- [ ] 대화형 초기화 플로우 테스트
- [ ] 설정 파일 생성 검증
- [ ] Docker Compose 파일 유효성 검증

## 완료 기준

- [ ] 대화형 초기화 정상 동작
- [ ] 설정 파일 올바르게 생성
- [ ] 기존 설정 있을 시 덮어쓰기 확인

## Labels

- `phase:8-admin`
- `type:feature`
- `package:cli`
