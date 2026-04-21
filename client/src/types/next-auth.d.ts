import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface User {
    accessToken?: string;
    refreshToken?: string;
    avatarUrl?: string | null;
  }

  interface Session {
    accessToken?: string;
    refreshToken?: string;
    user: DefaultSession["user"] & { id: string };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    accessToken?: string;
    refreshToken?: string;
    avatarUrl?: string | null;
    picture?: string | null;
  }
}
