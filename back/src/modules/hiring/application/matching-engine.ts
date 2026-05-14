import { Injectable } from '@nestjs/common';
import {
  HiringRepository,
  type CandidateSearchFilters,
  type CandidateSearchRow,
} from '../infrastructure/hiring.repository';

export const MATCH_REASON_VALUES = [
  'category_match',
  'experience_match',
  'high_rating',
  'recent_activity',
] as const;

export type MatchReason = (typeof MATCH_REASON_VALUES)[number];

export type MatchingCandidateRow = CandidateSearchRow & {
  matchScore: number;
  matchReasons: MatchReason[];
  matchedCategoryIds: string[];
};

export type MatchingSearchResult = {
  candidates: MatchingCandidateRow[];
  nextCursor: string | null;
};

@Injectable()
export class MatchingEngine {
  constructor(private readonly repository: HiringRepository) {}

  async searchCandidates(
    filters: CandidateSearchFilters,
  ): Promise<MatchingSearchResult> {
    const rows = await this.repository.listCandidates(filters);
    const hasNext = rows.length > filters.limit;
    const page = hasNext ? rows.slice(0, filters.limit) : rows;

    return {
      candidates: page.map((row) => this.rankCandidate(row, filters)),
      nextCursor: hasNext ? (page.at(-1)?.specialistId ?? null) : null,
    };
  }

  private rankCandidate(
    row: CandidateSearchRow,
    filters: CandidateSearchFilters,
  ): MatchingCandidateRow {
    const matchedCategoryIds = row.skillsCategoryIds.filter((categoryId) =>
      filters.skillCategoryIds.includes(categoryId),
    );
    const categoryScore =
      filters.skillCategoryIds.length === 0
        ? 0
        : matchedCategoryIds.length === filters.skillCategoryIds.length
          ? 1
          : matchedCategoryIds.length / filters.skillCategoryIds.length;
    const experienceScore =
      filters.experienceMinYears == null
        ? 0
        : row.experienceYears != null &&
            row.experienceYears >= filters.experienceMinYears
          ? 1
          : 0;
    const activityScore = this.isRecentlyUpdated(row.updatedAt) ? 1 : 0;
    const matchReasons: MatchReason[] = [];
    if (categoryScore > 0) matchReasons.push('category_match');
    if (experienceScore > 0) matchReasons.push('experience_match');
    if (activityScore > 0) matchReasons.push('recent_activity');

    return {
      ...row,
      matchScore: roundMatchScore(
        0.5 * categoryScore + 0.3 * experienceScore + 0.2 * activityScore,
      ),
      matchReasons,
      matchedCategoryIds,
    };
  }

  private isRecentlyUpdated(updatedAt: Date): boolean {
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    return Date.now() - updatedAt.getTime() <= thirtyDaysMs;
  }
}

function roundMatchScore(value: number): number {
  return Math.max(0, Math.min(1, Math.round(value * 100) / 100));
}
