# RCON Commands Reference

## Overview

RCON (Remote Console) allows server administrators to execute Minecraft server commands remotely. This guide covers all available RCON commands you can use with mcctl.

### mcctl RCON Commands

| Command | Mode | Description |
|---------|------|-------------|
| `mcctl rcon <server>` | Interactive | Open RCON console session |
| `mcctl exec <server> <cmd>` | Non-interactive | Execute single command |

### When to Use Each

| Use Case | Command |
|----------|---------|
| Manual server administration | `mcctl rcon myserver` |
| Multiple commands in sequence | `mcctl rcon myserver` |
| Debugging and troubleshooting | `mcctl rcon myserver` |
| Shell scripts and automation | `mcctl exec myserver <cmd>` |
| CI/CD pipelines | `mcctl exec myserver <cmd>` |
| Cron jobs | `mcctl exec myserver <cmd>` |

---

## Usage Examples

### Interactive Mode (rcon)

```bash
$ mcctl rcon survival
Connecting to RCON console for 'survival'...
Type "help" for commands, Ctrl+C or "exit" to quit

> list
There are 2 of 20 players online: Steve, Alex
> say Server maintenance in 10 minutes!
[Server: Server maintenance in 10 minutes!]
> tp Steve 0 100 0
Teleported Steve to 0.0, 100.0, 0.0
> exit
$
```

### Non-interactive Mode (exec)

```bash
# Single command execution
$ mcctl exec survival list
There are 2 of 20 players online: Steve, Alex

# Scripting example
$ mcctl exec myserver say "Backup starting..."
[Server: Backup starting...]

# Use in scripts
PLAYERS=$(mcctl exec myserver list)
if echo "$PLAYERS" | grep -q "0 of"; then
  mcctl stop myserver
fi
```

---

## Player Management Commands

| Command | Description | Example |
|---------|-------------|---------|
| `list` | Show online players | `list` |
| `kick <player> [reason]` | Kick player from server | `kick Steve AFK too long` |
| `ban <player> [reason]` | Ban player permanently | `ban Griefer Griefing spawn` |
| `ban-ip <ip> [reason]` | Ban IP address | `ban-ip 192.168.1.100 VPN` |
| `pardon <player>` | Unban player | `pardon Steve` |
| `pardon-ip <ip>` | Unban IP address | `pardon-ip 192.168.1.100` |
| `banlist [players\|ips]` | Show banned list | `banlist players` |
| `op <player>` | Grant operator status | `op Steve` |
| `deop <player>` | Revoke operator status | `deop Steve` |
| `whitelist add <player>` | Add to whitelist | `whitelist add Steve` |
| `whitelist remove <player>` | Remove from whitelist | `whitelist remove Steve` |
| `whitelist list` | Show whitelist | `whitelist list` |
| `whitelist on` | Enable whitelist | `whitelist on` |
| `whitelist off` | Disable whitelist | `whitelist off` |

---

## Communication Commands

| Command | Description | Example |
|---------|-------------|---------|
| `say <message>` | Broadcast to all players | `say Server restart in 5 minutes` |
| `tell <player> <message>` | Private message | `tell Steve Check your inventory` |
| `tellraw <player> <json>` | Send JSON formatted message | `tellraw @a {"text":"Hello","color":"gold"}` |
| `title <player> <action>` | Display title on screen | `title @a title {"text":"Welcome!"}` |
| `me <action>` | Display action message | `me is restarting the server` |

---

## Teleportation Commands

| Command | Description | Example |
|---------|-------------|---------|
| `tp <player> <x> <y> <z>` | Teleport to coordinates | `tp Steve 0 100 0` |
| `tp <player> <target>` | Teleport to another player | `tp Steve Alex` |
| `tp @a <x> <y> <z>` | Teleport all players | `tp @a 0 100 0` |
| `spawnpoint <player>` | Set spawn point | `spawnpoint Steve 100 64 100` |
| `setworldspawn <x> <y> <z>` | Set world spawn | `setworldspawn 0 64 0` |

