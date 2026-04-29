"use client";

import { useEffect, useMemo, useState } from "react";
import { Building2 } from "lucide-react";
import { useSession } from "next-auth/react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/app/i18n/navigation";
import type { AppLocale } from "@/app/i18n/routing";
import { BusinessEmptyState } from "@/entities/business";
import {
  createBrowserSdkClient,
  organizationsCabinetGetWorkplaceOrganizationSearch,
  organizationsCabinetPostRequestWorkplaceJoin,
} from "@/shared/api";
import { Button, SearchAutocomplete } from "@/shared/ui";
import { useQueryClient } from "@tanstack/react-query";
import { BusinessScreenHeader } from "@/widgets/business/chrome";

const ONB_QK = ["specialistOnboarding"] as const;
const ORGS_QK = ["specialistMyOrganizations"] as const;
const JOIN_REQ_QK = ["specialistMyWorkplaceJoinRequests"] as const;

export function BusinessOrganizationJoinPage() {
  const tOnb = useTranslations("specialistOnboarding");
  const tPage = useTranslations("businessAppSubpages");
  const locale = useLocale() as AppLocale;
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: session, status: sessionStatus } = useSession();
  const accessToken = session?.accessToken ?? "";

  const sdk = useMemo(
    () => createBrowserSdkClient(accessToken, { locale }),
    [accessToken, locale],
  );

  const [orgQ, setOrgQ] = useState("");
  const [orgHits, setOrgHits] = useState<
    Array<{ id: string; name: string; addressLine: string | null; city?: string | null }>
  >([]);
  const [orgPicked, setOrgPicked] = useState<string | null>(null);
  const [orgSuggestOpen, setOrgSuggestOpen] = useState(true);
  const [orgPending, setOrgPending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const backToOrgs = {
    href: "/business/organizations",
    ariaLabel: tPage("organizationJoinBackAria"),
  } as const;

  useEffect(() => {
    const q = orgQ.trim();
    if (q.length < 2) {
      return;
    }
    const tmr = setTimeout(() => {
      setOrgPending(true);
      void (async () => {
        const { data, error } = await organizationsCabinetGetWorkplaceOrganizationSearch({
          client: sdk,
          query: {
            q,
            limit: 8,
            locale,
          },
        });
        setOrgPending(false);
        if (error || !data?.organizations) {
          setOrgHits([]);
          return;
        }
        setOrgHits(
          data.organizations.map((o) => ({
            id: o.id,
            name: o.name,
            addressLine: o.addressLine,
            city: o.city,
          })),
        );
      })();
    }, 300);
    return () => {
      clearTimeout(tmr);
    };
  }, [orgQ, locale, sdk]);

  const onSubmit = async () => {
    if (!orgPicked) {
      setFormError(tOnb("vErrOrg"));
      return;
    }
    setFormError(null);
    setSubmitting(true);
    try {
      const res = await organizationsCabinetPostRequestWorkplaceJoin({
        client: sdk,
        path: { organizationId: orgPicked },
      });
      if (res.error) {
        const st = res.response?.status;
        setFormError(st === 409 ? tOnb("vErrOrgJoinConflict") : tOnb("vErrOrg"));
        return;
      }
      await queryClient.invalidateQueries({ queryKey: [...ONB_QK, accessToken, locale] });
      await queryClient.invalidateQueries({ queryKey: [...ORGS_QK, accessToken, locale] });
      await queryClient.invalidateQueries({ queryKey: [...JOIN_REQ_QK, accessToken, locale] });
      router.replace("/business/organizations");
    } finally {
      setSubmitting(false);
    }
  };

  if (sessionStatus === "loading") {
    return (
      <main className="mx-auto flex w-full max-w-lg flex-col gap-5 px-4 pt-2 pb-2">
        <BusinessScreenHeader
          title={tPage("organizationJoinTitle")}
          titleVariant="section"
          showHeadline={false}
          avatarAlt={tPage("organizationJoinTitle")}
          avatarFallback="B"
          cabinetBack={backToOrgs}
        />
        <div className="h-40 animate-pulse rounded-2xl bg-muted/50" aria-busy />
      </main>
    );
  }

  if (sessionStatus === "unauthenticated" || !accessToken) {
    return (
      <main className="mx-auto flex w-full max-w-lg flex-col gap-5 px-4 pt-2 pb-2">
        <BusinessScreenHeader
          title={tPage("organizationJoinTitle")}
          titleVariant="section"
          showHeadline={false}
          avatarAlt={tPage("organizationJoinTitle")}
          avatarFallback="B"
          cabinetBack={backToOrgs}
        />
        <BusinessEmptyState
          icon={Building2}
          title={tPage("orgsSignInTitle")}
          description={tPage("orgsSignInHint")}
        />
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-lg flex-col gap-5 px-4 pt-2 pb-2">
      <BusinessScreenHeader
        title={tPage("organizationJoinTitle")}
        titleVariant="section"
        showHeadline={false}
        avatarAlt={tPage("organizationJoinTitle")}
        avatarFallback="B"
        cabinetBack={backToOrgs}
      />

      <p className="text-pretty text-[0.9375rem] leading-relaxed text-foreground/85">
        {tPage("organizationJoinIntro")}
      </p>

      {formError ?
        <p className="text-pretty text-sm text-destructive" role="alert">
          {formError}
        </p>
      : null}

      <section className="space-y-4">
        <div className="space-y-1.5">
          <span className="text-sm font-medium text-foreground" id="org-join-search-label">
            {tOnb("searchOrg")}
          </span>
          <SearchAutocomplete
            value={orgQ}
            onValueChange={(v) => {
              setOrgQ(v);
              setOrgPicked(null);
              setOrgSuggestOpen(true);
              if (v.trim().length < 2) {
                setOrgHits([]);
                setOrgPending(false);
              }
            }}
            onSelect={(item) => {
              setOrgPicked(item.id);
              setOrgQ(item.name);
              setOrgSuggestOpen(false);
            }}
            items={orgHits}
            isLoading={orgPending}
            selectedId={orgPicked}
            listOpen={orgSuggestOpen}
            onListOpenChange={setOrgSuggestOpen}
            minQueryLength={2}
            inputId="org-join-combobox"
            listboxId="org-join-listbox"
            inputLabelledBy="org-join-search-label"
            placeholder={tOnb("searchPlaceholder")}
            listAriaLabel={tOnb("searchOrg")}
            loadingText={tOnb("orgSearchLoading")}
            emptyText={tOnb("orgSearchEmpty")}
            disabled={submitting}
          />
        </div>
        <Button
          type="button"
          variant="primary"
          className="h-12 w-full rounded-full font-medium"
          disabled={submitting}
          onClick={() => void onSubmit()}
        >
          {submitting ? tOnb("saving") : tOnb("workplaceRequestSubmit")}
        </Button>
      </section>
    </main>
  );
}
