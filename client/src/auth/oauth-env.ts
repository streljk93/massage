export type OAuthEnvFlags = {
  google: boolean;
  github: boolean;
  facebook: boolean;
};

/** Флаги наличия OAuth в окружении — общие для `auth.ts` и UI (не содержит секретов). */
export function getOAuthEnvFlags(): OAuthEnvFlags {
  return {
    google: Boolean(
      process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET,
    ),
    github: Boolean(
      process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET,
    ),
    facebook: Boolean(
      process.env.AUTH_FACEBOOK_ID && process.env.AUTH_FACEBOOK_SECRET,
    ),
  };
}
