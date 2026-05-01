"use client";

import { Star } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import {
  OrganizationCard,
  resolveDirectoryImageSrc,
} from "@/entities/organizations";
import { SpecialistCard } from "@/entities/specialists";
import { cn } from "@/shared/lib";

/** Строка ответа `GET /moderation/cases` после гидратации Nest. */
export type ModerationCaseRow = {
  id: string;
  kind:
    | "organization_profile"
    | "organization_review"
    | "specialist_review"
    | "specialist_profile"
    | "user_display_name";
  subjectId: string;
  aiSummary?: string | null;
  organization: {
    id: string;
    name: string;
    description: string | null;
    slug: string;
    publicationModerationStatus: string;
    /** Первая картинка витринной галереи (обложка карточки). */
    imageUrl?: string | null;
    imageAlt?: string | null;
    /** Все изображения витринной галереи (порядок как у гостя). */
    galleryImages?: ReadonlyArray<{
      url: string;
      alt: string | null;
    }>;
    phone?: string | null;
    email?: string | null;
    website?: string | null;
  } | null;
  organizationProfileRevision?: {
    id: string;
    organizationId: string;
    name: string;
    description: string | null;
    imageUrl?: string | null;
    imageAlt?: string | null;
    galleryImages?: ReadonlyArray<{
      url: string;
      alt: string | null;
    }>;
    phone?: string | null;
    email?: string | null;
    website?: string | null;
  } | null;
  organizationReview: {
    id: string;
    organizationId: string;
    rating: number;
    publishedComment: string | null;
    pendingCommentDraft: string | null;
    publicationModerationStatus: string;
  } | null;
  specialistReview: {
    id: string;
    specialistId: string;
    rating: number;
    publishedComment: string | null;
    pendingCommentDraft: string | null;
    publicationModerationStatus: string;
  } | null;
  specialistListedProfile: {
    id: string;
    userId: string;
    listingName: string | null;
    bio: string | null;
    experienceYears: number | null;
    imageUrl: string | null;
    imageAlt: string | null;
    profilePublicationModerationStatus: string;
    catalogListedBio: string | null;
    catalogListedListingName: string | null;
    catalogListedImageUrl: string | null;
  } | null;
  targetUser: {
    id: string;
    name: string;
    catalogListedName: string | null;
    email: string;
    nameModerationStatus: string;
  } | null;
};

function EmptyHint({ children }: { children: ReactNode }) {
  return (
    <div className="flex max-w-[18rem] min-h-[9rem] items-center justify-center rounded-2xl border border-dashed border-border bg-muted/15 px-3 py-4 text-center text-xs leading-snug text-muted-foreground">
      {children}
    </div>
  );
}

function ReviewSnippet(props: {
  rating: number;
  comment: string | null;
  emptyLabel: string;
}) {
  const safeComment = props.comment?.trim() ?? "";
  return (
    <div className="max-w-[18rem] overflow-hidden rounded-2xl border border-border/70 bg-card px-4 py-3 shadow-sm">
      <div className="mt-1 flex items-center gap-0.5" aria-hidden>
        {Array.from({ length: 5 }, (_, i) => (
          <Star
            key={i}
            className={cn(
              "size-3.5",
              i < props.rating
                ? "fill-amber-400 text-amber-400"
                : "fill-muted/25 text-muted-foreground/30",
            )}
            strokeWidth={0}
          />
        ))}
      </div>
      {safeComment.length > 0 ? (
        <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground/90">
          {safeComment}
        </p>
      ) : (
        <p className="mt-2 text-xs text-muted-foreground">{props.emptyLabel}</p>
      )}
    </div>
  );
}

function DisplayNameLine(props: { name: string }) {
  const trimmed = props.name.trim();
  const text = trimmed.length > 0 ? trimmed : "—";
  return (
    <p className="max-w-[18rem] break-words font-heading text-base font-semibold tracking-tight text-foreground">
      {text}
    </p>
  );
}

