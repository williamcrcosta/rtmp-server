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

---

## Evolução do projeto

| Versão | Data | Onde roda | Descrição |
|---|---|---|---|
| **v1** | Jun/2026 | VM `192.168.50.12` | Nginx + RTMP module bare metal — config em `nginx/` e `systemd/` |
| **v2** | Jun/2026 | Qualquer host Docker | Container `tiangolo/nginx-rtmp` — config em `docker/` |
| **v3** | Jun/2026 | VM `192.168.50.150` | SRS em VM via Terraform + Cloud-Init — config em `terraform/` e `srs/` |
| **v4** | Jun/2026 | LXC `192.168.50.151` | SRS + Nginx proxy + Basic Auth em Proxmox LXC Ubuntu 26.04 |
| **v5** ✅ atual | Jun/2026 | LXC `192.168.50.151` | SRS + Caddy HTTPS automático via Smallstep CA próprio (`wcrpc.lan`) |

Toda configuração de cada versão está preservada nas pastas correspondentes.

---

## Arquitetura atual (v5 — SRS + Caddy + step-ca)

```
App Mibo / OBS / FFmpeg / Câmera IP
              │
              │  RTMP  rtmp://192.168.50.151:1935/live/camera1
              ▼
     ┌─────────────────┐
     │   SRS Server    │  interno: 8080 / 1985
     │  ossrs/srs:5    │
     └────────┬────────┘
              │
     ┌────────▼────────┐
     │  Caddy Proxy    │  :80 redirect / :443 HTTPS + Basic Auth
     │  caddy:alpine   │  cert ACME ← step-ca (wcrpc.lan CA)
     └────────┬────────┘
              │
     ┌────────▼────────┐     ┌────────────────────┐
     │    Browser      │     │  step-ca (CT 101)   │
     │  /cameras.html  │     │  192.168.50.19:9000 │
     └─────────────────┘     │  CA wcrpc.lan       │
                             └────────────────────┘
Gravações → /var/records
```

## URLs atuais (v5)

| Serviço | URL | Auth |
|---|---|---|
| **Painel câmeras** | `https://cameras.wcrpc.lan/cameras.html` | ✅ |
| **Dashboard SRS** | `https://cameras.wcrpc.lan/` | ✅ |
| **HLS** | `https://cameras.wcrpc.lan/live/cameraN.m3u8` | ✅ |
| **API stats** | `https://cameras.wcrpc.lan/api/v1/streams/` | ✅ |
| **RTMP ingest** | `rtmp://192.168.50.151:1935/live/cameraN` | ❌ aberto |

## Infraestrutura atual

| Componente | VMID | IP | Função |
|---|---|---|---|
| Proxmox host | — | `192.168.50.250` | Hypervisor |
| **rtmp-lxc** | CT 201 | `192.168.50.151` | Servidor RTMP (SRS + Caddy) |
| **ca-server** | CT 101 | `192.168.50.19` | Smallstep CA — certs `wcrpc.lan` (3 meses) |
| Template Cloud-Init | VM 9000 | — | Base para Terraform (manter) |

## Trocar senha (v5)

```bash
HASH=$(pct exec 201 -- docker run --rm caddy:alpine caddy hash-password --plaintext 'SUASENHA')
pct exec 201 -- sed -i "s|admin .*|admin $HASH|" /opt/srs/Caddyfile
pct exec 201 -- docker exec rtmp-caddy caddy reload --config /etc/caddy/Caddyfile
```

---

## 📝 Evoluções Recentes (Jun/2026)

| Data | Melhoria | Detalhes |
|---|---|---|
| 11 Jun | **🔧 Correção IP CA** | IP do `ca-server` corrigido de `192.168.50.14` → `192.168.50.19` (CT 101 mudou de IP) |
| 11 Jun | **⚡ Otimização Recursos** | CT 101 reduzido de 512 MB → **256 MB RAM** (uso real ~30 MB) |
| 11 Jun | **🔑 Script Troca Senha** | Criado `~/trocar-senha-cameras.sh` para trocar senha do painel interativamente |
| 11 Jun | **🖥️ VM Windows Teste** | Criada VM 200 (`win10-test`) com 8 GB RAM para testes em Proxmox |
| 11 Jun | **📊 Infra Dashboard** | Portal `https://cameras.wcrpc.lan` 100% funcional com HTTPS + autenticação |

### Scripts Úteis Criados

**Trocar senha do painel:**
```bash
bash ~/trocar-senha-cameras.sh
```

**Verificar status dos serviços:**
```bash
pct list && qm list
pct exec 101 -- systemctl status step-ca --no-pager
pct exec 201 -- docker ps
```

---

## ⚡ Otimizações de Recursos (11 Jun 2026)

| Container | Antes | Depois | Uso Real | Economia |
|---|---|---|---|---|
| **CT 101** (ca-server) | 512 MB RAM | **256 MB RAM** | ~30 MB | 256 MB |
| **CT 201** (rtmp-lxc) | 512 MB RAM | **384 MB RAM** | ~140 MB | 128 MB |

**Total economizado:** 384 MB de RAM no host Proxmox
