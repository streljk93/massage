import { getOAuthEnvFlags } from "@/auth/oauth-env";
import { RegisterPage } from "@/views/auth";

export default function Page() {
  const oauth = getOAuthEnvFlags();
  return <RegisterPage oauth={oauth} />;
}
