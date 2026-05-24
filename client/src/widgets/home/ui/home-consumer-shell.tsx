"use client";

import type { ReactNode } from "react";
import { usePathname } from "@/app/i18n/navigation";
import {
  resolveHomeNavActiveId,
  shouldShowConsumerChrome,
  shouldShowHomeTopNav,
} from "../lib/resolve-home-nav-active-id";
import { HomeTopNav } from "./home-top-nav";

export type HomeConsumerShellProps = {
  children: ReactNode;
};

export function HomeConsumerShell({ children }: HomeConsumerShellProps) {
  const pathname = usePathname();
  const showChrome = shouldShowConsumerChrome(pathname);
  const showTopNav = showChrome && shouldShowHomeTopNav(pathname);

  if (!showChrome) {
    return children;
  }

  const activeId = resolveHomeNavActiveId(pathname);

  return (
    <>
      {showTopNav ? <HomeTopNav activeId={activeId} /> : null}
      {showTopNav ?
        <div className="lg:pt-4">{children}</div>
      : children}
    </>
  );
}
