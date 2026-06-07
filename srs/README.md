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

## Comparação com nginx-rtmp (pasta docker/)

| | nginx-rtmp (`docker/`) | SRS (`srs/`) |
|---|---|---|
| Dashboard | Manual (index.html) | Embutido |
| WebRTC | ❌ | ✅ |
| API REST | ❌ | ✅ |
| Manutenção | Abandonada | Ativa |
| Complexidade | Baixa | Baixa |
