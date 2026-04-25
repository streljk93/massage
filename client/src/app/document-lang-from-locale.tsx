"use client";

import { useLayoutEffect } from "react";
import { useLocale } from "next-intl";

/**
 * Родительский `app/layout` с `<html>` не пересчитывается при смене сегмента [locale] —
 * обновляем `lang` на корневом элементе вручную.
 */
export function DocumentLangFromLocale() {
  const locale = useLocale();
  useLayoutEffect(() => {
    if (document.documentElement.lang !== locale) {
      document.documentElement.lang = locale;
    }
  }, [locale]);
  return null;
}
