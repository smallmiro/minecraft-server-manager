# Git 워크플로우

이 프로젝트는 Git-Flow 브랜치 전략과 Semantic Versioning을 따릅니다. 모든 변경은 GitHub 이슈에서 시작해 PR을 통해 `develop`에 들어갑니다.

## 브랜치 {#branches}

```text
main      ← 릴리즈된 상태, 메인테이너가 develop에서 갱신
  │
develop   ← 통합 브랜치, 모든 PR의 대상
  │
  ├── feature/<issue>-<description>   새 기능, 개선, 리팩터링
  ├── bugfix/<issue>-<description>    긴급하지 않은 버그 수정
  ├── release/<version>               릴리즈 준비 (메인테이너)
  └── hotfix/<version>                운영 긴급 수정 (메인테이너)
```

| 유형 | 패턴 | 예시 | 기준 |
|------|------|------|------|
| Feature | `feature/<issue>-<description>` | `feature/12-add-backup` | 새 기능, 개선, 리팩터링 |
| Bugfix | `bugfix/<issue>-<description>` | `bugfix/15-fix-lock` | 일반 버그, 비긴급 수정 |
| Release | `release/<version>` | `release/2.30.0` | 릴리즈 준비 |
| Hotfix | `hotfix/<version>` | `hotfix/2.30.1` | 운영 장애, 긴급 버그, 데이터 손실 위험 |

`develop`이나 `main`에 직접 커밋하지 않습니다.

## 기본 절차 {#standard-workflow}

1. 원본 저장소(`smallmiro/minecraft-server-manager`)에 이슈를 만듭니다. Summary, Root Cause 또는 Requirements, Solution / Implementation Plan, Files to Modify, 체크박스 형태의 Acceptance Criteria를 포함합니다.
2. 포크에서 최신 `develop` 기준으로 이슈 번호를 넣은 브랜치를 만듭니다.
3. TDD로 구현하고 이슈 번호(`#<issue>`)를 넣어 커밋합니다. 진행하면서 Acceptance Criteria를 체크합니다.
4. 이슈마다 PR 1개를 원본 저장소의 `develop`으로 엽니다. 본문에 `Closes #<issue>`를 넣습니다.
5. 리뷰 의견은 같은 브랜치에 커밋을 추가해 반영합니다.
6. 머지 후 로컬과 포크의 브랜치를 삭제합니다.

