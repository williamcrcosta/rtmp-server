# Arquitetura

## Fluxo

```text
Câmeras/OBS/FFmpeg
    ↓ RTMP
rtmp://servidor:1935/live/{camera1,camera2}
    ↓ nginx-rtmp-module
/var/www/html/hls/*.m3u8 + *.ts
    ↓ HTTP 8080
Browser com HLS.js
```

## Componentes

- Nginx compilado em `/usr/local/nginx`
- Módulo RTMP compilado junto ao Nginx
- `systemd` gerenciando `/usr/local/nginx/sbin/nginx`
- Interface estática em `/var/www/html/index.html`
- HLS temporário em `/var/www/html/hls`
- Gravações persistentes em `/var/records`

## Portas

- `1935/tcp`: publicação RTMP
- `8080/tcp`: interface web, HLS, estatísticas e recordings

## Autenticação

A interface, HLS e downloads usam Basic Auth apontando para `/etc/nginx/.htpasswd`.
