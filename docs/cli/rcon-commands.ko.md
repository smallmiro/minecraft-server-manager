# RCON 명령어 레퍼런스

## 개요

RCON (Remote Console)을 통해 서버 관리자는 마인크래프트 서버 명령어를 원격으로 실행할 수 있습니다. 이 가이드는 mcctl에서 사용할 수 있는 모든 RCON 명령어를 다룹니다.

### mcctl RCON 명령어

| 명령어 | 모드 | 설명 |
|--------|------|------|
| `mcctl rcon <서버>` | 대화형 | RCON 콘솔 세션 열기 |
| `mcctl exec <서버> <명령>` | 비대화형 | 단일 명령 실행 |

### 사용 시점

| 용도 | 명령어 |
|------|--------|
| 수동 서버 관리 | `mcctl rcon myserver` |
| 연속 명령 실행 | `mcctl rcon myserver` |
| 디버깅 및 문제 해결 | `mcctl rcon myserver` |
| 쉘 스크립트 및 자동화 | `mcctl exec myserver <cmd>` |
| CI/CD 파이프라인 | `mcctl exec myserver <cmd>` |
| 크론 작업 | `mcctl exec myserver <cmd>` |

---

## 사용 예시

### 대화형 모드 (rcon)

```bash
$ mcctl rcon survival
Connecting to RCON console for 'survival'...
Type "help" for commands, Ctrl+C or "exit" to quit

> list
There are 2 of 20 players online: Steve, Alex
> say 서버 점검 10분 전입니다!
[Server: 서버 점검 10분 전입니다!]
> tp Steve 0 100 0
Teleported Steve to 0.0, 100.0, 0.0
> exit
$
```

### 비대화형 모드 (exec)

```bash
# 단일 명령 실행
$ mcctl exec survival list
There are 2 of 20 players online: Steve, Alex

# 스크립트에서 사용
$ mcctl exec myserver say "백업 시작..."
[Server: 백업 시작...]

# 스크립트 예시
PLAYERS=$(mcctl exec myserver list)
if echo "$PLAYERS" | grep -q "0 of"; then
  mcctl stop myserver
fi
```

---

## 플레이어 관리 명령어

| 명령어 | 설명 | 예시 |
|--------|------|------|
| `list` | 온라인 플레이어 표시 | `list` |
| `kick <플레이어> [사유]` | 플레이어 추방 | `kick Steve 장기 AFK` |
| `ban <플레이어> [사유]` | 플레이어 영구 밴 | `ban Griefer 스폰 그리핑` |
| `ban-ip <IP> [사유]` | IP 주소 밴 | `ban-ip 192.168.1.100 VPN` |
| `pardon <플레이어>` | 밴 해제 | `pardon Steve` |
| `pardon-ip <IP>` | IP 밴 해제 | `pardon-ip 192.168.1.100` |
| `banlist [players\|ips]` | 밴 목록 표시 | `banlist players` |
| `op <플레이어>` | 관리자 권한 부여 | `op Steve` |
| `deop <플레이어>` | 관리자 권한 해제 | `deop Steve` |
| `whitelist add <플레이어>` | 화이트리스트 추가 | `whitelist add Steve` |
| `whitelist remove <플레이어>` | 화이트리스트 제거 | `whitelist remove Steve` |
| `whitelist list` | 화이트리스트 표시 | `whitelist list` |
| `whitelist on` | 화이트리스트 활성화 | `whitelist on` |
| `whitelist off` | 화이트리스트 비활성화 | `whitelist off` |

---

## 커뮤니케이션 명령어

| 명령어 | 설명 | 예시 |
|--------|------|------|
| `say <메시지>` | 전체 공지 | `say 서버 재시작 5분 전` |
| `tell <플레이어> <메시지>` | 귓속말 | `tell Steve 인벤토리 확인해` |
| `tellraw <플레이어> <json>` | JSON 포맷 메시지 전송 | `tellraw @a {"text":"안녕","color":"gold"}` |
| `title <플레이어> <동작>` | 화면에 타이틀 표시 | `title @a title {"text":"환영합니다!"}` |
| `me <동작>` | 액션 메시지 표시 | `me 서버를 재시작합니다` |

---

## 텔레포트 명령어

| 명령어 | 설명 | 예시 |
|--------|------|------|
| `tp <플레이어> <x> <y> <z>` | 좌표로 텔레포트 | `tp Steve 0 100 0` |
| `tp <플레이어> <대상>` | 다른 플레이어에게 텔레포트 | `tp Steve Alex` |
| `tp @a <x> <y> <z>` | 모든 플레이어 텔레포트 | `tp @a 0 100 0` |
| `spawnpoint <플레이어>` | 스폰 지점 설정 | `spawnpoint Steve 100 64 100` |
| `setworldspawn <x> <y> <z>` | 월드 스폰 설정 | `setworldspawn 0 64 0` |

