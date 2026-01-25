# feat: mcctl-console 서비스 기본 구조 설정

## 개요

mcctl-console 관리 콘솔 서비스의 기본 프로젝트 구조를 설정합니다.

## 관련 문서

- [mcctl-console/prd.md](../../../platform/services/mcctl-console/prd.md)
- [mcctl-console/plan.md](../../../platform/services/mcctl-console/plan.md)

## 구현 목록

### 패키지 설정

- [ ] `package.json` 생성
  ```json
  {
    "name": "@minecraft-docker/mcctl-console",
    "version": "0.1.0",
    "private": true
  }
  ```

- [ ] `tsconfig.json` 설정
- [ ] `next.config.js` 설정
- [ ] `tailwind.config.js` 설정
- [ ] `pnpm-workspace.yaml` 업데이트

### 의존성

```json
{
  "dependencies": {
    "@minecraft-docker/shared": "workspace:*",
    "next": "^14.x",
    "next-auth": "^5.x",
    "react": "^18.x",
    "react-dom": "^18.x",
    "@tanstack/react-query": "^5.x",
    "tailwindcss": "^3.x"
  }
}
```

### 기본 파일 구조

```
platform/services/mcctl-console/
├── package.json
├── tsconfig.json
├── next.config.js
├── tailwind.config.js
├── src/
│   ├── app/
│   │   ├── layout.tsx      # 루트 레이아웃
│   │   ├── page.tsx        # 홈 (리다이렉트)
│   │   └── login/
│   │       └── page.tsx    # 로그인 페이지
│   ├── components/
│   │   └── ui/             # shadcn/ui 기본 컴포넌트
│   └── lib/
│       ├── api-client.ts   # API 클라이언트
│       └── utils.ts
```

### 구현

- [ ] Next.js App Router 기본 설정
- [ ] Tailwind CSS 설정
- [ ] shadcn/ui 초기 설정
- [ ] 기본 레이아웃 (다크 테마)
- [ ] 로그인 페이지 UI

## UI 스타일

### 컬러 팔레트 (마인크래프트 테마)

```css
:root {
  --bg-primary: #1a1a2e;
  --bg-secondary: #16213e;
  --accent-primary: #4ade80;
  --accent-warning: #fbbf24;
  --accent-danger: #ef4444;
  --text-primary: #f1f5f9;
  --text-secondary: #94a3b8;
}
```

## 테스트

- [ ] 빌드 테스트 (`pnpm build`)
- [ ] 개발 서버 시작 테스트
- [ ] 로그인 페이지 렌더링 확인

## 완료 기준

- [ ] 빌드 성공
- [ ] 개발 서버 정상 시작
- [ ] 로그인 페이지 UI 표시

## Labels

- `phase:8-admin`
- `type:feature`
- `package:mcctl-console`