포크와 `upstream` 원격 저장소 설정 명령은 [개발 가이드](index.md#fork-and-set-up)에 있습니다.

## 커밋 메시지 {#commit-messages}

```text
<type>: <description> (#<issue-number>)

<body>
```

스코프는 선택이며, 예를 들어 `feat(cli): add mod search (#123)`처럼 씁니다. Claude Code로 작성한 커밋은 끝에 `Co-Authored-By: Claude ... <noreply@anthropic.com>` 트레일러가 붙습니다.

| 타입 | 설명 | 예시 |
|------|------|------|
| `feat` | 새 기능 | `feat: add world backup command (#12)` |
| `fix` | 버그 수정 | `fix: resolve lock file race condition (#15)` |
| `docs` | 문서 | `docs: update CLI reference (#20)` |
| `refactor` | 동작 변경 없는 리팩터링 | `refactor: extract validation logic (#25)` |
| `test` | 테스트 | `test: add world locking tests (#30)` |
| `chore` | 유지보수, 릴리즈 | `chore(release): bump version to v2.30.0` |

"fix", "update", "changes" 같은 모호한 메시지는 피합니다.

## TDD {#tdd}

모든 기능, 버그 수정, 개선은 **Red → Green → Refactor**를 따릅니다:

1. **Red**: 기대 동작을 정의하는 실패하는 테스트를 작성합니다.
2. **Green**: 테스트를 통과시키는 최소한의 코드를 작성합니다.
3. **Refactor**: 테스트가 통과하는 상태를 유지하며 정리합니다.

문서 전용 변경과 로직 없는 설정 변경을 제외하고, 테스트가 없는 PR은 받지 않습니다. 테스트 위치는 [개발 가이드](index.md#build-and-test)에 있습니다.

## Tidy First {#tidy-first}

구조 변경과 동작 변경을 한 커밋에 섞지 않습니다.

| 변경 유형 | 예시 |
|-----------|------|
| 구조 변경 | 이름 변경, 함수 추출, 파일 이동 |
| 동작 변경 | 새 기능, 버그 수정, 로직 변경 |

```bash
# 좋은 예: 커밋 2개로 분리
git commit -m "refactor: extract validate_world function (#7)"
git commit -m "feat: add world existence check (#7)"

# 나쁜 예: 한 커밋에 섞음
git commit -m "feat: add validation with new helper function (#7)"
```

## 작업 체크포인트 (`task.md`) {#task-checkpoint-taskmd}

저장소 루트의 `task.md`는 git에서 제외된 파일로, 로컬 작업 메모에 씁니다. `/work`는 커밋할 때마다 여기에 체크포인트를 추가합니다.

```markdown
## Working On
- [ ] Implementing lock.sh (#5)

## Context
- Branch: feature/5-world-locking

## Notes
- lock file format: <server>:<timestamp>:<pid>
```

계획은 GitHub에서 관리합니다. 요구사항과 Acceptance Criteria는 이슈 본문에 두고, 큰 작업의 계획은 `/plan-work`로 만듭니다. 루트와 각 패키지의 `plan.md`는 초기 구축 당시의 로드맵 기록입니다.

## Semantic Versioning {#semantic-versioning}

[Semantic Versioning 2.0.0](https://semver.org/)을 따릅니다. npm 패키지 다섯 개(`@minecraft-docker/shared`, `mod-source-modrinth`, `mcctl`, `mcctl-api`, `mcctl-console`)와 루트 `package.json`은 같은 버전을 씁니다.

| 자리 | 올리는 경우 | 예시 |
|------|-------------|------|
| **MAJOR** | 호환되지 않는 변경 | `1.9.0` → `2.0.0` |
| **MINOR** | 하위 호환 새 기능 | `2.29.1` → `2.30.0` |
| **PATCH** | 하위 호환 버그 수정 | `2.29.0` → `2.29.1` |

MAJOR를 올리면 MINOR와 PATCH를 0으로, MINOR를 올리면 PATCH를 0으로 되돌립니다.

## 릴리즈 절차 {#release-process}

릴리즈는 메인테이너가 수행하며, 보통 `release-manager` 에이전트로 진행합니다.

1. **브랜치**: `develop`에서 `release/<version>`을 만듭니다.
2. **준비**: `chore(release): bump version to v<version>` 커밋 하나에서 루트와 패키지 다섯 개의 `package.json` 버전을 올리고, `CHANGELOG.md`에 새 버전을 추가해 `platform/services/cli/CHANGELOG.md`로 복사하고, `platform/services/cli/README.md`의 Changelog 섹션(npm 페이지에 표시됨)을 갱신하고, 필요하면 `README.md`와 `docs/documentforllmagent.md`도 갱신합니다.
3. **머지와 태그**: 릴리즈 브랜치를 `develop`에 머지한 뒤 annotated 태그를 만들어 푸시합니다.

    ```bash
    git tag -a v2.30.0 -m "Release v2.30.0"
    git push origin v2.30.0
    ```

4. **CI**: `v*` 태그가 `.github/workflows/release.yml`을 실행합니다. 워크스페이스를 빌드하고, 패키지 다섯 개를 npm에 발행하고, GitHub Release를 만들고, MkDocs 사이트를 GitHub Pages에 배포합니다.
5. **확인**: 다섯 패키지 모두 `npm view <package> version`이 새 버전인지 확인합니다. CI가 커밋 목록으로 릴리즈 노트를 만들기 때문에, 직접 정리한 노트는 CI가 끝난 뒤에 적용합니다(`gh release edit v<version> --notes-file ...`).

### CI 워크플로우 {#ci-workflows}

| 워크플로우 | 트리거 | 용도 |
|------------|--------|------|
| `ci.yml` | `develop`/`main` 대상 모든 PR, `develop` 푸시, `release.yml`에서 호출 | 전 패키지 빌드·lint·타입 검사·테스트, Linux·macOS 스크립트 테스트, compose 검증 |
| `e2e.yml` | 매일 03:00 KST, 수동 실행 | Management Console E2E (Playwright) |
| `release.yml` | `v*` 태그 푸시 | `ci.yml` 통과 후 npm 발행, GitHub Release, 문서 배포 |
| `deploy-website.yml` | `website/**`를 변경하는 `main` 푸시, 수동 실행 | 랜딩 페이지 배포 |

## 코드 품질 {#code-quality}

- 공통 로직을 추출해 중복을 없앱니다.
- 의도가 드러나는 이름을 씁니다.
- 함수 하나는 책임 하나만 갖게 합니다.
- 리뷰와 되돌리기가 쉽도록 커밋을 작고 원자적으로 유지합니다.
