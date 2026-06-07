# Inventário da VM antiga

## Identificação

- Hostname: `rtpm-cameras`
- IP de acesso: `192.168.50.12`
- Usuário SSH usado: `william`
- Sistema operacional: Ubuntu 24.04.4 LTS
- Kernel observado: Linux 6.8.0-117-generic
- Virtualização observada: VMware

## Serviços e portas

- `nginx.service` ativo
- TCP `1935`: RTMP
- TCP `8080`: HTTP/HLS/interface web

## Componentes encontrados

- Nginx compilado manualmente com `nginx-rtmp-module`
- Diretório de setup: `/home/william/nginx-rtmp-setup`
- Backup antigo: `/home/william/nginx-rtmp-backup`
- Web root: `/var/www/html`
- HLS runtime: `/var/www/html/hls`
- Gravações runtime: `/var/records`
- Basic auth: `/etc/nginx/.htpasswd`

## Arquivos importantes

- `/home/william/nginx-rtmp-setup/nginx.conf`
- `/home/william/nginx-rtmp-setup/index.html`
- `/home/william/nginx-rtmp-setup/install-nginx-rtmp.sh`
- `/etc/nginx/.htpasswd`

## Dados que não devem ir para GitHub

- Hash real do `.htpasswd`
- Gravações `.flv`
- Segmentos HLS `.ts`
- Arquivos HLS runtime `.m3u8`
