import { getOAuthEnvFlags } from "@/auth/oauth-env";
import { LoginPage } from "@/views/auth";

export default function Page() {
  const oauth = getOAuthEnvFlags();
  return <LoginPage oauth={oauth} />;
}
