# Issue: mcctl-api 인증 플러그인 구현

## Phase
8.3.2 - mcctl-api 서비스

## 제목
feat(mcctl-api): Implement authentication plugin with 5 access modes

## 설명
5가지 접근 모드를 지원하는 Fastify 인증 플러그인을 구현합니다.

## 선행 작업
- #8.3.1 mcctl-api 프로젝트 기반 구조

## 작업 내용
- [ ] `src/plugins/auth.ts` 생성
- [ ] `internal` 모드 - Docker 네트워크 검증
- [ ] `api-key` 모드 - X-API-Key 헤더 검증
- [ ] `ip-whitelist` 모드 - IP 화이트리스트
- [ ] `api-key-ip` 모드 - 복합 인증
- [ ] `open` 모드 - 인증 없음 (개발용)
- [ ] `src/plugins/error-handler.ts` - 에러 핸들러
- [ ] 단위 테스트

## 접근 모드 상세

| 모드 | 포트 노출 | 인증 방식 |
|------|----------|----------|
| `internal` | 없음 | Docker 네트워크만 |
| `api-key` | 3001 | X-API-Key 헤더 |
| `ip-whitelist` | 3001 | IP 검증 |
| `api-key-ip` | 3001 | 둘 다 |
| `open` | 3001 | 없음 (개발용) |

## 구현 예시

```typescript
export interface AuthPluginOptions {
  accessMode: 'internal' | 'api-key' | 'ip-whitelist' | 'api-key-ip' | 'open';
  apiKey?: string;
  apiKeyHeader?: string;
  ipWhitelist?: string[];
}
```

## 관련 문서
- [mcctl-api PRD](../../platform/services/mcctl-api/prd.md) - Section 4

## 라벨
- `phase:8-admin`
- `type:feature`
- `package:mcctl-api`
