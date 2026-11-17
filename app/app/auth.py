from authlib.integrations.starlette_client import OAuth
import logging

import bcrypt
from fastapi import APIRouter, Form, Request
from fastapi.responses import RedirectResponse
from . import config

log = logging.getLogger("auth")

oauth = OAuth()
oauth.register(
    name="entra",
    server_metadata_url=(
        f"https://login.microsoftonline.com/{config.OIDC_TENANT_ID}"
        "/v2.0/.well-known/openid-configuration"
    ),
    client_id=config.OIDC_CLIENT_ID,
    client_secret=config.OIDC_CLIENT_SECRET,
    client_kwargs={"scope": "openid profile email"},
)

router = APIRouter(prefix="/auth")


def _role(groups: list) -> str:
    if config.ADMIN_GROUP_ID and config.ADMIN_GROUP_ID in groups:
        return "admin"
    return "viewer"


@router.get("/login")
async def login(request: Request):
    redirect_uri = f"{config.APP_BASE_URL}/auth/callback"
    return await oauth.entra.authorize_redirect(request, redirect_uri)


@router.get("/callback")
async def callback(request: Request):
    token = await oauth.entra.authorize_access_token(request)
    claims = token.get("userinfo") or {}
    request.session["user"] = {
        "name": claims.get("name") or claims.get("preferred_username", ""),
        "email": claims.get("preferred_username") or claims.get("email", ""),
        "role": _role(claims.get("groups", [])),
    }
    return RedirectResponse("/")


@router.get("/logout")
async def logout(request: Request):
    request.session.clear()
    return RedirectResponse("/auth/login")


# ---- break-glass: login local de emergencia (so quando Entra falha) ----

@router.get("/local")
async def local_form():
    from fastapi.responses import HTMLResponse
    return HTMLResponse(
        '<form method="post" action="/auth/local">'
        '<h3>Acesso de emergencia (break-glass)</h3>'
        '<input name="u" placeholder="usuario" required>'
        '<input name="p" type="password" placeholder="senha" required>'
        '<button>entrar</button></form>')


@router.post("/local")
async def local_login(request: Request, u: str = Form(...), p: str = Form(...)):
    h = config.local_users().get(u)
    if not h or not bcrypt.checkpw(p.encode(), h.encode()):
        log.warning("break-glass FALHOU user=%s ip=%s", u, request.client.host)
        return RedirectResponse("/auth/local", status_code=303)
    request.session["user"] = {
        "name": u, "email": "", "role": "admin", "via": "breakglass",
    }
    # TODO fase alertas: notificar todo uso de break-glass (e evento de seguranca)
    log.warning("break-glass USADO por %s ip=%s", u, request.client.host)
    return RedirectResponse("/", status_code=303)


class NotAuthenticated(Exception):
    pass


def require_user(request: Request) -> dict:
    user = request.session.get("user")
    if not user:
        raise NotAuthenticated()
    return user
