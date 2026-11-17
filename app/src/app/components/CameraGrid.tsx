"use client";
import Hls from "hls.js";
import { useEffect, useRef, useState } from "react";

type CamDef = { label: string; view: string; viewFull: string; source: string };
type CamStat = { ready: boolean; readers: number; bytesReceived: number };
type StatusRes = {
  cameras: Record<string, CamStat>;
  paths: { ready: number; total: number };
};
type CamState = { lastBytes: number; lastTime: number; bps: number; hist: number[] };
type CamPhase = "loading" | "live" | "error";

const POLL = 5000;
const HISTORY = 24;

function fmtBw(bps: number) {
  if (!bps || bps <= 0) return "0 Kbps";
  const k = bps / 1000;
  return k > 1000 ? (k / 1000).toFixed(1) + " Mbps" : k.toFixed(0) + " Kbps";
}
function fmtBytes(b: number) {
  const u = ["B", "KB", "MB", "GB", "TB"];
  let i = 0, n = b;
  while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
  return i === 0 ? Math.floor(n) + " " + u[i] : n.toFixed(2) + " " + u[i];
}

export default function CameraGrid({ cameras }: { cameras: Record<string, CamDef> }) {
  const [res, setRes] = useState<StatusRes | null>(null);
  const states = useRef<Record<string, CamState>>({});

  useEffect(() => {
    const tick = async () => {
      try {
        const r = await fetch("/api/status");
        if (r.status === 401) return location.reload();
        const data: StatusRes = await r.json();
        const now = Date.now();
        for (const [id, s] of Object.entries(data.cameras ?? {})) {
          const st = (states.current[id] ??= { lastBytes: 0, lastTime: 0, bps: 0, hist: [] });
          if (st.lastTime > 0 && s.bytesReceived >= st.lastBytes) {
            st.bps = ((s.bytesReceived - st.lastBytes) * 8) / ((now - st.lastTime) / 1000);
            st.hist.push(st.bps);
            if (st.hist.length > HISTORY) st.hist.shift();
          }
          st.lastBytes = s.bytesReceived;
          st.lastTime = now;
        }
        setRes(data);
      } catch {}
    };
    tick();
    const t = setInterval(tick, POLL);
    return () => clearInterval(t);
  }, []);

  const ids = Object.keys(cameras);
  const cams = res?.cameras ?? {};
  const live = ids.filter((n) => cams[n]?.ready).length;
  const readers = ids.reduce((a, n) => a + (cams[n]?.readers ?? 0), 0);
  const totalBw = ids.reduce((a, n) => a + (states.current[n]?.bps ?? 0), 0);
  const totalBytes = ids.reduce((a, n) => a + (cams[n]?.bytesReceived ?? 0), 0);

  return (
    <>
      <div className="stats-bar">
        <div className="stat-card"><div className="label">Streams ao vivo</div>
          <div className="value green">{res ? `${live}/${ids.length}` : "--"}</div></div>
        <div className="stat-card"><div className="label">Paths prontos</div>
          <div className="value">{res ? `${res.paths.ready}/${res.paths.total}` : "--"}</div></div>
        <div className="stat-card"><div className="label">Viewers total</div>
          <div className="value">{readers}</div></div>
        <div className="stat-card"><div className="label">Banda total</div>
          <div className="value yellow">{fmtBw(totalBw)}</div></div>
        <div className="stat-card"><div className="label">Total trafegado</div>
          <div className="value">{fmtBytes(totalBytes)}</div></div>
        <div className="stat-card"><div className="label">Codec</div>
          <div className="value">H.264</div></div>
      </div>
      <main className="grid">
        {Object.entries(cameras).map(([id, cam]) => (
          <Cam key={id} id={id} cam={cam} stat={cams[id]} camState={states.current[id]} />
        ))}
      </main>
    </>
  );
}

