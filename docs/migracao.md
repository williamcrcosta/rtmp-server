# Migração para nova máquina

## 1. Preparar nova VM

- Instalar Ubuntu Server compatível.
- Garantir acesso SSH.
- Liberar portas `1935/tcp` e `8080/tcp` no firewall.
- Clonar este repositório.

## 2. Instalar Nginx RTMP

Executar:

```bash
sudo scripts/install-nginx-rtmp.sh
```

## 3. Criar autenticação básica

Instalar utilitário e criar usuário:

```bash
sudo apt install -y apache2-utils
sudo htpasswd -c /etc/nginx/.htpasswd USUARIO
```

## 4. Publicar configuração

```bash
sudo cp nginx/nginx.conf /usr/local/nginx/conf/nginx.conf
sudo cp nginx/index.html /var/www/html/index.html
sudo cp systemd/nginx.service /etc/systemd/system/nginx.service
sudo systemctl daemon-reload
sudo systemctl enable nginx
sudo systemctl restart nginx
```

## 5. Testar

```bash
systemctl status nginx
ss -tulpn | grep -E ':(1935|8080)'
```

Abrir:

```text
http://IP_NOVO_SERVIDOR:8080/
```

## 6. Migrar gravações se necessário

As gravações antigas ficam em `/var/records` e backups antigos foram vistos em `/home/william/nginx-rtmp-backup`.

Não migrar arquivos HLS runtime de `/var/www/html/hls`, pois eles são regenerados.
