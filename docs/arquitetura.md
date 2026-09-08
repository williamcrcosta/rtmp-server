# Arquitetura

## Fluxo atual (v6 — SRS + MediaMTX + Caddy)

```text
Câmeras iM7 (RTSP)  ----->  MediaMTX :8554 (pull RTSP)
                                 |
        .-------------------------.-------------------------.
        |                         |                         |
        v                         v                         v
  WebRTC :8889              HLS :8888              RTSP out :8554
        |                         |
        '------------------.------'
                           |
                    Caddy :443 (TLS + Basic Auth)
                           |
                           v
            https://cameras.wccosta.com.br/rtsp.html

OBS / Mibo / FFmpeg (RTMP)  ----->  SRS :1935 (ingest RTMP)
                                         |
                .-------------------------.-------------------------.
                |                         |                         |
                v                         v                         v
          HLS :8080               DVR /var/records          painel cameras.html
```

## Componentes

- **srs-server** (`ossrs/srs:5`): ingest RTMP na `1935`, HLS na `8080`, gravação DVR em `/var/records` e HTTP API na `1985`.
- **mediamtx** (`bluenviron/mediamtx:latest-ffmpeg`): pull RTSP das cameras iM7, transcode H.265 -> H.264 via `runOnDemand`, WebRTC `8889`, HLS `8888`, API `9997` e métricas Prometheus `9998`.
- **rtmp-caddy** (`caddy:alpine`): TLS com certificado Let's Encrypt, Basic Auth e proxy reverso para os painéis e serviços.
- **Paineis**: `rtsp.html` (MediaMTX - WebRTC/HLS com transcode) e `cameras.html` (SRS - HLS/DVR).

## Portas

| Porta | Protocolo | Serviço |
|---|---|---|
| `1935/tcp` | RTMP | ingest SRS |
| `8080/tcp` | HTTP | painel SRS / HLS |
| `443/tcp` | HTTPS | painel + HLS + proxy Caddy |
| `8554/tcp` | RTSP | MediaMTX re-serve |
| `8888/tcp` | HTTP | HLS MediaMTX |
| `8889/tcp` | HTTP | WebRTC MediaMTX (player + WHEP) |
| `9997/tcp` | HTTP | API MediaMTX |
| `9998/tcp` | HTTP | métricas Prometheus MediaMTX |

## Autenticacao

O Caddy expõe `https://cameras.wccosta.com.br` com **Basic Auth** (usuario `admin`, hash em `/etc/nginx/.htpasswd` no LXC). A ingest RTMP na `1935` é aberta. A API e métricas do MediaMTX (`9997`/`9998`) rodam sem autenticação na rede interna.
