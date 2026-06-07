#!/usr/bin/env bash
set -euo pipefail

REPO_URL="https://github.com/williamcrcosta/rtmp-server.git"
INSTALL_DIR="${1:-/opt/rtmp-server}"

apt-get update -qq
apt-get install -y -qq docker.io docker-compose-v2 git apache2-utils

systemctl enable --now docker

if [ -d "${INSTALL_DIR}/.git" ]; then
  echo "Repo já existe, atualizando..."
  git -C "${INSTALL_DIR}" pull
else
  git clone "${REPO_URL}" "${INSTALL_DIR}"
fi

if [ ! -f /etc/nginx/.htpasswd ]; then
  echo "Criando arquivo de autenticação..."
  read -rp "Usuário para acesso web: " HTUSER
  htpasswd -c /etc/nginx/.htpasswd "${HTUSER}"
fi

mkdir -p /var/records

docker compose -f "${INSTALL_DIR}/docker/docker-compose.yml" up -d --pull always

echo ""
echo "=== Deploy concluído ==="
echo "Interface web: http://$(hostname -I | awk '{print $1}'):8080"
echo "RTMP:          rtmp://$(hostname -I | awk '{print $1}'):1935/live/camera1"