function SpecialistLikeCard(props: {
  name: string;
  bioLine: string;
  extraLine: string;
  imageUrl: string | null | undefined;
  imageAlt?: string | null;
}) {
  const imageSrc = resolveDirectoryImageSrc(
    props.imageUrl == null ? null : props.imageUrl,
  );
  const nm = props.name.trim() || "—";
  return (
    <SpecialistCard
      name={nm}
      imageSrc={imageSrc}
      imageAlt={(props.imageAlt ?? nm).trim() || nm}
      rating={0}
      metaLine={props.bioLine.trim() ? props.bioLine : "—"}
      servicesLine={props.extraLine.trim() ? props.extraLine : "—"}
      slotGroups={[]}
      className="max-w-[18rem] shadow-sm"
    />
  );
}

function OrganizationLikeCard(props: {
  name: string;
  descriptionLine: string;
  slugLine?: string;
  imageUrl?: string | null;
  imageAlt?: string | null;
}) {
  const imageSrc = resolveDirectoryImageSrc(
    props.imageUrl == null ? null : props.imageUrl,
  );
  const nm = props.name.trim() || "—";
  const desc = props.descriptionLine.trim() ?
      props.descriptionLine.trim()
    : "—";
  const services =
    props.slugLine != null && props.slugLine.trim().length > 0 ?
      `@${props.slugLine.trim()}`
    : "—";
  return (
    <OrganizationCard
      name={nm}
      imageSrc={imageSrc}
      imageAlt={(props.imageAlt ?? nm).trim() || nm}
      rating={0}
      metaLine={desc}
      servicesLine={services}
      slotGroups={[]}
      className="max-w-[18rem] shadow-sm"
    />
  );
}