function Spark({ hist }: { hist: number[] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current!;
    const ctx = cv.getContext("2d")!;
    const w = (cv.width = cv.offsetWidth);
    const h = (cv.height = 30);
    ctx.clearRect(0, 0, w, h);
    if (hist.length < 2) return;
    const max = Math.max(...hist, 1);
    const step = w / (HISTORY - 1);
    ctx.beginPath();
    ctx.strokeStyle = "#22c55e";
    ctx.lineWidth = 1.5;
    hist.forEach((v, i) => {
      const x = i * step, y = h - (v / max) * (h - 4) - 2;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.lineTo((hist.length - 1) * step, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    ctx.fillStyle = "rgba(34,197,94,0.12)";
    ctx.fill();
  }, [hist]);
  return <canvas ref={ref} className="spark" />;
}

function Cam({ id, cam, stat, camState }:
  { id: string; cam: CamDef; stat?: CamStat; camState?: CamState }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [res, setResol] = useState("");
  const [proto, setProto] = useState("--");
  const [phase, setPhase] = useState<CamPhase>("loading");
  const [latency, setLatency] = useState("--");
  const [fullRes, setFullRes] = useState(false);
  const viewPath = fullRes ? cam.viewFull : cam.view;

  useEffect(() => {
    const video = videoRef.current!;
    let hls: Hls | null = null;
    let pc: RTCPeerConnection | null = null;
    let dead = false;
    setPhase("loading");

    const onMeta = () =>
      video.videoWidth && setResol(`${video.videoWidth}x${video.videoHeight}`);
    video.addEventListener("loadedmetadata", onMeta);
    video.addEventListener("resize", onMeta);

    const startHLS = () => {
      if (dead) return;
      const url = `/api/hls/${viewPath}/index.m3u8`;
      const tryLoad = () => {
        if (dead) return;
        if (Hls.isSupported()) {
          hls = new Hls({ liveSyncDurationCount: 3, liveMaxLatencyDurationCount: 6 });
          hls.loadSource(url);
          hls.attachMedia(video);
          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            setPhase("live"); setProto("HLS"); video.play().catch(() => {});
          });
          hls.on(Hls.Events.ERROR, (_, d) => {
            if (d.fatal) {
              setPhase("error"); hls?.destroy(); hls = null;
              setTimeout(tryLoad, 8000);
            }
          });
        } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
          video.src = url;
          video.addEventListener("loadedmetadata", () => {
            setPhase("live"); setProto("HLS"); video.play().catch(() => {});
          });
          video.addEventListener("error", () => {
            setPhase("error"); setTimeout(tryLoad, 8000);
          });
        }
      };
      tryLoad();
    };

    const startWebRTC = async () => {
      pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
      pc.addTransceiver("video", { direction: "recvonly" });
      pc.addTransceiver("audio", { direction: "recvonly" });
      pc.ontrack = (e) => {
        video.srcObject = e.streams[0];
        setPhase("live"); setProto("WebRTC"); setLatency("~1s");
        video.play().catch(() => {});
      };
      pc.onconnectionstatechange = () => {
        if (!dead && ["failed", "closed"].includes(pc!.connectionState)) {
          pc?.close(); pc = null; startHLS();
        }
      };
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await new Promise<void>((res) => {
        if (pc!.iceGatheringState === "complete") return res();
        pc!.addEventListener("icegatheringstatechange",
          () => pc!.iceGatheringState === "complete" && res());
        setTimeout(res, 3000);
      });
      const r = await fetch(`/api/whep/${viewPath}`, {
        method: "POST",
        headers: { "Content-Type": "application/sdp" },
        body: pc.localDescription!.sdp,
      });
      if (!r.ok) throw new Error(`WHEP ${r.status}`);
      await pc.setRemoteDescription({ type: "answer", sdp: await r.text() });
    };

    startWebRTC().catch(() => { pc?.close(); pc = null; startHLS(); });

    const latT = setInterval(() => {
      if (hls?.latency) setLatency(hls.latency.toFixed(1) + "s");
    }, 2000);

    return () => {
      dead = true;
      clearInterval(latT);
      pc?.close();
      hls?.destroy();
      video.removeEventListener("loadedmetadata", onMeta);
      video.removeEventListener("resize", onMeta);
    };
  }, [viewPath]);

  const stLabel = phase === "live" ? "Ao vivo" : phase === "loading" ? "Conectando..." : "Sem sinal";
  return (
    <div className="cam" ref={boxRef}>
      <div className="cam-head">
        <span className="cam-title">{cam.label}
          <span className="badge">{fullRes ? "FULL" : "HD"}</span>
          <span className="badge proto">{proto}</span>
        </span>
        <span className="status">
          <span className={`dot ${phase}`} />
          <span>{stLabel}</span>
          <button className="btn-max" title="maximizar"
                  onClick={() => boxRef.current?.requestFullscreen()}>⛶</button>
        </span>
      </div>
      <div className="cam-body">
        <video ref={videoRef} autoPlay muted playsInline controls />
        {phase !== "live" && (
          <div className="overlay-msg">
            <div>{phase === "loading" ? "Iniciando stream..." : "Sem sinal"}</div>
            <div className="hint">
              WebRTC (~1s) ou HLS (~9s) — o transcode pode levar ~10s na 1a vez
            </div>
          </div>
        )}
      </div>
      <Spark hist={camState?.hist ?? []} />
      <div className="cam-metrics">
        <span>Bitrate: <b className="hl">{camState?.bps ? fmtBw(camState.bps) : "--"}</b></span>
        <span>Resolucao: <b>{res || "--"}</b></span>
        <span>Estado: <b>{stat === undefined ? "--" : stat.ready ? "pronto" : "offline"}</b></span>
        <span>Viewers: <b>{stat?.readers ?? "--"}</b></span>
        <span>Latencia: <b>{latency}</b></span>
      </div>
      <div className="cam-footer">
        <button onClick={() => setFullRes(!fullRes)}>
          {fullRes ? "⚡ Voltar HD" : "🔎 Full 3MP"}
        </button>
        <a href={`/api/hls/${viewPath}/index.m3u8`} target="_blank">🔗 HLS</a>
      </div>
    </div>
  );
}
