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
| **v5** | Jun/2026 | LXC `192.168.50.151` | SRS + Caddy HTTPS automático via Smallstep CA próprio (`wcrpc.lan`) |
| **v6** ✅ atual | Ago/2026 | LXC `192.168.50.151` | SRS + Caddy HTTPS com certificado público Let's Encrypt (`wccosta.com.br`) |

Toda configuração de cada versão está preservada nas pastas correspondentes.

---

## Arquitetura atual (v6 — SRS + Caddy + Let's Encrypt)

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
     │  caddy:alpine   │  cert manual Let's Encrypt (wccosta.com.br)
     └────────┬────────┘
              │
     ┌────────▼────────┐     ┌────────────────────┐
     │    Browser      │     │  step-ca (CT 101)   │
     │  /cameras.html  │     │  192.168.50.19:9000 │
     └─────────────────┘     │  Let's Encrypt + Azure DNS       │
                             └────────────────────┘
Gravações → /var/records
```

## URLs atuais (v6)

| Serviço | URL | Auth |
|---|---|---|
| **Painel câmeras** | `https://cameras.wccosta.com.br/cameras.html` | ✅ |
| **Dashboard SRS** | `https://cameras.wccosta.com.br/` | ✅ |
| **HLS** | `https://cameras.wccosta.com.br/live/cameraN.m3u8` | ✅ |
| **API stats** | `https://cameras.wccosta.com.br/api/v1/streams/` | ✅ |
| **RTMP ingest** | `rtmp://192.168.50.151:1935/live/cameraN` | ❌ aberto |

## Infraestrutura atual

| Componente | VMID | IP | Função |
|---|---|---|---|
| Proxmox host | — | `192.168.50.250` | Hypervisor |
| **rtmp-lxc** | CT 201 | `192.168.50.151` | Servidor RTMP (SRS + Caddy) |
| **ca-server** | CT 101 | `192.168.50.19` | Smallstep CA — certs `wcrpc.lan` (legado) |
| **certbot-az** | CT 101 | `192.168.50.19` | Emissão de certificados Let's Encrypt via Azure DNS |
| Template Cloud-Init | VM 9000 | — | Base para Terraform (manter) |

## Trocar senha (v6)

```bash
HASH=$(pct exec 201 -- docker run --rm caddy:alpine caddy hash-password --plaintext 'SUASENHA')
pct exec 201 -- sed -i "s|admin .*|admin $HASH|" /opt/srs/Caddyfile
pct exec 201 -- docker exec rtmp-caddy caddy reload --config /etc/caddy/Caddyfile
```

---

## 📝 Evoluções Recentes

| Data | Melhoria | Detalhes |
|---|---|---|
| 11 Jun | **🔧 Correção IP CA** | IP do `ca-server` corrigido de `192.168.50.14` → `192.168.50.19` (CT 101 mudou de IP) |
| 11 Jun | **⚡ Otimização Recursos** | CT 101 reduzido de 512 MB → **256 MB RAM** (uso real ~30 MB) |
| 11 Jun | **🔑 Script Troca Senha** | Criado `~/trocar-senha-cameras.sh` para trocar senha do painel interativamente |
| 11 Jun | **🖥️ VM Windows Teste** | Criada VM 200 (`win10-test`) com 8 GB RAM para testes em Proxmox |
| 11 Jun | **📊 Infra Dashboard** | Portal `https://cameras.wccosta.com.br` 100% funcional com HTTPS + autenticação |

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

---

## 🎯 Otimizações de CPU e RAM (11 Jun 2026)

| Container | CPU Antes | CPU Depois | RAM Antes | RAM Depois | Economia |
|---|---|---|---|---|---|
| **CT 101** (ca-server) | 1 core | 1 core | 512 MB | **256 MB** | 256 MB |
| **CT 201** (rtmp-lxc) | 2 cores | **1 core** | 512 MB | **384 MB** | 1 core + 128 MB |

**Total economizado no host Proxmox:**
- 🧠 **RAM:** 384 MB liberados
- ⚡ **CPU:** 1 core liberado

> ✅ Serviços continuam 100% funcionais com margem de segurança

---

## 🗑️ Exclusões (11 Jun 2026)

| Item | Motivo | Espaço Liberado |
|---|---|---|
| **CT 103** (adguard-home) | Não utilizado, estava parado | **~58 GB** |

> Nota: Container AdGuard Home foi removido após análise de utilização. Não havia dados relevantes.

---

## 📊 Monitoramento Netdata (11 Jun 2026)

Dashboard de monitoramento instalado no host Proxmox.

**Acesso:** `http://192.168.50.250:19999`

### O que monitora:
- 🖥️ **Host Proxmox:** CPU, RAM, disco, rede, temperatura
- 🐳 **Containers LXC:** CT 101 (ca-server), CT 201 (rtmp-lxc)
- 💻 **VMs:** VM 200 (win10-test) e outras
- 📈 **Processos:** Uso em tempo real
- 🔔 **Alertas:** Configuráveis (Discord, Telegram, Email)

### Comandos úteis:
```bash
# Status do serviço
systemctl status netdata

# Restart
systemctl restart netdata

# Ver logs
journalctl -u netdata -f
```

> Instalado via script oficial: https://my-netdata.io/

---

## 🔌 Configuração Power Management (11 Jun 2026)

Configuração para manter o Proxmox ligado ao fechar a tampa do notebook.

**Arquivo:** `/etc/systemd/logind.conf`

```ini
HandleLidSwitch=ignore
HandleLidSwitchExternalPower=ignore
HandleLidSwitchDocked=ignore
```

**Aplicar alterações:**
```bash
systemctl restart systemd-logind
```

> ⚠️ Com a tampa fechada, garantir boa ventilação para evitar superaquecimento.

---

## 💿 ISOs e Templates Armazenados

**Local:** `/var/lib/vz/template/iso/`

| Arquivo | Tamanho | Uso |
|---|---|---|
| `ubuntu-26.04-live-server-amd64.iso` | 2.8 GB | Instalação Ubuntu Server (VMs 100) |
| `ubuntu-26.04-desktop-amd64.iso` | 6.1 GB | Instalação Ubuntu Desktop (VM 102) |
| `Windows_10_AIO_1903_64_Bits__2019.iso` | 4.7 GB | Instalação Windows 10 (VM 200) |
| `virtio-win.iso` | 754 MB | Drivers VirtIO para Windows |
| `nginx-rtmp-cameras-disk1.vmdk` | 18 GB | OVA antiga (pode remover) |
| `nginx-rtmp-cameras-file1.iso` | 2.6 GB | OVA antiga (pode remover) |
| `nginx-rtmp-cameras.ovf` | 15 KB | OVA antiga (pode remover) |
| `nginx-rtmp-cameras.mf` | 409 B | OVA antiga (pode remover) |

**Total ocupado:** ~34 GB

### 🧹 Limpeza possível:
```bash
# Remover arquivos OVA antigos (~21 GB)
rm -f /var/lib/vz/template/iso/nginx-rtmp-cameras*
```

> ⚠️ Os arquivos `nginx-rtmp-cameras*` são de uma exportação OVA antiga. Podem ser removidos se não forem mais necessários.
