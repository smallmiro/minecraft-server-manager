# Issue: YamlUserRepository 어댑터 구현

## Phase
8.1.2 - Shared 패키지 확장

## 제목
feat(shared): Implement YamlUserRepository adapter

## 설명
`.mcctl-admin.yml` 파일 기반 사용자 저장소 어댑터를 구현합니다.

## 선행 작업
- #8.1.1 IUserRepository 포트 정의

## 작업 내용
- [ ] `src/infrastructure/adapters/YamlUserRepository.ts` 생성
- [ ] IUserRepository 구현
- [ ] 파일 읽기/쓰기 구현
- [ ] bcrypt 비밀번호 해싱
- [ ] 파일 잠금 처리
- [ ] index.ts에 export 추가
- [ ] 단위 테스트 작성

## 설정 파일 구조

```yaml
# ~/.minecraft-servers/.mcctl-admin.yml
users:
  - username: "admin"
    password_hash: "$2b$10$..."
    role: "admin"
  - username: "operator"
    password_hash: "$2b$10$..."
    role: "operator"
```

## 관련 문서
- [shared PRD](../../platform/services/shared/prd.md) - Section 4.2

## 라벨
- `phase:8-admin`
- `type:feature`
- `package:shared`
