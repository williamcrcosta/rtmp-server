# cameras-app

Painel proprio das cameras — **Next.js 15 + React 19 + TypeScript + Auth.js v5**.

- Login federado **Entra ID** (contas do AD sincronizadas) + grupo→papel
- **Break-glass** local (`LOCAL_USERS` com bcrypt) pra quando o SSO cair
- Grid ao vivo via **WebRTC/WHEP** (proxy server-side; mediamtx fica invisivel)
- Status de saude por camera (API do mediamtx server-side)

## Setup

1. `cp .env.example .env` e preencha:
   - `AUTH_SECRET` — `openssl rand -base64 32`
   - `AUTH_MICROSOFT_ENTRA_ID_*` — App Registration
     (redirect: `https://cameras.wccosta.com.br/api/auth/callback/microsoft-entra-id`)
   - `ADMIN_GROUP_ID` — object ID do grupo admin no AD
   - `LOCAL_USERS` — `user:bcrypt_hash` (break-glass)
2. No App Registration: **Token configuration → groups claim → Security groups**
3. Mesclar `docker-compose.app.yml` no compose principal e no Caddyfile
   trocar o basicauth por `reverse_proxy cameras-app:3000`
4. `docker compose up -d --build`

## Estrutura

- `src/auth.ts` — Auth.js: Entra ID + Credentials break-glass + role por grupo
- `src/middleware.ts` — protege todas as rotas (exceto auth/login)
- `src/app/api/status` — status das cameras (mediamtx server-side)
- `src/app/api/whep/[path]` — proxy WHEP (offer/answer + sessao)
- `src/app/components/CameraGrid.tsx` — grid client-side com player WHEP
