import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

// Auth.js v5. Sessão em JWT (cookie), sem banco. Precisa de GOOGLE_CLIENT_ID,
// GOOGLE_CLIENT_SECRET e AUTH_SECRET no .env.local.
export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],
});
