import httpx
from .config import MEDIAMTX_API

async def list_paths() -> list[dict]:
    async with httpx.AsyncClient(timeout=5) as c:
        r = await c.get(f"{MEDIAMTX_API}/v3/paths/list")
        r.raise_for_status()
        return r.json().get("items", [])

async def status() -> dict[str, dict]:
    """path -> {ready, readers, source_ready}"""
    items = await list_paths()
    out = {}
    for p in items:
        src = p.get("source") or {}
        out[p["name"]] = {
            "ready": p.get("ready", False),
            "readers": len(p.get("readers") or []),
            "source_ready": src.get("type") not in (None, "", "none"),
        }
    return out
