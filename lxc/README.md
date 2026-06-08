# Proxmox LXC — RTMP Server

Deploy do servidor RTMP em container LXC no Proxmox, usando Ubuntu 26.04 e Docker.

## Por que LXC em vez de VM?

| | VM | LXC |
|---|---|---|
| **Overhead RAM** | ~200MB (kernel próprio) | ~50MB (kernel compartilhado) |
| **Boot** | ~30s | ~3s |
| **Docker** | Nativo | Requer `nesting=1` |
| **Recriar** | Terraform | `pct create` |

## Pré-requisitos

- Proxmox VE 7+ com acesso ao shell
- Storage `local-lvm` disponível
- Bridge `vmbr0` configurada
- IP livre na rede

## Deploy

```bash
# No shell do Proxmox — edite as variáveis no topo do script antes de rodar
bash lxc/create-lxc.sh
```

## Variáveis do script

| Variável | Padrão | Descrição |
|---|---|---|
| `CT_ID` | `201` | ID do container no Proxmox |
| `CT_IP` | `192.168.50.151/24` | IP fixo |
| `CT_GW` | `192.168.50.254` | Gateway |
| `CT_BRIDGE` | `vmbr0` | Bridge de rede |
| `CT_MEMORY` | `512` | RAM em MB |
| `CT_CORES` | `2` | vCPUs |
| `CT_DISK` | `local-lvm:8` | Storage:tamanho em GB |
| `RECORDS_PATH` | `/var/records` | Diretório de gravações |

## Gerenciar o container

```bash
pct status 201
pct start 201
pct stop 201
pct enter 201                          # acesso ao shell

# Ver logs
pct exec 201 -- docker compose -f /opt/rtmp-server/srs/docker-compose.yml logs -f

# Trocar senha
pct exec 201 -- htpasswd /etc/nginx/.htpasswd admin

# Destruir
pct stop 201 && pct destroy 201
```

## URLs

| Serviço | URL |
|---|---|
| **Painel** | `http://IP:8888/cameras.html` 🔒 |
| **Dashboard SRS** | `http://IP:8888/` 🔒 |
| **RTMP ingest** | `rtmp://IP:1935/live/cameraN` |
