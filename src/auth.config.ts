import type { NextAuthConfig } from "next-auth";

// Edge-safe config — no Prisma, no bcrypt. Imported by the middleware (edge)
// AND by src/auth.ts (node). Put the Prisma/bcrypt-dependent `authorize`
// in src/auth.ts so it stays out of the edge bundle.
export const authConfig: NextAuthConfig = {
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    {
      id: "credentials",
      name: "Credentials",
      type: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      // Real authorize lives in src/auth.ts; this stub satisfies the type
      // and keeps Prisma/bcrypt out of the edge middleware bundle.
      authorize: async () => null,
    },
  ],
  callbacks: {
    authorized: ({ auth, request }) => {
      const path = request.nextUrl.pathname;
      const isProtected = path.startsWith("/projects") || path === "/";
      if (isProtected) return !!auth?.user;
      return true;
    },
  },
};
