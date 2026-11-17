import { auth } from "@/auth";

export default auth((req) => {
  const { pathname } = req.nextUrl;
  if (!req.auth && pathname !== "/login") {
    return Response.redirect(new URL("/login", req.nextUrl));
  }
  if (req.auth && pathname === "/login") {
    return Response.redirect(new URL("/", req.nextUrl));
  }
});

export const config = {
  matcher: [
    "/((?!api/auth|_next/static|_next/image|favicon.ico).*)",
  ],
};
