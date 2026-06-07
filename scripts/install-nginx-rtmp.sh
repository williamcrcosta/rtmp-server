#!/usr/bin/env bash
set -euo pipefail

NGINX_VERSION="1.24.0"
BUILD_DIR="/tmp/nginx-rtmp-build"

apt update
apt install -y build-essential libpcre3 libpcre3-dev libssl-dev zlib1g-dev unzip wget apache2-utils

mkdir -p /var/www/html/hls /var/records /tmp/nginx-rtmp-module-master
chmod 755 /var/www/html
chmod 777 /var/www/html/hls /var/records

rm -rf "${BUILD_DIR}"
mkdir -p "${BUILD_DIR}"
cd "${BUILD_DIR}"

wget "http://nginx.org/download/nginx-${NGINX_VERSION}.tar.gz"
wget "https://github.com/arut/nginx-rtmp-module/archive/master.zip"
unzip master.zip
tar -zxvf "nginx-${NGINX_VERSION}.tar.gz"
cd "nginx-${NGINX_VERSION}"

./configure --with-http_ssl_module --add-module=../nginx-rtmp-module-master
make
make install

cp "${BUILD_DIR}/nginx-rtmp-module-master/stat.xsl" /tmp/nginx-rtmp-module-master/stat.xsl 2>/dev/null || true
