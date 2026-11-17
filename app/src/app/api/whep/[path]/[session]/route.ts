import { auth } from "@/auth";
import { WHEP } from "@/lib/mediamtx";
import { NextResponse } from "next/server";

async function proxy(
  req: Request,
  { params }: { params: Promise<{ path: string; session: string }> },
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { path, session: sid } = await params;
  const body = req.method === "GET" ? undefined : await req.text();
  const r = await fetch(`${WHEP}/${path}/whep/${sid}`, {
    method: req.method,
    headers: { "Content-Type": req.headers.get("content-type") ?? "" },
    body,
  });
  return new NextResponse(await r.text(), {
    status: r.status,
    headers: { "Content-Type": r.headers.get("content-type") ?? "text/plain" },
  });
}

export const PATCH = proxy;
export const DELETE = proxy;
