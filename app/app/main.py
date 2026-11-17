import httpx
from fastapi import FastAPI, Request
from fastapi.responses import (HTMLResponse, JSONResponse, RedirectResponse,
                               Response)
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from starlette.middleware.sessions import SessionMiddleware

from . import auth, config, mediamtx
from .auth import NotAuthenticated

app = FastAPI(title="cameras-app")
app.add_middleware(
    SessionMiddleware,
    secret_key=config.SESSION_SECRET,
    https_only=True,
    same_site="lax",
)
app.include_router(auth.router)
app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")


@app.exception_handler(NotAuthenticated)
async def _auth_redirect(request: Request, exc: NotAuthenticated):
    if request.url.path.startswith("/api/") or request.method != "GET":
        return JSONResponse({"error": "not_authenticated"}, status_code=401)
    return RedirectResponse("/auth/login")


@app.get("/", response_class=HTMLResponse)
async def index(request: Request):
    user = auth.require_user(request)
    return templates.TemplateResponse(
        "index.html",
        {"request": request, "user": user, "cameras": config.CAMERAS},
    )


@app.get("/api/status")
async def api_status(request: Request):
    auth.require_user(request)
    try:
        st = await mediamtx.status()
    except httpx.HTTPError as e:
        return JSONResponse({"error": f"mediamtx: {e}"}, status_code=502)
    return {name: st.get(name, {"ready": False, "readers": 0})
            for name in config.CAMERAS}


# ---- WHEP proxy (mediamtx so escuta localhost; browsers passam por aqui) ----

@app.post("/whep/{path}")
async def whep_offer(request: Request, path: str):
    auth.require_user(request)
    body = await request.body()
    async with httpx.AsyncClient(timeout=10) as c:
        r = await c.post(
            f"{config.MEDIAMTX_WHEP}/{path}/whep",
            content=body,
            headers={"Content-Type": "application/sdp"},
        )
    loc = r.headers.get("location", "")
    if loc:
        # reescreve a sessao para ficar atras do proxy
        loc = loc.replace(f"{config.MEDIAMTX_WHEP}/{path}/whep",
                          f"{config.APP_BASE_URL}/whep/{path}")
        loc = loc.replace(config.MEDIAMTX_WHEP,
                          f"{config.APP_BASE_URL}/whep")
    return Response(
        content=r.content, status_code=r.status_code,
        media_type="application/sdp",
        headers={"Location": loc} if loc else {},
    )


@app.api_route("/whep/{path}/{session_id}", methods=["PATCH", "DELETE"])
async def whep_session(request: Request, path: str, session_id: str):
    auth.require_user(request)
    body = await request.body()
    async with httpx.AsyncClient(timeout=10) as c:
        r = await c.request(
            request.method,
            f"{config.MEDIAMTX_WHEP}/{path}/whep/{session_id}",
            content=body,
            headers={"Content-Type": request.headers.get("content-type", "")},
        )
    return Response(content=r.content, status_code=r.status_code,
                    media_type=r.headers.get("content-type"))
