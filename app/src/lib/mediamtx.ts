const API = process.env.MEDIAMTX_API ?? "http://mediamtx:9997";
export const WHEP = process.env.MEDIAMTX_WHEP ?? "http://mediamtx:8889";
export const HLS = process.env.MEDIAMTX_HLS ?? "http://mediamtx:8888";

// view = path transcodificado p/ browser (H.264 via runOnDemand)
// source = path base (RTSP direto da camera — sinal de saude)
export const CAMERAS: Record<
  string,
  { label: string; view: string; viewFull: string; source: string }
> = {
  camera1: { label: "Camera 1", view: "camera1_hd", viewFull: "camera1_full", source: "camera1" },
  camera2: { label: "Camera 2", view: "camera2_hd", viewFull: "camera2_full", source: "camera2" },
  camera3: { label: "Camera 3", view: "camera3_hd", viewFull: "camera3_full", source: "camera3" },
};

export interface PathItem {
  ready: boolean;
  readers: number;
  bytesReceived: number;
}

export interface StatusResponse {
  cameras: Record<string, { ready: boolean } & PathItem>;
  paths: { ready: number; total: number };
}

export async function fetchStatus(): Promise<StatusResponse> {
  const r = await fetch(`${API}/v3/paths/list`, { cache: "no-store" });
  if (!r.ok) throw new Error(`mediamtx ${r.status}`);
  const items: any[] = (await r.json()).items ?? [];
  const byName: Record<string, PathItem> = {};
  for (const p of items)
    byName[p.name] = {
      ready: !!p.ready,
      readers: (p.readers ?? []).length,
      bytesReceived: p.bytesReceived ?? 0,
    };
  const EMPTY = { ready: false, readers: 0, bytesReceived: 0 };
  const cameras: StatusResponse["cameras"] = {};
  for (const [id, c] of Object.entries(CAMERAS)) {
    const src = byName[c.source] ?? EMPTY;
    const view = byName[c.view] ?? EMPTY;
    cameras[id] = {
      ready: src.ready,
      readers: view.readers,
      bytesReceived: view.bytesReceived,
    };
  }
  return {
    cameras,
    paths: { ready: items.filter((p) => p.ready).length, total: items.length },
  };
}
