import type { HomeTopNavActiveId } from "../ui/home-top-nav";

/** Активный пункт меню по pathname (без локали). */
export function resolveHomeNavActiveId(pathname: string): HomeTopNavActiveId {
  if (pathname === "/" || pathname === "") {
    return "home";
  }
  if (
    pathname.startsWith("/search") ||
    pathname.startsWith("/specialists") ||
    pathname.startsWith("/organizations")
  ) {
    return "search";
  }
  if (pathname.startsWith("/bookings")) {
    return "bookings";
  }
  if (pathname.startsWith("/profile")) {
    return "profile";
  }
  return "home";
}

/** Верхнее меню (линия «Спец / Салоны / …»): на полноэкранной карте не показываем. */
export function shouldShowHomeTopNav(pathname: string): boolean {
  if (
    pathname === "/search/map" ||
    pathname.startsWith("/search/map/")
  ) {
    return false;
  }
  return true;
}

/** Показывать consumer chrome (верхнее/нижнее меню клиента). */
export function shouldShowConsumerChrome(pathname: string): boolean {
  if (
    pathname.startsWith("/business") ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/registration") ||
    pathname.startsWith("/admin")
  ) {
    return false;
  }
  return true;
}
