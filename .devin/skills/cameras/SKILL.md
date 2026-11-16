---
name: cameras
description: Operacao e troubleshooting do sistema de cameras (CT 201, mediamtx, SRS, Caddy, painel)
allowed-tools:
  - read
  - exec
  - grep
---

# Sistema de Cameras — Operacao e Troubleshooting

## Topologia

| Componente | Valor |
|---|---|
| Proxmox host | `192.168.50.250` (`root@pve`) |
| CT 201 (LXC Ubuntu 26.04) | `192.168.50.151` — `pct enter 201` ou `pct exec 201 -- <cmd>` |
| Stack | `/opt/srs` dentro do CT — docker compose: `mediamtx`, `srs-server`, `rtmp-caddy` |
| Gateway/DHCP | `192.168.50.254` (pfSense, VM 700) |
| DNS local | AdGuard, CT 400 — resolve `cameras.wccosta.com.br` → `192.168.50.151` |

## Cameras (Intelbras iM7, pull RTSP pelo mediamtx)

| Camera | IP | MAC | Codec |
|---|---|---|---|
| camera1 | `192.168.50.27` | — | HEVC 1920x1080 + AAC |
| camera2 | `192.168.50.10` | — | HEVC 2304x1296 + AAC |
| camera3 | `192.168.50.26` (cabo) / `192.168.50.12` (WiFi) | `54:ba:d9:5b:3f:60` / `...:5f` | HEVC 1920x1080 + AAC |

- Sources e credenciais RTSP: `/opt/srs/mediamtx.env` (no CT — **nunca** commitar valores)
- **IP de camera mudou?** `sed -i 's/<ip-antigo>/<ip-novo>/' /opt/srs/mediamtx.env` (na linha `MTX_PATHS_CAMERAx_SOURCE`) + `cd /opt/srs && docker compose up -d` (recria so o mediamtx)
- Cameras usam DHCP **sem reserva** — IPs mudam. Reservar no pfSense: `Services > DHCP Server > LAN > Static Mappings`

## Painel

- URL: `https://cameras.wccosta.com.br/rtsp.html` — basic auth `admin` (hash bcrypt no `/opt/srs/Caddyfile`)
- Cert: `/opt/srs/certs/fullchain.pem` — Let's Encrypt, **renovacao MANUAL** (nada de cron/certbot no CT). Ultimo cert expirou em `2026-11-13`
- Paths sao `runOnDemand`: so ficam `ready` quando alguem abre o stream. `ready:false` na API e normal

## Comandos uteis

```bash
# Status do stack
pct exec 201 -- docker ps
pct exec 201 -- docker logs mediamtx --since 1h

# Testar camera (rede + RTSP)
pct exec 201 -- bash -c "ping -c2 -W2 <IP>; nc -zvw3 <IP> 554"

# Validar stream de verdade (autentica + codec)
pct exec 201 -- docker run --rm --network host --env-file /opt/srs/mediamtx.env \
  --entrypoint /bin/sh bluenviron/mediamtx:latest-ffmpeg \
  -c 'timeout 15 ffprobe -rtsp_transport tcp -v error \
      -show_entries stream=codec_name,width,height -of csv=p=0 \
      "$MTX_PATHS_CAMERAX_SOURCE"'

# Descobrir quem tem RTSP na rede
pct exec 201 -- nmap -p554 --open -T4 192.168.50.0/24

# Verificar conflito de IP (MAC de quem responde)
pct exec 201 -- arping -c3 -w4 <IP>

# Subir stack inteiro
pct exec 201 -- bash -c "mkdir -p /var/records && cd /opt/srs && docker compose up -d"
```

## Diagnostico de camera que "cai da rede"

1. `ping`/`nc 554` — se falha, `arping <IP>` para ver se responde em L2
2. **Nem ARP responde** = dispositivo fora da rede (WiFi caiu, reboot, sem energia) — nao e problema de banda
3. **MAC diferente respondendo o mesmo IP** = conflito de IP — identificar o intruso pelo OUI
4. Script monitor pronto no CT: `/root/monitor-cam3.sh` (ping/arping a cada 5s, loga ONLINE/OFFLINE com MAC em `/root/cam3-monitor.log`) — adaptar o IP para reuso

## Problemas conhecidos (nov/2026)

- **camera3**: defeito de hardware — boot loop / quedas L2 em WiFi **e** cabo, mesmo com fonte/cabo/porta novos e resets. Levada a assistencia. Log de evidencia: `/root/cam3-monitor.log` no CT
- **`192.168.50.12`**: dispositivo desconhecido MAC `34:e6:e6:56:69:5e` (TTL 255) — disputava IP com o WiFi da camera3. Identificar
- **`192.168.50.8`**: RTSP aberto, nao cadastrado — verificar se e camera valida
- **Transcode caro**: cada viewer em `_hd`/`_full` queima ~35-45% de 1 core (ffmpeg x264). Load alto com varios viewers e esperado
- **`/var/records` vazio**: DVR nao configurado — nada e gravado hoje (streams sao pull, nao publish)
