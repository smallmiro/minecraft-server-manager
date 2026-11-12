# 서버 정의 (server.yaml)

서버 하나는 파일 하나, `servers/<이름>/server.yaml`로 정의합니다. Docker Compose가 읽는 파일은 mcctl이 이 파일에서 만들어 씁니다.

| 파일 | server.yaml에서 생성 |
|------|----------------------|
| `servers/<이름>/config.env` | 예 (주석과 손대지 않은 줄은 그대로) |
| `servers/<이름>/docker-compose.yml` | 예 (번들 템플릿에서 생성) |
| `servers/compose.yml` | `<이름>/docker-compose.yml` include 항목만 추가하고 다른 항목은 유지 |

플랫폼 파일(`.env`, 메인 `docker-compose.yml`, `.mcctl.json`)은 포함하지 않습니다.

## 파일 내용

```yaml
specVersion: 1
name: survival
type: PAPER
version: "1.21.1"
memory: 4G
image: itzg/minecraft-server:java21
world:
  level: survival
  storage: universe        # worlds/<level>, "data"는 servers/<이름>/data/<level>
routing:
  customHostnames:
    - mc.example.com
  playitDomain: aa.example.com
  autoScale:
    up: true
    down: true
  asleepMotd: "§e§lServer is sleeping§r\n§7Connect to wake up!"   # 선택
  loadingMotd: "§a§lServer is starting...§r\n§7Please wait!"       # 선택
env:                       # 그 밖의 config.env 키를 그대로
  MODE: survival
  ENABLE_RCON: "true"
  MOTD: Welcome to survival! Your adventure begins here.
```

