const API = process.env.MEDIAMTX_API ?? "http://mediamtx:9997";
export const WHEP = process.env.MEDIAMTX_WHEP ?? "http://mediamtx:8889";

export const CAMERAS: Record<string, string> = {
  camera1: "Camera 1",
  camera2: "Camera 2",
  camera3: "Camera 3",
};

export interface PathStatus {
  ready: boolean;
  readers: number;
  bytesReceived: number;
}

export async function pathsStatus(): Promise<Record<string, PathStatus>> {
  const r = await fetch(`${API}/v3/paths/list`, { cache: "no-store" });
  if (!r.ok) throw new Error(`mediamtx ${r.status}`);
  const items: any[] = (await r.json()).items ?? [];
  const out: Record<string, PathStatus> = {};
  for (const p of items)
    out[p.name] = {
      ready: !!p.ready,
      readers: (p.readers ?? []).length,
      bytesReceived: p.bytesReceived ?? 0,
    };
  return out;
}
