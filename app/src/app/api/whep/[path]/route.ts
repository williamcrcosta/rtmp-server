import { auth } from "@/auth";
import { WHEP } from "@/lib/mediamtx";
import { NextResponse } from "next/server";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ path: string }> },
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { path } = await params;
  const sdp = await req.text();
  const r = await fetch(`${WHEP}/${path}/whep`, {
    method: "POST",
    headers: { "Content-Type": "application/sdp" },
    body: sdp,
  });
  let loc = r.headers.get("location") ?? "";
  // aponta a sessao de volta para o proxy
  loc = loc.replace(`${WHEP}/${path}/whep`, `/api/whep/${path}`);
  return new NextResponse(await r.text(), {
    status: r.status,
    headers: {
      "Content-Type": "application/sdp",
      ...(loc ? { Location: loc } : {}),
    },
  });
}