### 대상 선택자

| 선택자 | 설명 |
|--------|------|
| `@a` | 모든 플레이어 |
| `@p` | 가장 가까운 플레이어 |
| `@r` | 무작위 플레이어 |
| `@e` | 모든 엔티티 |
| `@s` | 실행 엔티티 |

---

## 아이템 명령어

| 명령어 | 설명 | 예시 |
|--------|------|------|
| `give <플레이어> <아이템> [수량]` | 아이템 지급 | `give Steve diamond 64` |
| `clear <플레이어> [아이템] [수량]` | 인벤토리에서 제거 | `clear Steve dirt` |
| `item replace <대상> <슬롯>` | 슬롯의 아이템 교체 | `item replace entity Steve armor.head with diamond_helmet` |

### 자주 사용하는 아이템 ID

| 카테고리 | 아이템 |
|----------|--------|
| 광석 | `diamond`, `iron_ingot`, `gold_ingot`, `emerald`, `netherite_ingot` |
| 도구 | `diamond_pickaxe`, `netherite_sword`, `elytra`, `trident` |
| 블록 | `dirt`, `stone`, `oak_log`, `cobblestone` |
| 음식 | `cooked_beef`, `golden_apple`, `enchanted_golden_apple` |

---

## 월드 설정 명령어

### 시간

| 명령어 | 설명 | 예시 |
|--------|------|------|
| `time set day` | 낮으로 설정 (1000) | `time set day` |
| `time set night` | 밤으로 설정 (13000) | `time set night` |
| `time set noon` | 정오로 설정 (6000) | `time set noon` |
| `time set midnight` | 자정으로 설정 (18000) | `time set midnight` |
| `time set <틱>` | 특정 틱으로 설정 | `time set 0` |
| `time add <틱>` | 시간 추가 | `time add 1000` |
| `time query daytime` | 현재 시간 표시 | `time query daytime` |

### 날씨

| 명령어 | 설명 | 예시 |
|--------|------|------|
| `weather clear [지속시간]` | 맑은 날씨 | `weather clear 1000000` |
| `weather rain [지속시간]` | 비 시작 | `weather rain` |
| `weather thunder [지속시간]` | 천둥번개 시작 | `weather thunder` |

### 난이도

| 명령어 | 설명 |
|--------|------|
| `difficulty peaceful` | 평화로움 (적대적 몹 없음) |
| `difficulty easy` | 쉬움 |
| `difficulty normal` | 보통 |
| `difficulty hard` | 어려움 |

---

## 게임 규칙

`gamerule` 명령어로 게임플레이 메커니즘 변경:

| 명령어 | 설명 | 기본값 |
|--------|------|--------|
| `gamerule keepInventory true` | 사망 시 아이템 유지 | false |
| `gamerule doDaylightCycle false` | 시간 흐름 정지 | true |
| `gamerule doWeatherCycle false` | 날씨 변화 정지 | true |
| `gamerule mobGriefing false` | 몹의 블록 파괴 방지 | true |
| `gamerule doFireTick false` | 불 번짐 방지 | true |
| `gamerule pvp false` | PvP 비활성화 | true |
| `gamerule announceAdvancements false` | 발전과제 메시지 숨김 | true |
| `gamerule showDeathMessages false` | 사망 메시지 숨김 | true |
| `gamerule naturalRegeneration false` | 자연 회복 비활성화 | true |
| `gamerule commandBlockOutput false` | 커맨드 블록 출력 숨김 | true |
| `gamerule sendCommandFeedback false` | 명령어 피드백 숨김 | true |
| `gamerule randomTickSpeed 0` | 작물/식물 성장 비활성화 | 3 |
| `gamerule spawnRadius 0` | 정확한 스폰 지점에서 스폰 | 10 |

### 게임 규칙 조회

```bash
> gamerule keepInventory
keepInventory = false

> gamerule
# 모든 게임 규칙 목록
```

---

## 서버 관리 명령어

| 명령어 | 설명 | 예시 |
|--------|------|------|
| `stop` | 서버 정상 종료 | `stop` |
| `save-all` | 모든 월드 데이터 저장 | `save-all` |
| `save-off` | 자동 저장 비활성화 | `save-off` |
| `save-on` | 자동 저장 활성화 | `save-on` |
| `seed` | 월드 시드 표시 | `seed` |
| `list` | 온라인 플레이어 표시 | `list` |
| `setidletimeout <분>` | AFK 추방 시간 설정 | `setidletimeout 30` |

### 백업 워크플로우

```bash
> save-off
Automatic saving is now disabled
> save-all
Saving the game (this may take a moment!)
Saved the game
# ... 백업 수행 ...
> save-on
Automatic saving is now enabled
```

