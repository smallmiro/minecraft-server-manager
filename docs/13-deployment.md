# Deployment

How to deploy Docker Minecraft Server in various environments.

## Docker Compose (Default)

### Basic Deployment

```yaml
services:
  mc:
    image: itzg/minecraft-server
    tty: true
    stdin_open: true
    restart: unless-stopped
    environment:
      EULA: "TRUE"
      TYPE: "PAPER"
      VERSION: "1.20.4"
      MEMORY: "4G"
    ports:
      - "25565:25565"
    volumes:
      - ./data:/data
```

### Production Deployment

```yaml
services:
  mc:
    image: itzg/minecraft-server
    tty: true
    stdin_open: true
    restart: unless-stopped
    environment:
      EULA: "TRUE"
      TYPE: "PAPER"
      VERSION: "1.20.4"
      MEMORY: "8G"
      USE_AIKAR_FLAGS: "true"
      RCON_PASSWORD_FILE: /run/secrets/rcon_password
      TZ: "Asia/Seoul"
    ports:
      - "25565:25565"
    volumes:
      - mc-data:/data
    secrets:
      - rcon_password
    deploy:
      resources:
        limits:
          memory: 10G

secrets:
  rcon_password:
    file: ./secrets/rcon_password.txt

volumes:
  mc-data:
```

---

## Kubernetes

### Helm Chart

Using the itzg Helm Chart:

```bash
# Add repository
helm repo add itzg https://itzg.github.io/minecraft-server-charts/
helm repo update

# Install
helm install mc itzg/minecraft \
  --set minecraftServer.eula=true \
  --set minecraftServer.type=PAPER \
  --set minecraftServer.version=1.20.4
```

### values.yaml Example

```yaml
minecraftServer:
  eula: "TRUE"
  type: PAPER
  version: "1.20.4"
  memory: 4096M
  difficulty: normal
  maxPlayers: 50
  motd: "Welcome to Kubernetes Minecraft!"

resources:
  requests:
    memory: 4Gi
    cpu: 1000m
  limits:
    memory: 6Gi
    cpu: 2000m

persistence:
  dataDir:
    enabled: true
    size: 10Gi
    storageClass: standard

service:
  type: LoadBalancer
  port: 25565
```

### Manual Deployment (Manifests)

```yaml
# deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: minecraft
spec:
  replicas: 1
  selector:
    matchLabels:
      app: minecraft
  template:
    metadata:
      labels:
        app: minecraft
    spec:
      containers:
        - name: minecraft
          image: itzg/minecraft-server
          env:
            - name: EULA
              value: "TRUE"
            - name: TYPE
              value: "PAPER"
            - name: MEMORY
              value: "4G"
          ports:
            - containerPort: 25565
          volumeMounts:
            - name: data
              mountPath: /data
          resources:
            requests:
              memory: "4Gi"
              cpu: "1000m"
            limits:
              memory: "6Gi"
              cpu: "2000m"
      volumes:
        - name: data
          persistentVolumeClaim:
            claimName: minecraft-data
---
# pvc.yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: minecraft-data
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 10Gi
---
# service.yaml
apiVersion: v1
kind: Service
metadata:
  name: minecraft
spec:
  type: LoadBalancer
  ports:
    - port: 25565
      targetPort: 25565
  selector:
    app: minecraft
```

### Shulker Operator

For complex Minecraft infrastructure management:

```yaml
apiVersion: shulkermc.io/v1alpha1
kind: MinecraftServer
metadata:
  name: my-server
spec:
  clusterRef:
    name: my-cluster
  version:
    channel: Paper
    name: "1.20.4"
```

---

## Ansible

### MASH Playbook

```yaml
# inventory/host_vars/server.yml
minecraft_enabled: true
minecraft_identifier: minecraft
minecraft_hostname: mc.example.com
minecraft_version: "1.20.4"
minecraft_type: PAPER
minecraft_memory: 4G
minecraft_eula: "TRUE"
minecraft_max_players: 50
```

