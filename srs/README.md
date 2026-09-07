# SRS — Simple Realtime Server

Alternativa moderna ao nginx-rtmp-module. Servidor dedicado a streaming com dashboard web embutido.

## Vantagens sobre nginx-rtmp

- Dashboard web pronto em `http://IP:8080`
- Suporte a WebRTC (latência < 1s no browser)
- API REST para monitorar streams ativos
- Imagem Docker oficial mantida ativamente
- Configuração mais simples

## Portas

| Porta | Protocolo | Uso |
|---|---|---|
| `1935` | TCP | RTMP ingest (câmeras/OBS) |
| `8080` | TCP | Dashboard + HLS + HTTP |
| `1985` | TCP | API REST |
| `8000` | UDP | WebRTC (opcional) |

## Como subir

```bash
# Criar diretório de gravações
mkdir -p /var/records

# Copiar e editar variáveis de ambiente
cp ../.env.example .env
# Editar SERVER_IP com o IP da máquina

# Subir
docker compose up -d
```

## URLs após subir

| Serviço | URL |
|---|---|
| Dashboard | `http://IP:8080` |
| HLS câmera 1 | `http://IP:8080/live/camera1.m3u8` |
| HLS câmera 2 | `http://IP:8080/live/camera2.m3u8` |
| API REST | `http://IP:1985/api/v1/streams` |

## Enviar stream

**OBS Studio:**
```
Settings → Stream → Service: Custom
Server:     rtmp://IP:1935/live
Stream Key: camera1
```

**FFmpeg:**
```bash
ffmpeg -i /dev/video0 -c:v libx264 -f flv rtmp://IP:1935/live/camera1
```

**Câmera IP via RTSP:**
```bash
ffmpeg -i rtsp://usuario:senha@IP_CAMERA/stream -c copy -f flv rtmp://IP:1935/live/camera1
```

## Verificar streams ativos via API

```bash
curl http://IP:1985/api/v1/streams | jq
```


## MediaMTX — ingest RTSP das câmeras iM7

O stack inclui o **MediaMTX** (`mediamtx` no compose), que puxa o stream RTSP
das câmeras e republica em WebRTC/HLS/RTSP. Isso contorna a limitação do RTMP
da iM7, que não carrega H.265 (modo High morre no publish).

### Configurar

```bash
cp mediamtx.env.example mediamtx.env
# Edite com as senhas reais das câmeras (senha do dispositivo no app Mibo)
docker compose up -d mediamtx
```

### URLs do MediaMTX

| Serviço | URL |
|---|---|
| Player WebRTC | `http://IP:8889/camera1` |
| HLS | `http://IP:8888/camera1/index.m3u8` |
| RTSP out | `rtsp://IP:8554/camera1` |
| API | `http://IP:9997/v3/paths/list` |
| Métricas | `http://IP:9998/metrics` |

### Path RTSP da iM7

```
rtsp://admin:SENHA@IP:554/cam/realmonitor?channel=1&subtype=0
subtype=0 -> stream principal (High) | subtype=1 -> sub-stream (Standard)
```

## Comparação com nginx-rtmp (pasta docker/)

| | nginx-rtmp (`docker/`) | SRS (`srs/`) |
|---|---|---|
| Dashboard | Manual (index.html) | Embutido |
| WebRTC | ❌ | ✅ |
| API REST | ❌ | ✅ |
| Manutenção | Abandonada | Ativa |
| Complexidade | Baixa | Baixa |
