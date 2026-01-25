# Issue: mcctl admin init 명령어

## Phase
8.2.1 - CLI Admin 명령어

## 제목
feat(cli): Add `mcctl admin init` command for Admin Service initialization

## 설명
Admin Service 초기 설정을 위한 대화형 `mcctl admin init` 명령어를 구현합니다.

## 선행 작업
- #8.1.1 IUserRepository 포트 정의
- #8.1.2 YamlUserRepository 어댑터 구현

## 작업 내용
- [ ] `src/commands/admin/index.ts` - 메인 라우터
- [ ] `src/commands/admin/init.ts` - 초기화 명령어
- [ ] `.mcctl-admin.yml` 설정 파일 생성
- [ ] 관리자 계정 생성 프롬프트
- [ ] API 접근 모드 선택
- [ ] API 키 자동 생성
- [ ] `src/lib/admin-config.ts` - 설정 관리
- [ ] index.ts에 admin 라우팅 추가
- [ ] 테스트

## 대화형 플로우

```
$ mcctl admin init

┌  Initialize Admin Service
│
◆  Admin username?
│  admin
│
◆  Admin password?
│  ••••••••
│
◆  API access mode?
│  ● internal (Docker network only, default)
│  ○ api-key (External access with API key)
│  ○ ip-whitelist (IP-based access)
│  ○ api-key-ip (Both API key and IP)
│  ○ open (No authentication, development only)
│
◇  Generating API key...
│
└  ✓ Admin Service initialized!
   Config: ~/.minecraft-servers/.mcctl-admin.yml
   Console: http://localhost:3000
```

## 생성되는 설정 파일

```yaml
# ~/.minecraft-servers/.mcctl-admin.yml
version: "1.0"

api:
  access_mode: internal
  port: 3001
  api_key:
    key: "mctk_xxxxxxxxxxxxx"
    header: "X-API-Key"

console:
  port: 3000
  session:
    secret: "auto-generated"
    max_age: 86400

user_store:
  type: yaml

users:
  - username: "admin"
    password_hash: "$2b$10$..."
    role: "admin"
```

## 관련 문서
- [mcctl-api PRD](../../platform/services/mcctl-api/prd.md) - Section 4

## 라벨
- `phase:8-admin`
- `type:feature`
- `package:cli`
