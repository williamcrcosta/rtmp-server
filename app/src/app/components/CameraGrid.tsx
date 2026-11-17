"use client";
import { useEffect, useRef, useState } from "react";

type Status = Record<string, { ready: boolean; readers: number }>;

export default function CameraGrid({ cameras }: { cameras: Record<string, string> }) {
  const [status, setStatus] = useState<Status>({});

  useEffect(() => {
    const tick = async () => {
      try {
        const r = await fetch("/api/status");
        if (r.status === 401) location.reload();
        setStatus(await r.json());
      } catch {}
    };
    tick();
    const t = setInterval(tick, 15000);
    return () => clearInterval(t);
  }, []);

  return (
    <main className="grid">
      {Object.entries(cameras).map(([path, label]) => (
        <Cam key={path} path={path} label={label}
             ready={status[path]?.ready} />
      ))}
    </main>
  );
}

function Cam({ path, label, ready }: { path: string; label: string; ready?: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = ref.current!;
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

    pc.onconnectionstatechange = () => {
      if (!dead && ["failed", "closed"].includes(pc.connectionState))
        setTimeout(() => { if (!dead) location.reload(); }, 3000);
    };
    return () => { dead = true; pc.close(); };
  }, [path]);

  return (
    <div className="cam">
      <div className="cam-head">
        <span>{label}</span>
        <span className={ready ? "status-on" : "status-off"}>
          {ready === undefined ? "..." : ready ? "ao vivo" : "offline"}
        </span>
      </div>
      <video ref={ref} autoPlay muted playsInline />
    </div>
  );
}
