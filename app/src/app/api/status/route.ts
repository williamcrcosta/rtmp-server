import { auth } from "@/auth";
import { fetchStatus } from "@/lib/mediamtx";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    return NextResponse.json(await fetchStatus());
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
