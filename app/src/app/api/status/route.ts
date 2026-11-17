import { auth } from "@/auth";
import { CAMERAS, pathsStatus } from "@/lib/mediamtx";
import { NextResponse } from "next/server";

const EMPTY = { ready: false, readers: 0, bytesReceived: 0 };

export async function GET() {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const st = await pathsStatus();
    return NextResponse.json(
      Object.fromEntries(
        Object.keys(CAMERAS).map((n) => [n, st[n] ?? EMPTY]),
      ),
    );
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
