import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import createMiddleware from "next-intl/middleware";
import { routing } from "./app/i18n/routing";

const intlMiddleware = createMiddleware(routing);

const APP_LOCALE_HEADER = "x-app-locale";

/**
 * Пробрасываем первый сегмент пути в заголовок, чтобы корневой `app/layout` мог
 * поставить `lang` на `<html>` (без вложенного `Document` в `[locale]`).
 */
function withAppLocaleHeader(request: NextRequest): NextRequest {
  const first = request.nextUrl.pathname.split("/").filter(Boolean)[0] ?? "";
  const loc = (routing.locales as readonly string[]).includes(first) ?
      first
    : routing.defaultLocale;
  const h = new Headers(request.headers);
  h.set(APP_LOCALE_HEADER, loc);
  return new NextRequest(request.nextUrl, { headers: h });
}

const profilePathRegex = new RegExp(
  `^\\/(${routing.locales.join("|")})\\/profile(\\/.*)?$`,
);

/** Гость может открыть корень профиля, избранное (localStorage) и страницы языка, локации и помощи. */
const profileGuestAllowedRegex = new RegExp(
  `^\\/(${routing.locales.join("|")})\\/profile(?:\\/(language|location|help|favorites))?\\/?$`,
);

export default auth((req) => {
  const { pathname } = req.nextUrl;

  if (profilePathRegex.test(pathname) && !req.auth) {
    if (profileGuestAllowedRegex.test(pathname)) {
      return intlMiddleware(withAppLocaleHeader(req));
    }
    const locale = pathname.split("/")[1] ?? routing.defaultLocale;
    const url = req.nextUrl.clone();
    url.pathname = `/${locale}/profile`;
    return NextResponse.redirect(url);
  }

  return intlMiddleware(withAppLocaleHeader(req));
});

export const config = {
  matcher: [
    "/((?!api|_next|_next/static|_next/image|favicon.ico|.*\\..*).*)",
  ],
};
