import type { Metadata, Viewport } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { AppProviders } from "@/app/providers";
import { DocumentLangFromLocale } from "@/app/document-lang-from-locale";
import type { AppLocale } from "@/app/i18n/routing";
import { routing } from "@/app/i18n/routing";

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

/** Без pinch-zoom страницы; ориентация дополнительно задаётся в `manifest.ts` и `PortraitOrientationLock`. */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  minimumScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#379f94" },
    { media: "(prefers-color-scheme: dark)", color: "#4db0a6" },
  ],
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: Pick<Props, "params">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });

  return {
    applicationName: t("siteName"),
    title: {
      default: t("siteName"),
      template: `%s · ${t("siteName")}`,
    },
    description: t("siteDescription"),
    appleWebApp: {
      capable: true,
      title: t("siteName"),
      statusBarStyle: "default",
    },
    icons: {
      icon: [
        {
          url: "/pwa/favicon-32.png",
          sizes: "32x32",
          type: "image/png",
        },
        {
          url: "/pwa/icon-192.png",
          sizes: "192x192",
          type: "image/png",
        },
        {
          url: "/pwa/icon-512.png",
          sizes: "512x512",
          type: "image/png",
        },
      ],
      apple: [{ url: "/pwa/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
    },
  };
}

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;

  if (!routing.locales.includes(locale as AppLocale)) {
    notFound();
  }

  setRequestLocale(locale);

  const messages = await getMessages();

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <DocumentLangFromLocale />
      <AppProviders>{children}</AppProviders>
    </NextIntlClientProvider>
  );
}
