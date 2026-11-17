import { signIn } from "@/auth";
import { AuthError } from "next-auth";
import { redirect } from "next/navigation";

const MSG: Record<string, string> = {
  credenciais: "Usuario ou senha invalidos.",
  sso: "Login Microsoft indisponivel no momento.",
};

export default async function Login({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { error } = await searchParams;
  const msg = error ? MSG[error] ?? "Falha no login." : null;

  return (
    <div className="center">
      <div className="card">
        <h2>Cameras</h2>
        {msg && (
          <p style={{ color: "#f66", fontSize: ".85rem" }}>{msg}</p>
        )}
        <form
          action={async () => {
            "use server";
            try {
              await signIn("microsoft-entra-id", { redirectTo: "/" });
            } catch (e) {
              if (e instanceof AuthError) redirect("/login?error=sso");
              throw e;
            }
          }}
        >
          <button type="submit" style={{ width: "100%" }}>
            Entrar com Microsoft
          </button>
        </form>
        <hr style={{ borderColor: "#333" }} />
        <small>Emergencia (break-glass):</small>
        <form
          action={async (fd: FormData) => {
            "use server";
            try {
              await signIn("breakglass", {
                u: fd.get("u"),
                p: fd.get("p"),
                redirectTo: "/",
              });
            } catch (e) {
              if (e instanceof AuthError) redirect("/login?error=credenciais");
              throw e;
            }
          }}
          style={{ display: "grid", gap: 8 }}
        >
          <input name="u" placeholder="usuario" autoComplete="username" required />
          <input name="p" type="password" placeholder="senha" autoComplete="current-password" required />
          <button type="submit">entrar</button>
        </form>
      </div>
    </div>
  );
}
