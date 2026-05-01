import { type Prisma, PublicationModerationStatus } from '@prisma/client';

/** Мастер в каталоге: approved; при смене имени — замороженное `catalogListedName` пока статус pending или после reject. */
export function directoryListedUserWhereInput(): Prisma.UserWhereInput {
  const frozenListedName = {
    catalogListedName: { not: null },
  } as const;
  return {
    OR: [
      { nameModerationStatus: PublicationModerationStatus.approved },
      {
        AND: [
          {
            nameModerationStatus: PublicationModerationStatus.pending_review,
          },
          frozenListedName,
        ],
      },
      {
        AND: [
          {
            nameModerationStatus: PublicationModerationStatus.rejected,
          },
          frozenListedName,
        ],
      },
    ],
  };
}

export type DirectoryUserListedNameShape = {
  name: string;
  catalogListedName: string | null;
  nameModerationStatus: PublicationModerationStatus;
};

/** Имя во витрине: при approved — `name`; при pending/rejected с заморозкой — `catalogListedName`. */
export function directoryListedDisplayName(
  user: DirectoryUserListedNameShape,
): string {
  if (user.nameModerationStatus === PublicationModerationStatus.approved) {
    return user.name;
  }
  const frozen = user.catalogListedName?.trim();
  if (
    (user.nameModerationStatus === PublicationModerationStatus.pending_review ||
      user.nameModerationStatus === PublicationModerationStatus.rejected) &&
    frozen != null &&
    frozen.length > 0
  ) {
    return frozen;
  }
  return user.name;
}
