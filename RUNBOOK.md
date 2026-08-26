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
| Painel câmeras | `https://cameras.wccosta.com.br/cameras.html` | ✅ admin + senha |
| Dashboard SRS | `https://cameras.wccosta.com.br/` | ✅ admin + senha |
| HLS camera1 | `https://cameras.wccosta.com.br/live/camera1.m3u8` | ✅ |
| HLS camera2 | `https://cameras.wccosta.com.br/live/camera2.m3u8` | ✅ |
| API stats | `https://cameras.wccosta.com.br/api/v1/streams/` | ✅ |
| RTMP ingest | `rtmp://192.168.50.151:1935/live/cameraN` | ❌ aberto |

> O DNS interno (AdGuard) resolve `cameras.wccosta.com.br` para `192.168.50.151`.

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
curl -s -k -u 'admin:SENHA' https://cameras.wccosta.com.br/api/v1/streams/ | python3 -m json.tool
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


## Certificados TLS (v6)

O painel de câmeras utiliza certificado público **Let’s Encrypt** para `cameras.wccosta.com.br`.

### Emitir ou renovar certificado

No `ca-server` (CT 101), o `certbot` está em `/opt/certbot/bin/certbot` e usa Azure DNS:

```bash
pct exec 101 -- bash -c "/opt/certbot/bin/certbot certonly \
  --authenticator dns-azure \
  --dns-azure-config /etc/letsencrypt/azure.ini \
  -d cameras.wccosta.com.br \
  -d adguard.wccosta.com.br \
  -d dashboard.wccosta.com.br \
  -d grafana.wccosta.com.br \
  -d longhorn.wccosta.com.br \
  -d pfsense-fw01.wccosta.com.br \
  -d prometheus.wccosta.com.br \
  -d argocd.wccosta.com.br \
  -d zabbix.wccosta.com.br \
  --agree-tos -n"
```

### Copiar certificado para o Caddy

```bash
pct exec 101 -- cat /etc/letsencrypt/live/cameras.wccosta.com.br/fullchain.pem > /tmp/fullchain.pem
pct exec 101 -- cat /etc/letsencrypt/live/cameras.wccosta.com.br/privkey.pem > /tmp/privkey.pem
pct exec 201 -- bash -c 'cat > /opt/srs/certs/fullchain.pem' < /tmp/fullchain.pem
pct exec 201 -- bash -c 'cat > /opt/srs/certs/privkey.pem' < /tmp/privkey.pem
pct exec 201 -- bash -c "cd /opt/srs && docker compose restart caddy"
```

### Renovação automática

```bash
pct exec 101 -- crontab -l
```

Agendamento:

```text
0 3 * * * /opt/certbot/bin/certbot renew --quiet
```


## Aplicar certificado em serviços RKE2

O certificado `san-wccosta-fullchain` é emitido no `ca-server` (CT 101) e replicado para os ingressos do RKE2.

### Arquivos no ca-server

```bash
/etc/letsencrypt/live/san-wccosta-fullchain/fullchain.pem
/etc/letsencrypt/live/san-wccosta-fullchain/privkey.pem
```

### Copiar certificado para o nó do RKE2

No Proxmox:

```bash
pct exec 101 -- cat /etc/letsencrypt/live/san-wccosta-fullchain/fullchain.pem > /tmp/wccosta-fullchain.pem
pct exec 101 -- cat /etc/letsencrypt/live/san-wccosta-fullchain/privkey.pem > /tmp/wccosta-privkey.pem
scp /tmp/wccosta-fullchain.pem root@192.168.50.20:/root/
scp /tmp/wccosta-privkey.pem root@192.168.50.20:/root/
```

### Criar secrets TLS e atualizar ingressos

Dentro do `rke2-cp-01` (`192.168.50.20`):

