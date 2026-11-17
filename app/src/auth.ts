import NextAuth from "next-auth";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";

// usuarios break-glass: env LOCAL_USERS="user:bcrypt_hash outro:hash"
const localUsers: Record<string, string> = Object.fromEntries(
  (process.env.LOCAL_USERS ?? "")
    .split(" ")
    .filter((p) => p.includes(":"))
    .map((p) => {
      const i = p.indexOf(":");
      return [p.slice(0, i), p.slice(i + 1)];
    }),
);

const ADMIN_GROUP = process.env.ADMIN_GROUP_ID ?? "";

function roleFromGroups(groups: unknown): "admin" | "viewer" {
  return Array.isArray(groups) && groups.includes(ADMIN_GROUP)
    ? "admin"
    : "viewer";
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  providers: [
    MicrosoftEntraID({
      clientId: process.env.AUTH_MICROSOFT_ENTRA_ID_ID,
      clientSecret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET,
      issuer: `https://login.microsoftonline.com/${process.env.AUTH_MICROSOFT_ENTRA_ID_TENANT_ID}/v2.0`,
    }),
    // break-glass: login local de emergencia (so quando Entra falha)
    Credentials({
      id: "breakglass",
      name: "Break-glass",
      credentials: { u: {}, p: {} },
      async authorize(creds) {
        const u = String(creds?.u ?? "");
        const hash = localUsers[u];
        if (!hash || !(await bcrypt.compare(String(creds?.p ?? ""), hash)))
          return null;
        console.warn(`[breakglass] USADO por ${u}`);
        return { id: `bg-${u}`, name: u, role: "admin", via: "breakglass" };
      },
    }),
  ],
  callbacks: {
    jwt({ token, account, profile, user }) {
      if (account?.provider === "breakglass" && user) {
        token.role = (user as any).role;
        token.via = "breakglass";
      } else if (profile) {
        token.role = roleFromGroups((profile as any).groups);
      }
      return token;
    },
    session({ session, token }) {
      (session as any).role = token.role ?? "viewer";
      (session as any).via = token.via;
      return session;
    },
  },
});
