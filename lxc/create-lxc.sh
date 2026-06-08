#!/bin/bash
# Cria e configura LXC container para o servidor RTMP no Proxmox
# Uso: bash create-lxc.sh
# Pré-requisito: rodar no shell do Proxmox (pve)

set -e

# ── Variáveis — ajuste conforme seu ambiente ──────────────────────────────────
CT_ID=201
CT_HOSTNAME="rtmp-server"
CT_MEMORY=512
CT_CORES=2
CT_DISK="local-lvm:8"
CT_IP="192.168.50.151/24"
CT_GW="192.168.50.254"
CT_BRIDGE="vmbr0"
CT_DNS="8.8.8.8"
TEMPLATE="ubuntu-26.04-standard_26.04-1_amd64.tar.zst"
REPO="https://github.com/williamcrcosta/rtmp-server.git"
RECORDS_PATH="/var/records"
# ─────────────────────────────────────────────────────────────────────────────

echo "=== [1/6] Baixando template Ubuntu 26.04 ==="
pveam update
pveam download local "$TEMPLATE"

echo "=== [2/6] Criando container CT $CT_ID ==="
pct create "$CT_ID" "local:vztmpl/$TEMPLATE" \
  --hostname "$CT_HOSTNAME" \
  --cores "$CT_CORES" \
  --memory "$CT_MEMORY" \
  --swap 0 \
  --rootfs "$CT_DISK" \
  --net0 "name=eth0,bridge=$CT_BRIDGE,ip=$CT_IP,gw=$CT_GW" \
  --nameserver "$CT_DNS" \
  --unprivileged 1 \
  --start 1

echo "=== [3/6] Habilitando nesting e keyctl (necessário para Docker) ==="
pct set "$CT_ID" --features nesting=1,keyctl=1
pct stop "$CT_ID" && pct start "$CT_ID"
sleep 5

echo "=== [4/6] Configurando rede persistente ==="
pct exec "$CT_ID" -- bash -c "
cat > /etc/systemd/network/10-eth0.network <<EOF
[Match]
Name=eth0

[Network]
Address=$CT_IP
Gateway=$CT_GW
DNS=$CT_DNS
EOF
systemctl enable systemd-networkd --quiet
systemctl restart systemd-networkd
echo 'nameserver $CT_DNS' > /etc/resolv.conf
"

echo "=== [5/6] Instalando Docker e dependências ==="
pct exec "$CT_ID" -- bash -c "
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y curl apache2-utils git -qq
curl -fsSL https://get.docker.com | sh
mkdir -p /etc/nginx $RECORDS_PATH
"

echo "=== [6/6] Clonando repo, criando senha e subindo stack ==="
echo ""
echo ">>> Digite a senha para o usuário 'admin' do painel:"
read -s HTPASSWD_PASS
echo ""

pct exec "$CT_ID" -- bash -c "
htpasswd -cb /etc/nginx/.htpasswd admin '$HTPASSWD_PASS'
git clone $REPO /opt/rtmp-server
cd /opt/rtmp-server/srs && RECORDS_PATH=$RECORDS_PATH docker compose up -d

cat > /etc/systemd/system/srs-stack.service <<EOF
[Unit]
Description=SRS Stack
After=docker.service network-online.target
Requires=docker.service

[Service]
WorkingDirectory=/opt/rtmp-server/srs
Environment=RECORDS_PATH=$RECORDS_PATH
ExecStart=/usr/bin/docker compose up
ExecStop=/usr/bin/docker compose down
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable srs-stack --quiet
"

CT_IP_CLEAN=$(echo "$CT_IP" | cut -d'/' -f1)
echo ""
echo "========================================"
echo "  LXC $CT_ID criado e configurado!"
echo "========================================"
echo "  Painel:  http://$CT_IP_CLEAN:8888/cameras.html"
echo "  RTMP:    rtmp://$CT_IP_CLEAN:1935/live/camera1"
echo "  Login:   admin / (senha definida acima)"
echo "========================================"
