import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Facebook from "next-auth/providers/facebook";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import { z } from "zod";
import { getOAuthEnvFlags } from "@/auth/oauth-env";

const flags = getOAuthEnvFlags();

const oauthProviders = [
  ...(flags.google ? [Google] : []),
  ...(flags.github ? [GitHub] : []),
  ...(flags.facebook ? [Facebook] : []),
];

const credentialsSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
  name: z.string().optional(),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  providers: [
    ...oauthProviders,
    Credentials({
      id: "credentials",
      name: "Email",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        name: { label: "Name", type: "text" },
      },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) {
          return null;
        }
        const { email, name } = parsed.data;
        return {
          id: email,
          email,
          name: name?.trim() || email.split("@")[0] || "User",
        };
      },
    }),
  ],
});
