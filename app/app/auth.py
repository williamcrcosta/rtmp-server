from authlib.integrations.starlette_client import OAuth
from fastapi import APIRouter, Request
from fastapi.responses import RedirectResponse
from . import config

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


class NotAuthenticated(Exception):
    pass


def require_user(request: Request) -> dict:
    user = request.session.get("user")
    if not user:
        raise NotAuthenticated()
    return user
