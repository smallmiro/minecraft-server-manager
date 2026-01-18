# Docker Minecraft Server Documentation Update

This command reads the official itzg/docker-minecraft-server documentation and updates the docs/itzg-reference/ directory to keep it current.

## Procedure

1. **Source Documentation URLs** (see docs/itzg-reference/doc-list.md):

### Basic Documentation
- https://docker-minecraft-server.readthedocs.io/en/latest/
- https://docker-minecraft-server.readthedocs.io/en/latest/data-directory/
- https://docker-minecraft-server.readthedocs.io/en/latest/variables/

### Configuration
- https://docker-minecraft-server.readthedocs.io/en/latest/configuration/auto-rcon-commands/
- https://docker-minecraft-server.readthedocs.io/en/latest/configuration/interpolating/
- https://docker-minecraft-server.readthedocs.io/en/latest/configuration/jvm-options/
- https://docker-minecraft-server.readthedocs.io/en/latest/configuration/misc-options/
- https://docker-minecraft-server.readthedocs.io/en/latest/configuration/server-properties/

### Types and Platforms
- https://docker-minecraft-server.readthedocs.io/en/latest/types-and-platforms/
- https://docker-minecraft-server.readthedocs.io/en/latest/types-and-platforms/server-types/paper/
- https://docker-minecraft-server.readthedocs.io/en/latest/types-and-platforms/server-types/forge/
- https://docker-minecraft-server.readthedocs.io/en/latest/types-and-platforms/server-types/fabric/
- https://docker-minecraft-server.readthedocs.io/en/latest/types-and-platforms/mod-platforms/auto-curseforge/
- https://docker-minecraft-server.readthedocs.io/en/latest/types-and-platforms/mod-platforms/modrinth-modpacks/

### Mods and Plugins
- https://docker-minecraft-server.readthedocs.io/en/latest/mods-and-plugins/
- https://docker-minecraft-server.readthedocs.io/en/latest/mods-and-plugins/modrinth/
- https://docker-minecraft-server.readthedocs.io/en/latest/mods-and-plugins/curseforge-files/

### Misc
- https://docker-minecraft-server.readthedocs.io/en/latest/misc/examples/
- https://docker-minecraft-server.readthedocs.io/en/latest/misc/healthcheck/
- https://docker-minecraft-server.readthedocs.io/en/latest/misc/world-data/
- https://docker-minecraft-server.readthedocs.io/en/latest/misc/autopause-autostop/autopause/
- https://docker-minecraft-server.readthedocs.io/en/latest/misc/autopause-autostop/autostop/
- https://docker-minecraft-server.readthedocs.io/en/latest/misc/deployment/
- https://docker-minecraft-server.readthedocs.io/en/latest/misc/troubleshooting/

### Commands
- https://docker-minecraft-server.readthedocs.io/en/latest/sending-commands/commands/
- https://docker-minecraft-server.readthedocs.io/en/latest/sending-commands/ssh/
- https://docker-minecraft-server.readthedocs.io/en/latest/sending-commands/websocket/

### Versions
- https://docker-minecraft-server.readthedocs.io/en/latest/versions/java/

2. **Target Files**:
   - docs/itzg-reference/01-getting-started.md
   - docs/itzg-reference/02-data-directory.md
   - docs/itzg-reference/03-variables.md
   - docs/itzg-reference/04-server-properties.md
   - docs/itzg-reference/05-jvm-options.md
   - docs/itzg-reference/06-types-and-platforms.md
   - docs/itzg-reference/07-java-versions.md
   - docs/itzg-reference/08-mods-and-plugins.md
   - docs/itzg-reference/09-configuration.md
   - docs/itzg-reference/10-commands.md
   - docs/itzg-reference/11-autopause-autostop.md
   - docs/itzg-reference/12-healthcheck.md
   - docs/itzg-reference/13-deployment.md
   - docs/itzg-reference/14-world-data.md
   - docs/itzg-reference/15-troubleshooting.md
   - docs/itzg-reference/16-examples.md

3. **Tasks**:
   - Use WebFetch to read the above URLs and check for new environment variables, options, or examples
   - Update corresponding docs/itzg-reference/ files if changes are found
   - Reflect any new features or server types that have been added
   - Maintain existing format (environment variable tables, example code blocks) while updating

## Update Principles

- **Configuration-focused**: Organize around environment variables and docker-compose examples
- **Maintain format**: Keep existing document structure and style
- **English**: All descriptions should be written in English
- **Change log**: Notify user of significant changes

## Execution

When this command is executed, it will sequentially check the above URLs and update any documents with changes.
