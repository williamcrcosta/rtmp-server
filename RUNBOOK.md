# RUNBOOK — RTMP Camera Server

Guia operacional completo. Tudo que você precisa saber para rodar, recuperar e expandir o servidor.

---

## Ambiente atual (Jun/2026)

| Componente | Valor |
|---|---|
| **Proxmox host** | `192.168.50.250` |
| **LXC container (atual)** | CT 201 — `192.168.50.151` — Ubuntu 26.04 |
| **VM legada (SRS)** | `192.168.50.150` — Ubuntu 26.04 |
| **VM antiga (nginx-rtmp)** | `192.168.50.12` — ainda ligada |
| **Repo GitHub** | https://github.com/williamcrcosta/rtmp-server |
| **Câmeras** | Intelbras iM7 3MP via app Mibo |
| **Protocolo ingest** | RTMP via "Live Streaming" no app Mibo |

---

## Acesso ao servidor

```bash
# Shell do Proxmox
ssh root@192.168.50.250

# Shell do LXC direto
pct enter 201

# ou via SSH (se configurado)
ssh root@192.168.50.151
```

---

## URLs do painel

| Serviço | URL | Auth |
|---|---|---|
| Painel câmeras | `http://192.168.50.151:8888/cameras.html` | ✅ admin + senha |
| Dashboard SRS | `http://192.168.50.151:8888/` | ✅ admin + senha |
| HLS camera1 | `http://192.168.50.151:8888/live/camera1.m3u8` | ✅ |
| HLS camera2 | `http://192.168.50.151:8888/live/camera2.m3u8` | ✅ |
| API stats | `http://192.168.50.151:8888/api/v1/streams/` | ✅ |
| RTMP ingest | `rtmp://192.168.50.151:1935/live/cameraN` | ❌ aberto |

---

## Configurar câmeras (app Mibo)

```
Mibo → câmera → Live Streaming
URL: rtmp://192.168.50.151:1935/live/camera1
```

> ⚠️ O app Mibo limita a resolução do stream no modo Live Streaming (~640x480).
> Para qualidade HD nativa, use câmeras com RTSP local (ex: Intelbras linha VIP).

---

## Operações do dia a dia

### Ver status geral
```bash
pct exec 201 -- bash -c "docker ps && docker stats --no-stream"
```

### Ver logs em tempo real
```bash
pct exec 201 -- docker compose -f /opt/srs/docker-compose.yml logs -f
```

### Reiniciar a stack
```bash
pct exec 201 -- bash -c "cd /opt/srs && docker compose restart"
```

### Verificar streams ativos
```bash
curl -s -u 'admin:SENHA' http://192.168.50.151:8888/api/v1/streams/ | python3 -m json.tool
```

### Trocar senha do painel
```bash
pct exec 201 -- htpasswd /etc/nginx/.htpasswd admin
# digita a nova senha quando solicitado
```

### Ver gravações
```bash
pct exec 201 -- ls -lh /var/records/
```

---

## Recuperação após falhas

### Container LXC não responde
```bash
# No Proxmox
pct stop 201
pct start 201
sleep 10
pct exec 201 -- docker ps
```

### Containers Docker não subiram após reboot
```bash
pct exec 201 -- bash -c "cd /opt/srs && RECORDS_PATH=/var/records docker compose up -d"
```

### Rede não funciona após reboot
```bash
pct exec 201 -- bash -c "
ip link set eth0 up
ip addr add 192.168.50.151/24 dev eth0 2>/dev/null || true
ip route add default via 192.168.50.254 2>/dev/null || true
echo 'nameserver 8.8.8.8' > /etc/resolv.conf
"
```

### Painel retorna 502 Bad Gateway
O SRS não está respondendo. Reinicia:
```bash
pct exec 201 -- bash -c "cd /opt/srs && docker compose restart srs"
```

### Painel retorna 401 mesmo com senha correta
Provavelmente o htpasswd foi resetado. Recria:
```bash
pct exec 201 -- bash -c "mkdir -p /etc/nginx && htpasswd -cb /etc/nginx/.htpasswd admin SUASENHA"
pct exec 201 -- bash -c "cd /opt/srs && docker compose restart nginx-proxy"
```

---

## Recriar do zero (disaster recovery)

Se precisar recriar tudo do zero no Proxmox:

```bash
# 1. Destruir container atual (se existir)
pct stop 201 && pct destroy 201

# 2. Clonar repo
git clone https://github.com/williamcrcosta/rtmp-server.git
cd rtmp-server

# 3. Editar variáveis (IP, gateway, senha)
nano lxc/create-lxc.sh

# 4. Rodar script
bash lxc/create-lxc.sh
```

Tempo estimado: ~5 minutos.

---

## Atualizar configuração do SRS

Após alterar `srs/srs.conf` ou `srs/nginx-proxy/nginx.conf` no repo:

```bash
# No Proxmox
pct exec 201 -- bash -c "
cd /opt/srs
git pull  # se o repo estiver clonado aqui
docker compose restart
"

# Ou copiar arquivos manualmente
pct push 201 ./srs/srs.conf /opt/srs/srs.conf
pct exec 201 -- bash -c "cd /opt/srs && docker compose restart srs"
```

---

## Adicionar mais câmeras

1. No app Mibo, configure "Live Streaming" com:
   ```
   rtmp://192.168.50.151:1935/live/camera3
   ```

2. No painel `cameras.html`, adicione a câmera no array `CAMERAS`:
   ```js
   const CAMERAS = [
     { id: 'camera1', label: 'Câmera 1' },
     { id: 'camera2', label: 'Câmera 2' },
     { id: 'camera3', label: 'Câmera 3' },  // ← adiciona aqui
   ];
   ```

3. Copia o arquivo atualizado para o container:
   ```bash
   pct push 201 ./srs/index.html /opt/srs/index.html
   pct exec 201 -- docker compose -f /opt/srs/docker-compose.yml restart srs
   ```

---

## Verificação de saúde completa

```bash
pct exec 201 -- bash -c "
echo '=== Serviços ==='
systemctl is-active docker srs-stack

echo '=== Containers ==='
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'

echo '=== Recursos ==='
free -h
df -h | grep -E '/$|records'
docker stats --no-stream --format 'table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}'

echo '=== Auth ==='
curl -s -o /dev/null -w 'Sem auth: %{http_code}\n' http://localhost:8888/
nc -zv localhost 1935 2>&1 | grep -o 'succeeded\|failed' | xargs echo 'RTMP 1935:'
"
```

---

## Estrutura de arquivos no container

```
/opt/srs/
├── docker-compose.yml     ← SRS + Nginx proxy
├── srs.conf               ← configuração SRS
├── index.html             ← painel multi-câmera
└── nginx-proxy/
    └── nginx.conf         ← proxy reverso + Basic Auth

/etc/nginx/.htpasswd       ← credenciais do painel
/var/records/              ← gravações DVR
/etc/systemd/system/srs-stack.service  ← autostart
```

---

## Histórico de versões

| Data | Mudança |
|---|---|
| Jun/2026 | VM antiga nginx-rtmp bare metal (`192.168.50.12`) |
| Jun/2026 | Migração para Docker nginx-rtmp (`docker/`) |
| Jun/2026 | Migração para SRS em VM via Terraform (`192.168.50.150`) |
| Jun/2026 | Migração para SRS em LXC Ubuntu 26.04 (`192.168.50.151`) — **atual** |
