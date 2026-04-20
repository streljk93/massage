import { NextResponse } from "next/server";
import { auth } from "@/auth";
import createMiddleware from "next-intl/middleware";
import { routing } from "./app/i18n/routing";

const intlMiddleware = createMiddleware(routing);

const profilePathRegex = new RegExp(
  `^\\/(${routing.locales.join("|")})\\/profile(\\/.*)?$`,
);

export default auth((req) => {
  const { pathname } = req.nextUrl;

  if (profilePathRegex.test(pathname) && !req.auth) {
    const locale = pathname.split("/")[1] ?? routing.defaultLocale;
    const url = req.nextUrl.clone();
    url.pathname = `/${locale}/login`;
    return NextResponse.redirect(url);
  }

  return intlMiddleware(req);
});

export const config = {
  matcher: [
    "/((?!api|_next|_next/static|_next/image|favicon.ico|.*\\..*).*)",
  ],
};