### Target Selectors

| Selector | Description |
|----------|-------------|
| `@a` | All players |
| `@p` | Nearest player |
| `@r` | Random player |
| `@e` | All entities |
| `@s` | Executing entity |

---

## Item Commands

| Command | Description | Example |
|---------|-------------|---------|
| `give <player> <item> [count]` | Give item to player | `give Steve diamond 64` |
| `clear <player> [item] [count]` | Remove items from inventory | `clear Steve dirt` |
| `item replace <target> <slot>` | Replace item in slot | `item replace entity Steve armor.head with diamond_helmet` |

### Common Item IDs

| Category | Items |
|----------|-------|
| Ores | `diamond`, `iron_ingot`, `gold_ingot`, `emerald`, `netherite_ingot` |
| Tools | `diamond_pickaxe`, `netherite_sword`, `elytra`, `trident` |
| Blocks | `dirt`, `stone`, `oak_log`, `cobblestone` |
| Food | `cooked_beef`, `golden_apple`, `enchanted_golden_apple` |

---

## World Settings Commands

### Time

| Command | Description | Example |
|---------|-------------|---------|
| `time set day` | Set to daytime (1000) | `time set day` |
| `time set night` | Set to nighttime (13000) | `time set night` |
| `time set noon` | Set to noon (6000) | `time set noon` |
| `time set midnight` | Set to midnight (18000) | `time set midnight` |
| `time set <ticks>` | Set to specific tick | `time set 0` |
| `time add <ticks>` | Add time | `time add 1000` |
| `time query daytime` | Show current time | `time query daytime` |

### Weather

| Command | Description | Example |
|---------|-------------|---------|
| `weather clear [duration]` | Clear weather | `weather clear 1000000` |
| `weather rain [duration]` | Start rain | `weather rain` |
| `weather thunder [duration]` | Start thunderstorm | `weather thunder` |

### Difficulty

| Command | Description |
|---------|-------------|
| `difficulty peaceful` | Peaceful mode (no hostile mobs) |
| `difficulty easy` | Easy difficulty |
| `difficulty normal` | Normal difficulty |
| `difficulty hard` | Hard difficulty |

---

## Game Rules

Change gameplay mechanics with `gamerule`:

| Command | Description | Default |
|---------|-------------|---------|
| `gamerule keepInventory true` | Keep items on death | false |
| `gamerule doDaylightCycle false` | Stop time progression | true |
| `gamerule doWeatherCycle false` | Stop weather changes | true |
| `gamerule mobGriefing false` | Prevent mob damage to blocks | true |
| `gamerule doFireTick false` | Prevent fire spread | true |
| `gamerule pvp false` | Disable player vs player | true |
| `gamerule announceAdvancements false` | Hide advancement messages | true |
| `gamerule showDeathMessages false` | Hide death messages | true |
| `gamerule naturalRegeneration false` | Disable health regen | true |
| `gamerule commandBlockOutput false` | Hide command block output | true |
| `gamerule sendCommandFeedback false` | Hide command feedback | true |
| `gamerule randomTickSpeed 0` | Disable crop/plant growth | 3 |
| `gamerule spawnRadius 0` | Spawn at exact spawn point | 10 |

### Query Game Rules

```bash
> gamerule keepInventory
keepInventory = false

> gamerule
# Lists all game rules
```

---

## Server Administration Commands

| Command | Description | Example |
|---------|-------------|---------|
| `stop` | Stop the server gracefully | `stop` |
| `save-all` | Save all world data | `save-all` |
| `save-off` | Disable auto-save | `save-off` |
| `save-on` | Enable auto-save | `save-on` |
| `seed` | Display world seed | `seed` |
| `list` | Show online players | `list` |
| `setidletimeout <minutes>` | Set AFK kick timeout | `setidletimeout 30` |

### Backup Workflow

