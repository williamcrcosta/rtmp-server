# RTMP Server — Câmeras IP

Servidor RTMP para recebimento e transmissão de câmeras via HLS, com interface web, gravação automática e autenticação básica.

## Arquitetura

```
Câmera / OBS / FFmpeg
        │
        │  RTMP  rtmp://servidor:1935/live/camera1
        ▼
┌──────────────────────────┐
│   nginx + rtmp-module    │  Docker container
│                          │
│  :1935  RTMP ingest      │
│  :80    HTTP interno     │
└────────────┬─────────────┘
             │
    ┌────────┴─────────┐
    │                  │
    ▼                  ▼
/var/www/html/hls   /var/records
 (HLS tmpfs)         (gravações .flv)
    │
    ▼
Browser (HLS.js)
http://servidor:8080/
```

## Pré-requisitos

- Docker e docker-compose-v2
- `apache2-utils` (para htpasswd)
- Portas `1935/tcp` e `8080/tcp` abertas

## Deploy rápido (nova VM)

```bash
# 1. Instalar dependências e subir servidor em um comando
curl -fsSL https://raw.githubusercontent.com/williamcrcosta/rtmp-server/main/scripts/deploy.sh | bash
```

Ou manualmente:

```bash
# 1. Clonar repositório
git clone https://github.com/williamcrcosta/rtmp-server.git
cd rtmp-server

# 2. Criar autenticação
apt install -y apache2-utils
htpasswd -c /etc/nginx/.htpasswd admin

# 3. Criar diretório de gravações
mkdir -p /var/records

# 4. Subir container
docker compose -f docker/docker-compose.yml up -d
```

## URLs após deploy

| Serviço | URL |
|---|---|
| Interface web | `http://IP:8080/` |
| Estatísticas RTMP | `http://IP:8080/stat` |
| Gravações | `http://IP:8080/recordings` |
| HLS stream | `http://IP:8080/hls/camera1.m3u8` |
| Publicação RTMP | `rtmp://IP:1935/live/camera1` |
| Publicação RTMP | `rtmp://IP:1935/live/camera2` |

## Enviar stream das câmeras

**OBS Studio:**
```
Settings → Stream → Service: Custom
Server: rtmp://IP:1935/live
Stream Key: camera1
```

**FFmpeg:**
```bash
ffmpeg -i /dev/video0 -c:v libx264 -f flv rtmp://IP:1935/live/camera1
```

**IP Cam (RTSP → RTMP via FFmpeg):**
```bash
ffmpeg -i rtsp://usuario:senha@IP_CAMERA/stream -c copy -f flv rtmp://IP:1935/live/camera1
```

## Deploy via Ansible

```bash
# Instalar Ansible
pip install ansible

# Editar inventário
cp ansible/inventory.example.ini ansible/inventory.ini
# Ajustar IP e usuário

# Rodar playbook
ansible-playbook -i ansible/inventory.ini ansible/playbook.yml \
  -e htpasswd_password=SUA_SENHA_AQUI
```

## Estrutura do repositório

```
.
├── docker/
│   ├── docker-compose.yml   ← definição dos serviços
│   ├── nginx.conf           ← config RTMP + HTTP
│   └── index.html           ← interface web das câmeras
├── ansible/
│   ├── inventory.example.ini
│   └── playbook.yml
├── scripts/
│   ├── deploy.sh            ← deploy em um comando
│   └── backup-runtime-data.sh
├── docs/
│   ├── arquitetura.md
│   ├── migracao.md
│   └── inventario-vm-antiga.md
├── nginx/                   ← config original (bare metal)
├── systemd/                 ← unit file original
├── .env.example
├── .gitignore
└── README.md
```

## Segurança

Nunca versionar:
- `.htpasswd`
- `.env`
- Gravações `.flv`
- Segmentos HLS `.ts` / `.m3u8`
