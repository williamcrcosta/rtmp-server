# RTMP Cameras Infra

Infraestrutura para servidor de câmeras RTMP com Nginx + nginx-rtmp-module, HLS para visualização web e gravação local.

## Estado atual inventariado

- VM antiga: `rtpm-cameras`
- IP antigo: `192.168.50.12`
- Sistema: Ubuntu 24.04 LTS
- Serviço principal: `nginx.service`
- RTMP: porta `1935`
- HTTP/HLS: porta `8080`
- Aplicação RTMP: `live`
- Streams usados: `camera1`, `camera2`
- HLS: `/var/www/html/hls`
- Gravações: `/var/records`
- Autenticação básica: `/etc/nginx/.htpasswd`

## Estrutura

```text
.
├── docs/
│   ├── arquitetura.md
│   ├── inventario-vm-antiga.md
│   └── migracao.md
├── nginx/
│   ├── nginx.conf
│   └── index.html
├── scripts/
│   ├── install-nginx-rtmp.sh
│   └── backup-runtime-data.sh
├── systemd/
│   └── nginx.service
└── .gitignore
```

## URLs esperadas

- Interface web: `http://IP_DO_SERVIDOR:8080/`
- Estatísticas RTMP: `http://IP_DO_SERVIDOR:8080/stat`
- Gravações: `http://IP_DO_SERVIDOR:8080/recordings`
- Publicação RTMP: `rtmp://IP_DO_SERVIDOR:1935/live/camera1`
- Publicação RTMP: `rtmp://IP_DO_SERVIDOR:1935/live/camera2`

## Segurança

Não versionar:

- `/etc/nginx/.htpasswd`
- gravações `.flv`
- segmentos HLS `.ts`
- playlists HLS runtime `.m3u8`
- senhas, chaves e IPs sensíveis de produção