---

## 게임모드 명령어

| 명령어 | 설명 |
|--------|------|
| `gamemode survival <플레이어>` | 서바이벌 모드 |
| `gamemode creative <플레이어>` | 크리에이티브 모드 |
| `gamemode adventure <플레이어>` | 어드벤처 모드 |
| `gamemode spectator <플레이어>` | 관전 모드 |
| `defaultgamemode <모드>` | 신규 플레이어 기본 모드 설정 |

```bash
> gamemode creative Steve
Set Steve's game mode to Creative Mode

> defaultgamemode survival
The default game mode is now Survival Mode
```

---

## 효과 명령어

| 명령어 | 설명 | 예시 |
|--------|------|------|
| `effect give <플레이어> <효과> [지속시간] [레벨]` | 효과 적용 | `effect give Steve speed 600 2` |
| `effect clear <플레이어> [효과]` | 효과 제거 | `effect clear Steve` |

### 주요 효과

| 효과 | 설명 |
|------|------|
| `speed` | 이동 속도 증가 |
| `slowness` | 이동 속도 감소 |
| `haste` | 채굴 속도 증가 |
| `mining_fatigue` | 채굴 속도 감소 |
| `strength` | 근접 공격력 증가 |
| `instant_health` | 즉시 회복 |
| `instant_damage` | 즉시 피해 |
| `jump_boost` | 점프력 증가 |
| `regeneration` | 체력 재생 |
| `resistance` | 피해 저항 |
| `fire_resistance` | 화염 저항 |
| `water_breathing` | 수중 호흡 |
| `invisibility` | 투명화 |
| `night_vision` | 야간 투시 |
| `saturation` | 포만감 회복 |

---

## 경험치 명령어

| 명령어 | 설명 | 예시 |
|--------|------|------|
| `xp add <플레이어> <양>` | 경험치 포인트 추가 | `xp add Steve 1000` |
| `xp add <플레이어> <양> levels` | 경험치 레벨 추가 | `xp add Steve 30 levels` |
| `xp set <플레이어> <양>` | 경험치 포인트 설정 | `xp set Steve 0` |
| `xp query <플레이어> points` | XP 포인트 조회 | `xp query Steve points` |
| `xp query <플레이어> levels` | XP 레벨 조회 | `xp query Steve levels` |

---

## 고급 명령어

### Execute 명령어

특정 컨텍스트로 명령 실행:

```bash
# 다른 플레이어로 실행
> execute as Steve run say Steve가 보낸 메시지!

# 특정 위치에서 실행
> execute positioned 0 64 0 run summon lightning_bolt

# 조건 충족 시 실행
> execute if entity @a[distance=..10] run say 누군가 근처에 있습니다!
```

### Scoreboard

값 추적 및 표시:

```bash
# 목표 생성
> scoreboard objectives add kills playerKillCount

# 사이드바에 표시
> scoreboard objectives setdisplay sidebar kills

# 점수 설정
> scoreboard players set Steve kills 10

# 점수 조회
> scoreboard players get Steve kills
```

### Data 명령어

엔티티/블록 NBT 데이터 수정:

```bash
# 플레이어 데이터 보기
> data get entity Steve

# 엔티티 데이터 수정
> data modify entity Steve Health set value 20.0f
```

---

## 도움말 명령어

| 명령어 | 설명 |
|--------|------|
| `help` | 사용 가능한 모든 명령어 목록 |
| `help <명령어>` | 특정 명령어 사용법 표시 |
| `help <페이지>` | 도움말 페이지 표시 (1-8) |

```bash
> help tp
/tp <destination>
/tp <location>
/tp <targets> <destination>
/tp <targets> <location>
...
```

---

## 오류 처리

### 일반적인 오류

| 오류 | 원인 | 해결책 |
|------|------|--------|
| `Unknown command` | 오타 또는 잘못된 명령어 | 철자 확인, `help` 사용 |
| `Player not found` | 플레이어 오프라인 또는 잘못된 이름 | 플레이어 온라인 확인 |
| `Expected whitespace` | 명령어에 공백 누락 | 명령어 문법 확인 |
| `Not a valid number` | 잘못된 인수 타입 | 올바른 데이터 타입 사용 |

### 서버 미실행 오류

```bash
$ mcctl rcon myserver
Server 'myserver' is not running
Start the server first: mcctl start myserver
```

---

## 참조

- 마인크래프트 전체 명령어: [Minecraft Wiki - Commands](https://minecraft.wiki/w/Commands)
- Java Edition 명령어 문법: [Command Syntax](https://minecraft.wiki/w/Commands#Syntax)
- 대상 선택자: [Target Selector](https://minecraft.wiki/w/Target_selectors)
- NBT 포맷: [NBT Format](https://minecraft.wiki/w/NBT_format)
