import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Facebook from "next-auth/providers/facebook";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import { z } from "zod";
import { getOAuthEnvFlags } from "@/auth/oauth-env";
import { resolveApiResourceUrl } from "@/shared/api/resolve-api-resource-url";

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

type BackendAuthResponse = {
  user: { id: string; email: string; name: string; avatarUrl: string | null };
  accessToken: string;
  refreshToken: string;
};

async function loginViaBackend(
  email: string,
  password: string,
): Promise<BackendAuthResponse | null> {
  const base = process.env.AUTH_BACKEND_URL?.replace(/\/+$/, "");
  if (!base) {
    return null;
  }
  const res = await fetch(`${base}/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    return null;
  }
  return (await res.json()) as BackendAuthResponse;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.sub = user.id ?? token.sub;
        token.accessToken =
          "accessToken" in user && typeof user.accessToken === "string"
            ? user.accessToken
            : undefined;
        token.refreshToken =
          "refreshToken" in user && typeof user.refreshToken === "string"
            ? user.refreshToken
            : undefined;
        if (user.avatarUrl !== undefined) {
          token.avatarUrl = user.avatarUrl;
        }
        if (user.image) {
          token.picture = user.image;
        }
      }
      if (trigger === "update" && session && typeof session === "object") {
        const next = session as {
          name?: string;
          avatarUrl?: string | null;
        };
        if (typeof next.name === "string") {
          token.name = next.name;
        }
        if ("avatarUrl" in next) {
          token.avatarUrl = next.avatarUrl ?? null;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id =
          (typeof token.sub === "string" ? token.sub : session.user.email) ??
          session.user.email ??
          "";
        if (typeof token.name === "string") {
          session.user.name = token.name;
        }
        let nextImage: string | undefined;
        if (typeof token.avatarUrl === "string") {
          nextImage = resolveApiResourceUrl(token.avatarUrl);
        } else if (token.avatarUrl === null) {
          nextImage =
            typeof token.picture === "string" ? token.picture : undefined;
        } else {
          nextImage =
            (typeof token.picture === "string" ? token.picture : undefined) ??
            session.user.image ??
            undefined;
        }
        session.user.image = nextImage;
      }
      session.accessToken =
        typeof token.accessToken === "string" ? token.accessToken : undefined;
      session.refreshToken =
        typeof token.refreshToken === "string" ? token.refreshToken : undefined;
      return session;
    },
  },
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
        const email = parsed.data.email.trim();
        const password = parsed.data.password;

        const fromApi = await loginViaBackend(email, password);
        if (fromApi) {
          return {
            id: fromApi.user.id,
            email: fromApi.user.email,
            name: fromApi.user.name,
            avatarUrl: fromApi.user.avatarUrl,
            accessToken: fromApi.accessToken,
            refreshToken: fromApi.refreshToken,
          };
        }

        // Локальная демо-сессия без API (если AUTH_BACKEND_URL не задан)
        if (!process.env.AUTH_BACKEND_URL) {
          const name =
            parsed.data.name?.trim() ||
            email.split("@")[0] ||
            "User";
          return {
            id: email,
            email,
            name,
          };
        }

        return null;
      },
    }),
  ],
});
