# Issue: mcctl admin init Command

## Phase
8.2.1 - CLI Admin Commands

## Title
feat(cli): Add `mcctl admin init` command for Admin Service initialization

## Description
Implement an interactive `mcctl admin init` command for Admin Service initial setup.

## Prerequisites
- #8.1.1 IUserRepository port definition
- #8.1.2 YamlUserRepository adapter implementation

## Tasks
- [ ] `src/commands/admin/index.ts` - Main router
- [ ] `src/commands/admin/init.ts` - Init command
- [ ] Create `.mcctl-admin.yml` configuration file
- [ ] Admin account creation prompt
- [ ] API access mode selection
- [ ] Auto-generate API key
- [ ] `src/lib/admin-config.ts` - Configuration management
- [ ] Add admin routing to index.ts
- [ ] Tests

## Interactive Flow

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

## Generated Configuration File

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

## Related Documents
- [mcctl-api PRD](../../platform/services/mcctl-api/prd.md) - Section 4

## Labels
- `phase:8-admin`
- `type:feature`
- `package:cli`
