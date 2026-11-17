import { signIn } from "@/auth";

export default function Login() {
  return (
    <div className="center">
      <div className="card">
        <h2>Cameras</h2>
        <form
          action={async () => {
            "use server";
            await signIn("microsoft-entra-id", { redirectTo: "/" });
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
            await signIn("breakglass", {
              u: fd.get("u"),
              p: fd.get("p"),
              redirectTo: "/",
            });
          }}
          style={{ display: "grid", gap: 8 }}
        >
          <input name="u" placeholder="usuario" required />
          <input name="p" type="password" placeholder="senha" required />
          <button type="submit">entrar</button>
        </form>
      </div>
    </div>
  );
}