function OrganizationModerationGalleryStrip(props: {
  items: ReadonlyArray<{ url: string; alt: string | null }>;
}) {
  const tp = useTranslations("admin.preview");
  const safe = props.items;
  /* Одну обложку уже на карточке; сетку — когда загрузок несколько — показываем весь порядок. */
  if (safe == null || safe.length <= 1) {
    return null;
  }

  const count = safe.length;

  return (
    <div className="max-w-[18rem]">
      <p className="mb-2 text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
        {tp("galleryUploaded", { count: String(count) })}
      </p>
      <ul className="flex flex-wrap gap-2 pb-1" role="list">
        {safe.map((item, idx) => {
          const thumbSrc = resolveDirectoryImageSrc(item.url);
          const trimmedAlt = item.alt?.trim();
          const indexOne = idx + 1;
          const alt =
            trimmedAlt && trimmedAlt.length > 0 ?
              trimmedAlt
            : tp("galleryThumbnailAltOrdinal", {
                index: String(indexOne),
                total: String(count),
              });
          return (
            <li key={`${item.url}-${idx}`} className="shrink-0 list-none">
              {/* eslint-disable-next-line @next/next/no-img-element -- moderation: arbitrary storage URLs */}
              <img
                src={thumbSrc}
                alt={alt}
                className="size-14 rounded-lg border border-border/80 object-cover shadow-sm sm:size-16"
                loading="lazy"
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function SalonModerationFullDescription(props: { text: string }) {
  const tp = useTranslations("admin.preview");
  const trimmed = props.text.trim();
  if (trimmed.length === 0) {
    return null;
  }
  return (
    <div className="max-w-[18rem] rounded-xl border border-border/60 bg-muted/10 px-3 py-2.5">
      <p className="mb-1.5 text-[0.6875rem] font-semibold uppercase tracking-wide text-muted-foreground">
        {tp("salonDescriptionFull")}
      </p>
      <p className="whitespace-pre-wrap break-words text-[0.8125rem] leading-relaxed text-foreground/90">
        {trimmed}
      </p>
    </div>
  );
}

function SalonModerationContactFields(props: {
  phone?: string | null;
  email?: string | null;
  website?: string | null;
}) {
  const tp = useTranslations("admin.preview");

  const display = (v: string | null | undefined) => {
    const t = v?.trim() ?? "";
    return t.length > 0 ? t : "—";
  };

  const Row = ({
    term,
    children,
    valueEmpty,
  }: {
    term: string;
    children: React.ReactNode;
    valueEmpty: boolean;
  }) => (
    <div className="space-y-0.5">
      <dt className="text-[0.6875rem] font-semibold uppercase tracking-wide text-muted-foreground">
        {term}
      </dt>
      <dd
        className={cn(
          "break-words text-[0.8125rem] leading-snug",
          valueEmpty ? "text-muted-foreground/80" : "text-foreground",
        )}
      >
        {children}
      </dd>
    </div>
  );

  const phoneTxt = display(props.phone);
  const emailTxt = display(props.email);
  const webTxtRaw = props.website?.trim() ?? "";

  const websiteEl =
    webTxtRaw.length > 0 && /^https?:\/\//i.test(webTxtRaw) ?
      <a
        href={webTxtRaw}
        target="_blank"
        rel="noopener noreferrer"
        className="font-normal text-primary underline-offset-2 hover:underline"
      >
        {webTxtRaw}
      </a>
    : webTxtRaw.length > 0 ?
      <span>{webTxtRaw}</span>
    : (
      "—"
    );

  const emailEl =
    emailTxt !== "—" && emailTxt.includes("@") ?
      <a href={`mailto:${emailTxt}`} className="underline-offset-2 hover:underline text-primary">
        {emailTxt}
      </a>
    : (
      emailTxt
    );

  return (
    <dl className="max-w-[18rem] space-y-3 rounded-xl border border-border/60 bg-muted/10 px-3 py-2.5">
      <Row term={tp("salonPhone")} valueEmpty={phoneTxt === "—"}>
        <span>{phoneTxt}</span>
      </Row>
      <Row term={tp("salonEmail")} valueEmpty={emailTxt === "—"}>
        {emailEl}
      </Row>
      <Row term={tp("salonWebsite")} valueEmpty={webTxtRaw.length === 0}>
        {websiteEl}
      </Row>
    </dl>
  );
}

function SalonProfileModerationBlock(props: {
  name: string;
  descriptionLine: string;
  slugLine?: string;
  galleryImages?: ReadonlyArray<{ url: string; alt: string | null }> | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
}) {
  const items = props.galleryImages ?? [];
  const first = items[0];
  return (
    <div className="flex flex-col gap-3">
      <OrganizationLikeCard
        name={props.name}
        descriptionLine={props.descriptionLine}
        slugLine={props.slugLine}
        imageUrl={first?.url ?? null}
        imageAlt={first?.alt ?? props.name}
      />
      <SalonModerationFullDescription text={props.descriptionLine} />
      <SalonModerationContactFields
        phone={props.phone}
        email={props.email}
        website={props.website}
      />
      <OrganizationModerationGalleryStrip items={items} />
    </div>
  );
}

/** Колонка: как карточка в каталоге / витрине выглядит сейчас для гостя. */
export function ModerationGuestPreview(props: { row: ModerationCaseRow }) {
  const tp = useTranslations("admin.preview");
  const ta = useTranslations("admin");
  const { row } = props;

  if (row.kind === "specialist_profile") {
    const s = row.specialistListedProfile;
    if (!s) return <EmptyHint>{ta("noEntity")}</EmptyHint>;
    const nm = (s.catalogListedListingName ?? "").trim();
    const bio = (s.catalogListedBio ?? "").trim();
    if (!nm.length && !bio.length && !(s.catalogListedImageUrl ?? "").trim()) {
      return <EmptyHint>{tp("emptyListed")}</EmptyHint>;
    }
    return (
      <SpecialistLikeCard
        name={nm || bio || "—"}
        bioLine={bio}
        extraLine={
          s.experienceYears != null ?
            tp("experienceYears", { years: String(s.experienceYears) })
          : "—"
        }
        imageUrl={s.catalogListedImageUrl}
        imageAlt={(s.catalogListedListingName ?? s.imageAlt)?.trim()}
      />
    );
  }

  if (row.kind === "organization_profile") {
    const org = row.organization;
    if (!org) return <EmptyHint>{ta("noEntity")}</EmptyHint>;
    /* В каталоге/витрине гость видит только одобренный профиль организации */
    if (org.publicationModerationStatus !== "approved") {
      return <EmptyHint>{tp("organizationNotInShowcase")}</EmptyHint>;
    }
    return (
      <SalonProfileModerationBlock
        name={org.name}
        descriptionLine={org.description ?? ""}
        slugLine={org.slug}
        galleryImages={org.galleryImages}
        phone={org.phone}
        email={org.email}
        website={org.website}
      />
    );
  }

  if (row.kind === "organization_review") {
    const rev = row.organizationReview;
    if (!rev) return <EmptyHint>{ta("noEntity")}</EmptyHint>;
    return (
      <ReviewSnippet
        rating={rev.rating}
        comment={rev.publishedComment}
        emptyLabel={tp("reviewEmpty")}
      />
    );
  }

  if (row.kind === "specialist_review") {
    const rev = row.specialistReview;
    if (!rev) return <EmptyHint>{ta("noEntity")}</EmptyHint>;
    return (
      <ReviewSnippet
        rating={rev.rating}
        comment={rev.publishedComment}
        emptyLabel={tp("reviewEmpty")}
      />
    );
  }

  if (row.kind === "user_display_name") {
    const u = row.targetUser;
    if (!u) return <EmptyHint>{ta("noEntity")}</EmptyHint>;
    const pub = (u.catalogListedName ?? "").trim();
    if (!pub.length) {
      return <EmptyHint>{tp("guestNameMissing")}</EmptyHint>;
    }
    return (
      <DisplayNameLine name={pub} />
    );
  }

  return <EmptyHint>{ta("noEntity")}</EmptyHint>;
}

/** Колонка: что ждёт решения модератора (черновик / новые поля). */
export function ModerationPendingPreview(props: { row: ModerationCaseRow }) {
  const tp = useTranslations("admin.preview");
  const ta = useTranslations("admin");
  const { row } = props;

  if (row.kind === "specialist_profile") {
    const s = row.specialistListedProfile;
    if (!s) return <EmptyHint>{ta("noEntity")}</EmptyHint>;
    const nm = (s.listingName ?? "").trim();
    const bio = (s.bio ?? "").trim();
    return (
      <SpecialistLikeCard
        name={nm || bio || "—"}
        bioLine={bio}
        extraLine={
          s.experienceYears != null ?
            tp("experienceYears", { years: String(s.experienceYears) })
          : "—"
        }
        imageUrl={s.imageUrl}
        imageAlt={s.imageAlt}
      />
    );
  }

  if (row.kind === "organization_profile") {
    const rev = row.organizationProfileRevision;
    const org = row.organization;
    if (!rev) return <EmptyHint>{ta("noEntity")}</EmptyHint>;
    return (
      <SalonProfileModerationBlock
        name={rev.name}
        descriptionLine={rev.description ?? ""}
        slugLine={org?.slug}
        galleryImages={rev.galleryImages}
        phone={rev.phone}
        email={rev.email}
        website={rev.website}
      />
    );
  }

  if (row.kind === "organization_review") {
    const rev = row.organizationReview;
    if (!rev) return <EmptyHint>{ta("noEntity")}</EmptyHint>;
    return (
      <ReviewSnippet
        rating={rev.rating}
        comment={rev.pendingCommentDraft ?? rev.publishedComment}
        emptyLabel={tp("reviewDraftEmpty")}
      />
    );
  }

  if (row.kind === "specialist_review") {
    const rev = row.specialistReview;
    if (!rev) return <EmptyHint>{ta("noEntity")}</EmptyHint>;
    return (
      <ReviewSnippet
        rating={rev.rating}
        comment={rev.pendingCommentDraft ?? rev.publishedComment}
        emptyLabel={tp("reviewDraftEmpty")}
      />
    );
  }

  if (row.kind === "user_display_name") {
    const u = row.targetUser;
    if (!u) return <EmptyHint>{ta("noEntity")}</EmptyHint>;
    return (
      <DisplayNameLine name={u.name} />
    );
  }

  return <EmptyHint>{ta("noEntity")}</EmptyHint>;
}
