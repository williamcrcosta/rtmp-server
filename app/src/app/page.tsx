import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { CAMERAS } from "@/lib/mediamtx";
import CameraGrid from "./components/CameraGrid";

export default async function Home() {
  const session = await auth();
  if (!session) redirect("/login");
  const role = (session as any).role ?? "viewer";
  const via = (session as any).via;
  return (
    <>
      <header>
        <h1>Cameras</h1>
        <div>
          {session.user?.name} · {role}
          {via === "breakglass" && " · ⚠ break-glass"} ·{" "}
          <a href="/api/auth/signout">sair</a>
        </div>
      </header>
      <CameraGrid cameras={CAMERAS} />
    </>
  );
}
