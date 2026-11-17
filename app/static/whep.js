// Cliente WHEP minimo: POST SDP offer -> SDP answer -> reproduz no <video>
async function startWHEP(videoEl, url) {
  const pc = new RTCPeerConnection({ iceServers: [] });
  pc.addTransceiver('video', { direction: 'recvonly' });
  pc.addTransceiver('audio', { direction: 'recvonly' });
  pc.ontrack = e => { videoEl.srcObject = e.streams[0]; };

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);

  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/sdp' },
    body: offer.sdp,
  });
  if (r.status === 401) { location.reload(); return; }
  if (!r.ok) { console.error('WHEP falhou', r.status); setTimeout(() => startWHEP(videoEl, url), 5000); return; }

  const answer = await r.text();
  await pc.setRemoteDescription({ type: 'answer', sdp: answer });

  const sessionUrl = r.headers.get('location');
  pc.onconnectionstatechange = () => {
    if (['failed', 'closed'].includes(pc.connectionState)) {
      setTimeout(() => startWHEP(videoEl, url), 3000);
    }
  };
}