```bash
> save-off
Automatic saving is now disabled
> save-all
Saving the game (this may take a moment!)
Saved the game
# ... perform backup ...
> save-on
Automatic saving is now enabled
```

---

## Gamemode Commands

| Command | Description |
|---------|-------------|
| `gamemode survival <player>` | Survival mode |
| `gamemode creative <player>` | Creative mode |
| `gamemode adventure <player>` | Adventure mode |
| `gamemode spectator <player>` | Spectator mode |
| `defaultgamemode <mode>` | Set default for new players |

```bash
> gamemode creative Steve
Set Steve's game mode to Creative Mode

> defaultgamemode survival
The default game mode is now Survival Mode
```

---

## Effect Commands

| Command | Description | Example |
|---------|-------------|---------|
| `effect give <player> <effect> [duration] [level]` | Apply effect | `effect give Steve speed 600 2` |
| `effect clear <player> [effect]` | Remove effects | `effect clear Steve` |

### Common Effects

| Effect | Description |
|--------|-------------|
| `speed` | Increased movement speed |
| `slowness` | Decreased movement speed |
| `haste` | Faster mining |
| `mining_fatigue` | Slower mining |
| `strength` | Increased melee damage |
| `instant_health` | Instant healing |
| `instant_damage` | Instant damage |
| `jump_boost` | Higher jumps |
| `regeneration` | Health regeneration |
| `resistance` | Damage resistance |
| `fire_resistance` | Fire immunity |
| `water_breathing` | Underwater breathing |
| `invisibility` | Invisibility |
| `night_vision` | See in dark |
| `saturation` | Food bar restoration |

---

## Experience Commands

| Command | Description | Example |
|---------|-------------|---------|
| `xp add <player> <amount>` | Add experience points | `xp add Steve 1000` |
| `xp add <player> <amount> levels` | Add experience levels | `xp add Steve 30 levels` |
| `xp set <player> <amount>` | Set experience points | `xp set Steve 0` |
| `xp query <player> points` | Query XP points | `xp query Steve points` |
| `xp query <player> levels` | Query XP levels | `xp query Steve levels` |

---

## Advanced Commands

### Execute Command

Run commands with specific context:

```bash
# Run as another player
> execute as Steve run say Hello from Steve!

# Run at location
> execute positioned 0 64 0 run summon lightning_bolt

# Run if condition met
> execute if entity @a[distance=..10] run say Someone is nearby!
```

### Scoreboard

Track and display values:

```bash
# Create objective
> scoreboard objectives add kills playerKillCount

# Display in sidebar
> scoreboard objectives setdisplay sidebar kills

# Set score
> scoreboard players set Steve kills 10

# Query score
> scoreboard players get Steve kills
```

### Data Commands

Modify entity/block NBT data:

```bash
# View player data
> data get entity Steve

# Modify entity data
> data modify entity Steve Health set value 20.0f
```

---

## Help Commands

| Command | Description |
|---------|-------------|
| `help` | List all available commands |
| `help <command>` | Show usage for specific command |
| `help <page>` | Show help page (1-8) |

```bash
> help tp
/tp <destination>
/tp <location>
/tp <targets> <destination>
/tp <targets> <location>
...
```

---

## Error Handling

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| `Unknown command` | Typo or invalid command | Check spelling, use `help` |
| `Player not found` | Player offline or wrong name | Verify player is online |
| `Expected whitespace` | Missing space in command | Check command syntax |
| `Not a valid number` | Wrong argument type | Use correct data type |

### Server Not Running Error

```bash
$ mcctl rcon myserver
Server 'myserver' is not running
Start the server first: mcctl start myserver
```

---

## Reference

- Full Minecraft commands: [Minecraft Wiki - Commands](https://minecraft.wiki/w/Commands)
- Java Edition command syntax: [Command Syntax](https://minecraft.wiki/w/Commands#Syntax)
- Target selectors: [Target Selector](https://minecraft.wiki/w/Target_selectors)
- NBT format: [NBT Format](https://minecraft.wiki/w/NBT_format)
