"use client";
import { useEffect, useRef, useState } from "react";

type Stat = { ready: boolean; readers: number; bytesReceived: number };
type Status = Record<string, Stat>;
type CamState = { lastBytes: number; lastTime: number; bps: number; hist: number[] };

const POLL = 5000;
const HISTORY = 60;

function fmtBw(bps: number) {
  if (bps >= 1e6) return (bps / 1e6).toFixed(1) + " Mbps";
  if (bps >= 1e3) return (bps / 1e3).toFixed(0) + " kbps";
  return bps.toFixed(0) + " bps";
}
function fmtBytes(b: number) {
  if (b >= 1e9) return (b / 1e9).toFixed(2) + " GB";
  if (b >= 1e6) return (b / 1e6).toFixed(1) + " MB";
  return (b / 1e3).toFixed(0) + " kB";
}

export default function CameraGrid({ cameras }: { cameras: Record<string, string> }) {
  const [status, setStatus] = useState<Status>({});
  const states = useRef<Record<string, CamState>>({});

  useEffect(() => {
    const tick = async () => {
      try {
        const r = await fetch("/api/status");
        if (r.status === 401) return location.reload();
        const data: Status = await r.json();
        const now = Date.now();
        for (const [name, s] of Object.entries(data)) {
          const st = (states.current[name] ??= { lastBytes: 0, lastTime: 0, bps: 0, hist: [] });
          if (st.lastTime > 0 && s.bytesReceived >= st.lastBytes) {
            const dt = (now - st.lastTime) / 1000;
            st.bps = ((s.bytesReceived - st.lastBytes) * 8) / dt;
            st.hist.push(st.bps);
            if (st.hist.length > HISTORY) st.hist.shift();
          }
          st.lastBytes = s.bytesReceived;
          st.lastTime = now;
        }
        setStatus(data);
      } catch {}
    };
    tick();
    const t = setInterval(tick, POLL);
    return () => clearInterval(t);
  }, []);

  const names = Object.keys(cameras);
  const live = names.filter((n) => status[n]?.ready).length;
  const readers = names.reduce((a, n) => a + (status[n]?.readers ?? 0), 0);
  const totalBw = names.reduce((a, n) => a + (states.current[n]?.bps ?? 0), 0);
  const totalBytes = names.reduce((a, n) => a + (status[n]?.bytesReceived ?? 0), 0);

  return (
    <>
      <div className="stats-bar">
        <span>ao vivo: <b>{live}/{names.length}</b></span>
        <span>viewers: <b>{readers}</b></span>
        <span>banda: <b>{fmtBw(totalBw)}</b></span>
        <span>trafego total: <b>{fmtBytes(totalBytes)}</b></span>
      </div>
      <main className="grid">
        {Object.entries(cameras).map(([path, label]) => (
          <Cam key={path} path={path} label={label}
               stat={status[path]} camState={states.current[path]} />
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
      const x = i * step;
      const y = h - (v / max) * (h - 4) - 2;
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

function Cam({ path, label, stat, camState }:
  { path: string; label: string; stat?: Stat; camState?: CamState }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [res, setRes] = useState("");

  useEffect(() => {
    const video = videoRef.current!;
    const pc = new RTCPeerConnection();
    pc.addTransceiver("video", { direction: "recvonly" });
    pc.addTransceiver("audio", { direction: "recvonly" });
    pc.ontrack = (e) => (video.srcObject = e.streams[0]);
    let dead = false;

    (async () => {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      const r = await fetch(`/api/whep/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/sdp" },
        body: offer.sdp,
      });
      if (!r.ok) return;
      await pc.setRemoteDescription({ type: "answer", sdp: await r.text() });
    })();

    const onMeta = () =>
      video.videoWidth && setRes(`${video.videoWidth}x${video.videoHeight}`);
    video.addEventListener("loadedmetadata", onMeta);
    video.addEventListener("resize", onMeta);

    pc.onconnectionstatechange = () => {
      if (!dead && ["failed", "closed"].includes(pc.connectionState))
        setTimeout(() => { if (!dead) location.reload(); }, 3000);
    };
    return () => { dead = true; pc.close(); };
  }, [path]);

  return (
    <div className="cam" ref={boxRef}>
      <div className="cam-head">
        <span>{label}</span>
        <span>
          <span className={stat?.ready ? "status-on" : "status-off"}>
            {stat === undefined ? "..." : stat.ready ? "ao vivo" : "offline"}
          </span>{" "}
          <button className="btn-max" title="maximizar"
                  onClick={() => boxRef.current?.requestFullscreen()}>
            ⛶
          </button>
        </span>
      </div>
      <video ref={videoRef} autoPlay muted playsInline />
      <div className="cam-metrics">
        <span>{camState?.bps ? fmtBw(camState.bps) : "—"}</span>
        <span>{res || "—"}</span>
        <span>{stat?.readers ?? 0} viewers</span>
      </div>
      <Spark hist={camState?.hist ?? []} />
    </div>
  );
}
