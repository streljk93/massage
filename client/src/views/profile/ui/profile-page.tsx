"use client";

import { useState } from "react";
import {
  Bell,
  ChevronRight,
  CreditCard,
  FileText,
  Globe,
  HelpCircle,
  LogOut,
  MapPin,
  UserPen,
} from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/app/i18n/navigation";
import { HomeBottomNav, HomeScreenHeader } from "@/widgets/home";
import { cn, motion } from "@/shared/lib";
import { profileUserDemo } from "../lib/mock-data";

const menuIconClass = "size-[1.125rem] shrink-0 text-muted-foreground";

export function ProfilePage() {
  const t = useTranslations("profile");
  const router = useRouter();
  const { data: session } = useSession();
  const [signOutPending, setSignOutPending] = useState(false);

  const accountName =
    session?.user?.name?.trim() ||
    session?.user?.email?.split("@")[0] ||
    profileUserDemo.firstName;
  const accountEmail = session?.user?.email ?? profileUserDemo.email;

  const onSignOut = async () => {
    setSignOutPending(true);
    try {
      await signOut({ redirect: false });
      router.replace("/");
      router.refresh();
    } finally {
      setSignOutPending(false);
    }
  };

  const menuItems = [
    {
      id: "edit" as const,
      labelKey: "editProfile" as const,
      icon: UserPen,
      variant: "default" as const,
      href: "/profile/edit" as const,
    },
    {
      id: "language" as const,
      labelKey: "language" as const,
      icon: Globe,
      variant: "default" as const,
      href: "/profile/language" as const,
    },
    {
      id: "location" as const,
      labelKey: "location" as const,
      icon: MapPin,
      variant: "default" as const,
      href: "/profile/location" as const,
    },
    {
      id: "notifications" as const,
      labelKey: "notifications" as const,
      icon: Bell,
      variant: "default" as const,
      href: "/profile/notifications" as const,
    },
    {
      id: "payment" as const,
      labelKey: "paymentMethods" as const,
      icon: CreditCard,
      variant: "default" as const,
      href: "/profile/payment" as const,
    },
    {
      id: "help" as const,
      labelKey: "help" as const,
      icon: HelpCircle,
      variant: "default" as const,
      href: "/profile/help" as const,
    },
    {
      id: "terms" as const,
      labelKey: "terms" as const,
      icon: FileText,
      variant: "default" as const,
      href: "/profile/terms" as const,
    },
    {
      id: "signOut" as const,
      labelKey: "signOut" as const,
      icon: LogOut,
      variant: "destructive" as const,
      href: null,
    },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-surface-background">
      <div className="flex min-h-0 flex-1 flex-col">
        <main className="mx-auto w-full max-w-lg flex-1 space-y-4 px-4 pt-3 pb-[calc(5rem+env(safe-area-inset-bottom))]">
          <HomeScreenHeader
            title={t("title")}
            titleVariant="section"
            avatarAlt={accountName}
            avatarFallback={accountName.slice(0, 2).toUpperCase()}
          />

          <section
            className="rounded-2xl border border-border/60 bg-card px-4 py-4"
            aria-label={t("userSectionAria")}
          >
            <dl className="space-y-3">
              <div>
                <dt className="text-xs font-medium text-muted-foreground">
                  {t("displayName")}
                </dt>
                <dd className="mt-0.5 text-base font-semibold text-foreground">
                  {accountName}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-muted-foreground">
                  {t("emailLabel")}
                </dt>
                <dd className="mt-0.5 break-all text-sm text-foreground">
                  {accountEmail}
                </dd>
              </div>
            </dl>
          </section>

          <section aria-label={t("menuSectionAria")}>
            <ul className="divide-y divide-border/60 overflow-hidden rounded-2xl border border-border/60 bg-card">
              {menuItems.map(({ id, labelKey, icon: Icon, variant, href }) => {
                const isDestructive = variant === "destructive";
                const rowClassName = cn(
                  motion.interactivePressStrong,
                  "flex w-full items-center gap-3 px-4 py-3.5 text-left text-sm font-medium transition-colors",
                  isDestructive
                    ? "text-destructive hover:text-destructive"
                    : "text-foreground hover:bg-muted/40",
                );
                const inner = (
                  <>
                    <Icon
                      className={cn(
                        menuIconClass,
                        isDestructive && "text-destructive",
                      )}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1">{t(labelKey)}</span>
                    <ChevronRight
                      className={cn(
                        "size-4 shrink-0 text-muted-foreground",
                        isDestructive && "text-destructive/80",
                      )}
                      aria-hidden
                    />
                  </>
                );
                return (
                  <li key={id}>
                    {href ? (
                      <Link href={href} className={rowClassName}>
                        {inner}
                      </Link>
                    ) : (
                      <button
                        type="button"
                        className={rowClassName}
                        disabled={signOutPending}
                        aria-busy={signOutPending}
                        onClick={() => void onSignOut()}
                      >
                        {inner}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        </main>

        <HomeBottomNav activeId="profile" />
      </div>
    </div>
  );
}
