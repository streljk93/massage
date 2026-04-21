import { NextResponse } from "next/server";
import { auth } from "@/auth";
import createMiddleware from "next-intl/middleware";
import { routing } from "./app/i18n/routing";

const intlMiddleware = createMiddleware(routing);

const profilePathRegex = new RegExp(
  `^\\/(${routing.locales.join("|")})\\/profile(\\/.*)?$`,
);

/** Гость может открыть только корень профиля и страницы языка, локации и помощи. */
const profileGuestAllowedRegex = new RegExp(
  `^\\/(${routing.locales.join("|")})\\/profile(?:\\/(language|location|help))?\\/?$`,
);

export default auth((req) => {
  const { pathname } = req.nextUrl;

  if (profilePathRegex.test(pathname) && !req.auth) {
    if (profileGuestAllowedRegex.test(pathname)) {
      return intlMiddleware(req);
    }
    const locale = pathname.split("/")[1] ?? routing.defaultLocale;
    const url = req.nextUrl.clone();
    url.pathname = `/${locale}/profile`;
    return NextResponse.redirect(url);
  }

  return intlMiddleware(req);
});

export const config = {
  matcher: [
    "/((?!api|_next|_next/static|_next/image|favicon.ico|.*\\..*).*)",
  ],
};
