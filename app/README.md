# cameras-app

Painel proprio das cameras: login via Entra ID (AD sync), grid ao vivo
via WebRTC (WHEP), status de saude. Substitui o basicauth do Caddy.

## Estrutura

- `app/` — FastAPI (auth OIDC, proxy WHEP, API de status)
- `templates/` — pagina do grid
- `static/` — `whep.js` (player) + css
- `docker-compose.app.yml` — servico pra mesclar no compose principal

## Setup

1. Copie `.env.example` → `.env` e preencha:
   - `OIDC_*` — App Registration no Entra ID
     (redirect URI: `https://cameras.wccosta.com.br/auth/callback`)
   - `ADMIN_GROUP_ID` / `VIEWER_GROUP_ID` — object IDs dos grupos no AD
   - `SESSION_SECRET` — string aleatoria longa
2. No App Registration, habilite o claim `groups` no token
   (Token configuration → Add groups claim → Security groups)
3. No compose principal, adicione o servico `cameras-app` e no Caddyfile
   aponte `reverse_proxy cameras-app:8000` no lugar do basicauth
4. `docker compose up -d`

## Notas

- Streams so via WHEP (mediamtx:8889 fica em localhost — a app e o proxy)
- Mediamtx API (9997) consultada server-side pra status das paths
- Sem persistencia: sessoes sao cookies assinados; historico de quedas = fase 2
