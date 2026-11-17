import os

OIDC_CLIENT_ID = os.getenv("OIDC_CLIENT_ID", "")
OIDC_CLIENT_SECRET = os.getenv("OIDC_CLIENT_SECRET", "")
OIDC_TENANT_ID = os.getenv("OIDC_TENANT_ID", "")
ADMIN_GROUP_ID = os.getenv("ADMIN_GROUP_ID", "")
VIEWER_GROUP_ID = os.getenv("VIEWER_GROUP_ID", "")
APP_BASE_URL = os.getenv("APP_BASE_URL", "http://localhost:8000")
SESSION_SECRET = os.getenv("SESSION_SECRET", "dev-secret-change-me")
MEDIAMTX_API = os.getenv("MEDIAMTX_API", "http://mediamtx:9997")
MEDIAMTX_WHEP = os.getenv("MEDIAMTX_WHEP", "http://mediamtx:8889")

# cameras exibidas no grid (path do mediamtx -> rotulo)
CAMERAS = {
    "camera1": "Camera 1",
    "camera2": "Camera 2",
    "camera3": "Camera 3",
}

# usuarios break-glass locais (formato: "user:bcrypt_hash user2:hash2")
# gerar hash: python -c "import bcrypt;print(bcrypt.hashpw(b'senha',bcrypt.gensalt()).decode())"
LOCAL_USERS_RAW = os.getenv("LOCAL_USERS", "")

def local_users() -> dict[str, str]:
    out = {}
    for pair in LOCAL_USERS_RAW.split():
        if ":" in pair:
            u, h = pair.split(":", 1)
            out[u] = h
    return out