- `TYPE`, `VERSION`, `MEMORY`, `LEVEL`, `PLAYIT_DOMAIN`은 별도 필드이며 `env`에 둘 수 없습니다.
- `EXTRA_ARGS`는 `world.storage`(`universe`면 `--universe /worlds/`)와 `env.EXTRA_ARGS`로 씁니다. 항상 쓰므로 서버가 더 이상 `.env`에서 상속받지 않습니다.
- `image`는 서버의 컨테이너 이미지이며, 새 서버는 `VERSION`에 필요한 `itzg/minecraft-server` 태그를 받습니다(`LATEST`는 `java25`). `mcctl update`는 고정한 태그가 아니면 `VERSION`에 필요한 Java 태그로 바꿉니다. [Java 버전과 이미지 태그](server-types.ko.md#java-버전과-이미지-태그)를 참고하세요.
- mc-router 호스트는 `<이름>.local`, `HOST_IPS`(없으면 `HOST_IP`, 그것도 없으면 감지한 호스트 주소)의 주소마다 `<이름>.<ip>.nip.io`, playit 도메인, 사용자 호스트 순입니다.
- `routing.autoScale`은 접속 시 mc-router가 서버를 시작할지(`up`), 유휴 시 중지할지(`down`)를 정합니다. `asleepMotd`와 `loadingMotd`는 서버가 잠들어 있거나 시작 중일 때 보여 줄 MOTD이며, 없으면 템플릿의 MOTD를 씁니다.
- YAML이 숫자나 불린으로 읽는 값은 따옴표로 감쌉니다(`version: "1.21"`, `ENABLE_RCON: "true"`). 그렇지 않으면 mcctl이 해당 필드를 알려 줍니다.
- 알 수 없는 키는 오류입니다. `env` 키는 셸 변수 이름이어야 하고, 값은 제어 문자가 없는 한 줄이며 따옴표로 시작할 수 없습니다. `env.EXTRA_ARGS`에는 `--universe`를 넣을 수 없습니다(`world.storage`를 설정하세요). 호스트명은 올바른 DNS 이름이어야 합니다.

## 누가 쓰는가

서버를 바꾸는 mcctl 명령과 웹 콘솔 동작은 모두 `server.yaml`을 거칩니다: `mcctl create`, `mcctl config`, `whitelist`, `op`, `mod`, `playit domain`, `update`, `init --reconfigure`, 월드 배정, `migrate worlds`, 콘솔의 설정·화이트리스트·모드·호스트명 화면.

## 기존 서버

이 변경 전에 만든 서버에는 `server.yaml`이 없습니다. 지금처럼 동작하고, mcctl이 처음 바꿀 때 가져옵니다. 지금 가져오고 보고서를 보려면:

```bash
mcctl migrate spec --all --dry-run   # 가져올 내용 미리 보기
mcctl migrate spec --all             # 가져오고 파일 쓰기
```

`--json`을 붙이면 기계가 읽을 수 있는 보고서를 출력합니다. 가져오기는 `config.env` 키를 하나도 잃지 않습니다. `docker-compose.yml`의 `environment` 항목은 `env`로 옮깁니다(Compose가 `config.env`보다 우선했으므로, 충돌은 보고합니다). 월드나 이미지를 `${...}` 보간으로 정한 서버는 값을 리터럴로 바꿀 때까지 가져오지 않습니다. `VERSION=`처럼 빈 값은 비어 있는 채로 남깁니다(`version: ""`). 빈 값도 `servers/global.env`보다 우선하기 때문입니다. mcctl은 `config.env` 값의 `$`는 작은따옴표 안에(이런 값은 `\`로 끝날 수 없습니다), compose 이미지나 라우터 라벨의 `$`는 `$$`로 써서 Docker Compose가 보간하지 않게 합니다. `mcctl upgrade`는 아직 `server.yaml`이 없는 서버를 알려 줍니다.

## 손으로 고친 경우

생성 파일의 첫 줄은 해시가 든 헤더라서 mcctl이 손수정을 알아챕니다.

- **config.env**를 고침: 다음에 mcctl이 그 서버를 바꿀 때 `server.yaml`로 가져옵니다.
- **docker-compose.yml**의 `image`나 `mc-router.*` 라벨을 고침: 같은 방식으로 가져옵니다.
- **docker-compose.yml**의 다른 부분(포트, 볼륨 등)을 고침: 파일을 보호합니다. 그 파일에 영향이 없는 변경은 그대로 두고, 파일을 다시 써야 하는 변경은 `compose_edited`로 실패하며 고친 필드를 알려 줍니다.
- **server.yaml**을 고침: 다음에 mcctl이 그 서버를 바꿀 때, 또는 `mcctl migrate spec <이름>`으로 반영합니다.
- **config.env와 server.yaml을 둘 다** 고침: `edit_conflict`. 한쪽 수정을 되돌리거나 `mcctl migrate spec <이름> --force`로 `server.yaml`에서 다시 만듭니다(`config.env.bak` / `docker-compose.yml.bak`을 남김).

`mcctl start`는 파일을 다시 만들지 않고 디스크에 있는 대로 시작합니다.

쓰기가 멈출 수 있는 그 밖의 오류:

- `storage_change`: 변경이 월드를 `worlds/`와 서버의 `data/` 사이로 옮기게 됩니다(`world.storage`). mcctl은 이를 거부하고 `mcctl migrate worlds`를 안내합니다.
- `invalid_spec`: 필드가 올바르지 않습니다. 메시지에 필드마다 이유가 나옵니다.
- `unsupported_spec_version`: 더 새로운 mcctl이 쓴 파일입니다. mcctl을 업그레이드하세요.
- `locked`: 다른 mcctl 프로세스가 `servers/compose.yml`을 바꾸거나 서버를 삭제하는 중입니다. 끝난 뒤 다시 시도하세요.

## 컨테이너 제한, 중지 시간, 로그 {#container-memory-limit}

`server.yaml` 필드에 없는 컨테이너 compose 설정입니다.

- **메모리 제한.** 새 서버와 `server.yaml`을 다시 쓰는 서버에는 `mem_limit` = 힙 + max(2G, 힙 / 2)가 들어갑니다. 힙은 `env`에 `MAX_MEMORY`가 있으면 그 값, 없으면 `memory`입니다. JVM은 힙 외에도 메모리(metaspace, code cache, 스레드 스택, direct buffer)가 필요하며, 제한을 넘어 종료된 컨테이너는 월드를 저장하다 멈춥니다. 예: `512M`은 `2560m`, `2G`는 `4g`, `4G`는 `6g`, `6G`는 `9g`, `8G`는 `12g`입니다. `memory`가 없거나 단위 없는 값(퍼센트, 숫자만)이면, 또는 `env`의 값에 `-Xmx`나 `-XX:MaxRAM`이 들어 있으면 제한을 두지 않습니다(`servers/global.env`의 `JVM_OPTS`는 판단에 반영하지 않습니다). swap이 켜진 호스트에서는 컨테이너가 `mem_limit`만큼 swap도 쓸 수 있습니다.
- **중지 시간.** `stop_grace_period: 90s`는 서버가 월드를 저장할 시간을 줍니다. itzg는 `STOP_DURATION`(기본 60초)까지 기다리는데, Docker 기본값 10초면 그 전에 강제 종료됩니다. `STOP_DURATION`(또는 `STOP_SERVER_ANNOUNCE_DELAY`)을 90초보다 길게 늘렸다면 서버의 `docker-compose.yml`에서 `stop_grace_period`도 늘립니다. mc-router는 `AUTO_SCALE_DOWN_AFTER`로 정한 유휴 시간이 지나면 서버를 중지하며, 중지 자체를 기다리는 60초는 mc-router에 고정되어 있습니다.
- **로그 회전.** 서버, mc-router, playit-agent는 `json-file` 드라이버와 `max-size: "50m"`, `max-file: "5"`를 사용합니다. `docker logs`는 컨테이너당 최대 250 MB만 보관합니다.

`memory`를 바꾸면 `mem_limit`도 바뀝니다. 손으로 고친 `mem_limit`는 손으로 고친 경우(위 참조)에 해당하므로, [`mcctl migrate spec`](../cli/commands.md#mcctl-migrate-spec)에 `--force`를 주지 않으면 mcctl이 그 위에 compose 파일을 다시 쓰지 않습니다. compose 설정은 컨테이너를 다시 만들어야 적용됩니다. `mcctl migrate spec <name>` 후 서버를 중지하고 `mcctl start <name>`을 실행합니다.

`mcctl create`와 웹 콘솔은 `server.yaml`과 위 파일을 쓰고, avahi에 `<이름>.local`을 등록하며(실패는 경고), `--no-start`가 없으면 서버를 시작합니다. 서버가 만들어지기 전에 실패하면 아무것도 남기지 않아서 같은 생성을 바로 다시 시도할 수 있습니다. 서버는 만들어졌지만 시작하지 못하면 서버는 그대로 둡니다. CLI는 원인과 함께 종료 코드 1로 끝나고 콘솔도 알려 줍니다. `mcctl start <이름>`으로 시작하세요.
