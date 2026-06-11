#!/bin/bash
# Cria e configura LXC container para o servidor RTMP no Proxmox
# Uso: bash create-lxc.sh
# Pré-requisito: rodar no shell do Proxmox (pve)
# ⚠️  Nunca coloque senhas neste arquivo — elas são pedidas interativamente

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
DOMAIN="cameras.wcrpc.lan"
CA_IP="192.168.50.19"
CA_PORT="9000"
# ─────────────────────────────────────────────────────────────────────────────

CT_IP_CLEAN=$(echo "$CT_IP" | cut -d'/' -f1)

echo ""
echo "================================================"
echo "  RTMP Server — Deploy LXC"
echo "================================================"
echo ""
echo ">>> Digite a senha para o painel (usuário: admin):"
read -s PANEL_PASS
echo ""
echo ">>> Confirme a senha:"
read -s PANEL_PASS_CONFIRM
echo ""

if [ "$PANEL_PASS" != "$PANEL_PASS_CONFIRM" ]; then
  echo "❌ Senhas não conferem. Abortando."
  exit 1
fi

echo "=== [1/7] Baixando template Ubuntu 26.04 ==="
pveam update
pveam download local "$TEMPLATE" 2>/dev/null || echo "Template já existe, continuando..."

echo "=== [2/7] Criando container CT $CT_ID ==="
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

echo "=== [3/7] Habilitando nesting e keyctl (necessário para Docker) ==="
pct set "$CT_ID" --features nesting=1,keyctl=1
pct stop "$CT_ID" && pct start "$CT_ID"
sleep 5

echo "=== [4/7] Configurando rede persistente ==="
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

echo "=== [5/7] Instalando Docker e dependências ==="
pct exec "$CT_ID" -- bash -c "
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y curl git openssl -qq
curl -fsSL https://get.docker.com | sh
mkdir -p /var/records
"

echo "=== [6/7] Clonando repo e configurando Caddy ==="

# Busca Root CA do step-ca se disponível
if ping -c1 "$CA_IP" &>/dev/null; then
  echo "  → Importando Root CA de $CA_IP..."
  pct exec "$CT_ID" -- bash -c "
    curl -sk https://$CA_IP:$CA_PORT/roots.pem -o /usr/local/share/ca-certificates/wcrpc-root-ca.crt 2>/dev/null || true
    update-ca-certificates --fresh -q 2>/dev/null || true
  "
else
  echo "  ⚠️  CA server $CA_IP não alcançável — HTTPS sem cert válido até configurar o CA"
fi

# Gera hash da senha sem expor em disco
CADDY_HASH=$(pct exec "$CT_ID" -- docker run --rm caddy:alpine caddy hash-password --plaintext "$PANEL_PASS" 2>/dev/null)

pct exec "$CT_ID" -- bash -c "
git clone $REPO /opt/rtmp-server
cp -r /opt/rtmp-server/srs /opt/srs

# Cria Caddyfile com hash gerado — senha nunca em texto plano
cat > /opt/srs/Caddyfile <<EOF
{
    acme_ca https://$CA_IP:$CA_PORT/acme/acme/directory
    acme_ca_root /etc/ssl/certs/ca-certificates.crt
}

$DOMAIN {
    basic_auth {
        admin $CADDY_HASH
    }

    reverse_proxy /api/* srs:1985

    reverse_proxy srs:8080 {
        header_up Host {host}
        header_down Cache-Control no-cache
        header_down Access-Control-Allow-Origin *
    }
}
EOF

RECORDS_PATH=$RECORDS_PATH docker compose -f /opt/srs/docker-compose.yml up -d

cat > /etc/systemd/system/srs-stack.service <<EOF
[Unit]
Description=SRS Stack
After=docker.service network-online.target
Requires=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/opt/srs
Environment=RECORDS_PATH=$RECORDS_PATH
ExecStart=/usr/bin/docker compose up -d
ExecStop=/usr/bin/docker compose down

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable srs-stack --quiet
"

echo "=== [7/7] Adicionando entrada DNS local ao CA server ==="
if ping -c1 "$CA_IP" &>/dev/null; then
  pct exec 101 -- bash -c "
    grep -q '$DOMAIN' /etc/hosts || echo '$CT_IP_CLEAN $DOMAIN' >> /etc/hosts
  " 2>/dev/null && echo "  → DNS adicionado no CA server" || echo "  ⚠️  Não foi possível atualizar /etc/hosts no CA"
fi

echo ""
echo "================================================"
echo "  ✅  LXC $CT_ID criado e configurado!"
echo "================================================"
echo "  Painel:  https://$DOMAIN/cameras.html"
echo "  RTMP:    rtmp://$CT_IP_CLEAN:1935/live/camera1"
echo "  Login:   admin / (senha definida acima)"
echo ""
echo "  ⚠️  Lembre de instalar o Root CA nos dispositivos:"
echo "  http://$CA_IP:$CA_PORT/roots.pem"
echo "================================================"
