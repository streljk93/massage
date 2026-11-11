import { safePostAuthPath } from "./safe-post-auth-path";

export function authReturnPathQuery(postSignInPath: string): string {
  if (postSignInPath === "/") {
    return "";
  }
  const safe = safePostAuthPath(postSignInPath);
  if (safe == null) {
    return "";
  }
  return `?next=${encodeURIComponent(safe)}`;
}

export function loginHrefWithReturn(postSignInPath: string): string {
  return `/login${authReturnPathQuery(postSignInPath)}`;
}

export function registrationHrefWithReturn(postSignInPath: string): string {
  return `/registration${authReturnPathQuery(postSignInPath)}`;
}
