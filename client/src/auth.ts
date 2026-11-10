import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import { resolveApiOrigin } from "@/shared/lib/api-origin";
import { resolveApiResourceUrl } from "@/shared/lib/resolve-api-resource-url";

const credentialsSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
  name: z.string().optional(),
});

/**
 * Сессия после `POST` `/api/auth/login-oauth` (тот же ответ, что `POST` `/v1/auth/login/oauth`).
 * Передаётся в `signIn("credentials", { … })` вместо логина по паролю.
 */
const backendTokenSessionSchema = z.object({
  userId: z.string().uuid(),
  email: z.string().email(),
  name: z.string().min(1).max(200),
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1),
  avatarUrl: z.string().max(2_000).nullish().optional(),
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
  const base = resolveApiOrigin();
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

/** `exp` из access JWT (секунды), без проверки подписи — только для решения об обновлении. */
function decodeAccessTokenExpSec(accessToken: string): number | null {
  try {
    const part = accessToken.split(".")[1];
    if (!part) {
      return null;
    }
    const base64 = part.replace(/-/g, "+").replace(/_/g, "/");
    const padLen = (4 - (base64.length % 4)) % 4;
    const padded = base64 + "=".repeat(padLen);
    const json = new TextDecoder().decode(
      Uint8Array.from(atob(padded), (c) => c.charCodeAt(0)),
    );
    const payload = JSON.parse(json) as { exp?: number };
    return typeof payload.exp === "number" ? payload.exp : null;
  } catch {
    return null;
  }
}

async function refreshViaBackend(
  refreshToken: string,
): Promise<BackendAuthResponse | null> {
  const base = resolveApiOrigin();
  if (!base) {
    return null;
  }
  const res = await fetch(`${base}/v1/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
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

      const access =
        typeof token.accessToken === "string" ? token.accessToken : undefined;
      const refresh =
        typeof token.refreshToken === "string" ? token.refreshToken : undefined;
      if (access && refresh) {
        const exp = decodeAccessTokenExpSec(access);
        const nowSec = Math.floor(Date.now() / 1000);
        const skewSec = 60;
        const shouldRefresh =
          exp !== null && exp - skewSec <= nowSec;
        if (shouldRefresh) {
          const next = await refreshViaBackend(refresh);
          if (next) {
            token.accessToken = next.accessToken;
            token.refreshToken = next.refreshToken;
            if (next.user.avatarUrl !== undefined) {
              token.avatarUrl = next.user.avatarUrl;
            }
            token.name = next.user.name;
          } else {
            delete token.accessToken;
            delete token.refreshToken;
          }
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
    Credentials({
      id: "credentials",
      name: "Email",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        name: { label: "Name", type: "text" },
      },
      async authorize(raw) {
        if (
          raw &&
          typeof raw === "object" &&
          "accessToken" in raw &&
          "refreshToken" in raw
        ) {
          const t = raw as Record<string, unknown>;
          const parsed = backendTokenSessionSchema.safeParse({
            userId: t.userId,
            email: t.email,
            name: t.name,
            accessToken: t.accessToken,
            refreshToken: t.refreshToken,
            avatarUrl: t.avatarUrl,
          });
          if (parsed.success) {
            return {
              id: parsed.data.userId,
              email: parsed.data.email,
              name: parsed.data.name,
              accessToken: parsed.data.accessToken,
              refreshToken: parsed.data.refreshToken,
              avatarUrl:
                parsed.data.avatarUrl === undefined ||
                parsed.data.avatarUrl === null ||
                parsed.data.avatarUrl === ""
                  ? null
                  : parsed.data.avatarUrl,
            };
          }
        }

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

        // Локальная демо-сессия без API (если backend origin не настроен)
        if (!resolveApiOrigin()) {
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
