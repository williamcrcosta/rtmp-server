#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="${1:-./backups/$(date +%Y%m%d-%H%M%S)}"
mkdir -p "${BACKUP_DIR}"

cp -a /usr/local/nginx/conf/nginx.conf "${BACKUP_DIR}/nginx.conf" 2>/dev/null || true
cp -a /var/www/html/index.html "${BACKUP_DIR}/index.html" 2>/dev/null || true
cp -a /etc/nginx/.htpasswd "${BACKUP_DIR}/.htpasswd" 2>/dev/null || true

if [ -d /var/records ]; then
  tar -czf "${BACKUP_DIR}/records.tar.gz" -C /var records
fi

echo "Backup salvo em: ${BACKUP_DIR}"