### Custom Playbook

```yaml
# playbook.yml
- hosts: minecraft
  tasks:
    - name: Create minecraft directory
      file:
        path: /opt/minecraft
        state: directory

    - name: Deploy docker-compose
      template:
        src: docker-compose.yml.j2
        dest: /opt/minecraft/docker-compose.yml

    - name: Start minecraft server
      community.docker.docker_compose:
        project_src: /opt/minecraft
        state: present
```

---

## AWS

### CloudFormation

Cost-effective deployment using Spot instances:

```yaml
AWSTemplateFormatVersion: '2010-09-09'
Resources:
  MinecraftInstance:
    Type: AWS::EC2::SpotFleet
    Properties:
      SpotFleetRequestConfigData:
        IamFleetRole: !GetAtt SpotFleetRole.Arn
        TargetCapacity: 1
        LaunchSpecifications:
          - ImageId: ami-xxxxxxxx
            InstanceType: t3.medium
            UserData:
              Fn::Base64: |
                #!/bin/bash
                yum install -y docker
                systemctl start docker
                docker run -d -p 25565:25565 -e EULA=TRUE itzg/minecraft-server
```

### ECS

```yaml
# task-definition.json
{
  "family": "minecraft",
  "containerDefinitions": [
    {
      "name": "minecraft",
      "image": "itzg/minecraft-server",
      "memory": 4096,
      "cpu": 1024,
      "essential": true,
      "portMappings": [
        {
          "containerPort": 25565,
          "hostPort": 25565
        }
      ],
      "environment": [
        {"name": "EULA", "value": "TRUE"},
        {"name": "TYPE", "value": "PAPER"},
        {"name": "MEMORY", "value": "3G"}
      ],
      "mountPoints": [
        {
          "sourceVolume": "minecraft-data",
          "containerPath": "/data"
        }
      ]
    }
  ],
  "volumes": [
    {
      "name": "minecraft-data",
      "efsVolumeConfiguration": {
        "fileSystemId": "fs-xxxxxxxx"
      }
    }
  ]
}
```

---

## Raspberry Pi

### Requirements

- Raspberry Pi 4 (4GB+ RAM recommended)
- 64-bit OS
- Docker installed

### Configuration

```yaml
services:
  mc:
    image: itzg/minecraft-server:java17
    environment:
      EULA: "TRUE"
      TYPE: "PAPER"
      VERSION: "1.20.4"
      MEMORY: "2G"
      USE_AIKAR_FLAGS: "true"
      VIEW_DISTANCE: "8"
      SIMULATION_DISTANCE: "6"
    ports:
      - "25565:25565"
    volumes:
      - ./data:/data
    restart: unless-stopped
```

### Performance Optimization

```yaml
environment:
  MEMORY: "2G"
  VIEW_DISTANCE: "6"
  SIMULATION_DISTANCE: "4"
  MAX_PLAYERS: "10"
  SPAWN_MONSTERS: "true"
  SPAWN_ANIMALS: "true"
```

---

## Port Forwarding

Router configuration for external access:

1. Access router admin page
2. Configure port forwarding
3. Map external port `25565` to internal IP port `25565`
4. Select TCP protocol

### Dynamic DNS

Use DDNS services if you don't have a static IP:
- No-IP
- DuckDNS
- Cloudflare

---

## Backup

### Automatic Backup Script

```bash
#!/bin/bash
BACKUP_DIR="/backups/minecraft"
DATA_DIR="/opt/minecraft/data"
DATE=$(date +%Y%m%d_%H%M%S)

# Save command to server
docker exec mc rcon-cli save-all

# Create backup
tar -czf "$BACKUP_DIR/minecraft_$DATE.tar.gz" "$DATA_DIR"

# Delete backups older than 7 days
find "$BACKUP_DIR" -name "*.tar.gz" -mtime +7 -delete
```

### Cron Setup

```bash
# crontab -e
0 */6 * * * /opt/minecraft/backup.sh
```