```bash
export PATH="$PATH:/var/lib/rancher/rke2/bin"
export KUBECONFIG=/etc/rancher/rke2/rke2.yaml

CERT=/root/wccosta-fullchain.pem
KEY=/root/wccosta-privkey.pem

for ns in kubernetes-dashboard longhorn-system monitoring platform-argocd zabbix; do
  kubectl -n "$ns" create secret tls wccosta-tls     --cert="$CERT" --key="$KEY"     --dry-run=client -o yaml | kubectl apply -f -
done

kubectl -n kubernetes-dashboard patch ingress kubernetes-dashboard --type='json' -p='[
  {"op": "replace", "path": "/spec/rules/0/host", "value": "dashboard.wccosta.com.br"},
  {"op": "replace", "path": "/spec/tls/0/hosts/0", "value": "dashboard.wccosta.com.br"},
  {"op": "replace", "path": "/spec/tls/0/secretName", "value": "wccosta-tls"}]'

kubectl -n longhorn-system patch ingress longhorn --type='json' -p='[
  {"op": "replace", "path": "/spec/rules/0/host", "value": "longhorn.wccosta.com.br"},
  {"op": "replace", "path": "/spec/tls/0/hosts/0", "value": "longhorn.wccosta.com.br"},
  {"op": "replace", "path": "/spec/tls/0/secretName", "value": "wccosta-tls"}]'

kubectl -n monitoring patch ingress monitoring-grafana --type='json' -p='[
  {"op": "replace", "path": "/spec/rules/0/host", "value": "grafana.wccosta.com.br"},
  {"op": "replace", "path": "/spec/tls/0/hosts/0", "value": "grafana.wccosta.com.br"},
  {"op": "replace", "path": "/spec/tls/0/secretName", "value": "wccosta-tls"}]'

kubectl -n monitoring patch ingress monitoring-kube-prometheus-prometheus --type='json' -p='[
  {"op": "replace", "path": "/spec/rules/0/host", "value": "prometheus.wccosta.com.br"},
  {"op": "replace", "path": "/spec/tls/0/hosts/0", "value": "prometheus.wccosta.com.br"},
  {"op": "replace", "path": "/spec/tls/0/secretName", "value": "wccosta-tls"}]'

kubectl -n platform-argocd patch ingress argocd --type='json' -p='[
  {"op": "replace", "path": "/spec/rules/0/host", "value": "argocd.wccosta.com.br"},
  {"op": "replace", "path": "/spec/tls/0/hosts/0", "value": "argocd.wccosta.com.br"},
  {"op": "replace", "path": "/spec/tls/0/secretName", "value": "wccosta-tls"}]'

kubectl -n zabbix patch ingress zabbix --type='json' -p='[
  {"op": "replace", "path": "/spec/rules/0/host", "value": "zabbix.wccosta.com.br"},
  {"op": "replace", "path": "/spec/tls/0/hosts/0", "value": "zabbix.wccosta.com.br"},
  {"op": "replace", "path": "/spec/tls/0/secretName", "value": "wccosta-tls"}]'

kubectl get ingress -A
```

### DNS interno (AdGuard)

Adicione os rewrites em `/opt/AdGuardHome/AdGuardHome.yaml` no CT 400:

```yaml
  rewrites:
    - domain: adguard.wccosta.com.br
      answer: 192.168.50.25
      enabled: true
    - domain: proxmox.wccosta.com.br
      answer: 192.168.50.250
      enabled: true
    - domain: dashboard.wccosta.com.br
      answer: 192.168.50.20
      enabled: true
    - domain: longhorn.wccosta.com.br
      answer: 192.168.50.20
      enabled: true
    - domain: grafana.wccosta.com.br
      answer: 192.168.50.20
      enabled: true
    - domain: prometheus.wccosta.com.br
      answer: 192.168.50.20
      enabled: true
    - domain: argocd.wccosta.com.br
      answer: 192.168.50.20
      enabled: true
    - domain: zabbix.wccosta.com.br
      answer: 192.168.50.20
      enabled: true
```

Depois:

```bash
systemctl restart AdGuardHome
```

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
curl -s -k -o /dev/null -w 'Sem auth: %{http_code}\n' https://localhost/
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
| Jun/2026 | Migração para SRS em LXC Ubuntu 26.04 (`192.168.50.151`) |
| Ago/2026 | Certificado Let’s Encrypt via Azure DNS para `cameras.wccosta.com.br` e demais subdomínios — **atual** |

---

## Nota: srs-stack.service autostart

O serviço systemd `srs-stack.service` foi configurado com `Type=oneshot` + `RemainAfterExit=yes` e sobe os containers via `docker compose up -d` no boot.

> ⚠️ O `WorkingDirectory` deve ser `/opt/srs`. Se o serviço falhar com `CHDIR: No such file or directory`:
> ```bash
> pct exec 201 -- sed -i 's|WorkingDirectory=.*|WorkingDirectory=/opt/srs|' /etc/systemd/system/srs-stack.service
> pct exec 201 -- systemctl daemon-reload && systemctl restart srs-stack
> ```
