import { getOAuthEnvFlags } from "@/auth/oauth-env";
import { safePostAuthPath } from "@/shared/lib";
import { LoginPage } from "@/views/auth";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function Page({ searchParams }: PageProps) {
  const oauth = getOAuthEnvFlags();
  const sp = (await searchParams) ?? {};
  const nextRaw = sp.next;
  const nextSingle = Array.isArray(nextRaw) ? nextRaw[0] : nextRaw;
  const postSignInPath = safePostAuthPath(nextSingle) ?? "/";
  return <LoginPage oauth={oauth} postSignInPath={postSignInPath} />;
}
