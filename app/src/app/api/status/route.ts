import { auth } from "@/auth";
import { CAMERAS, pathsStatus } from "@/lib/mediamtx";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const st = await pathsStatus();
    return NextResponse.json(
      Object.fromEntries(
        Object.keys(CAMERAS).map((n) => [n, st[n] ?? { ready: false, readers: 0 }]),
      ),
    );
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
