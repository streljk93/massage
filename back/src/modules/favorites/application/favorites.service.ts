import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { FavoriteTargetKind } from '@prisma/client';
import type { ApiLocale } from '../../../common/i18n';
import { DirectoryService } from '../../directory/application/directory.service';
import type { OrganizationListItemDto } from '../../directory/dto/organizations-list-response.dto';
import type { SpecialistListItemDto } from '../../directory/dto/specialists-list-response.dto';
import type {
  AddFavoriteBody,
  MergeFavoritesBody,
} from '../dto/favorites-body.schema';
import { FavoritesRepository } from '../infrastructure/favorites.repository';

export type FavoriteApiItem = {
  targetKind: FavoriteTargetKind;
  targetId: string;
  createdAt: string;
};

@Injectable()
export class FavoritesService {
  constructor(
    private readonly favorites: FavoritesRepository,
    private readonly directory: DirectoryService,
  ) {}

  async list(userId: string): Promise<{ favorites: FavoriteApiItem[] }> {
    const rows = await this.favorites.listByUserId(userId);
    return {
      favorites: rows.map((r) => ({
        targetKind: r.targetKind,
        targetId: r.targetId,
        createdAt: r.createdAt.toISOString(),
      })),
    };
  }

  async listOrganizationsWithListing(
    userId: string,
    locale: ApiLocale,
  ): Promise<{ organizations: OrganizationListItemDto[] }> {
    const rows = await this.favorites.listByUserId(userId);
    const orgIds = rows
      .filter((r) => r.targetKind === 'organization')
      .map((r) => r.targetId);
    const organizations =
      await this.directory.listListingItemsForFavoriteOrganizations(
        locale,
        orgIds,
      );
    return { organizations };
  }

  async listSpecialistsWithListing(
    userId: string,
    locale: ApiLocale,
  ): Promise<{ specialists: SpecialistListItemDto[] }> {
    const rows = await this.favorites.listByUserId(userId);
    const specIds = rows
      .filter((r) => r.targetKind === 'specialist')
      .map((r) => r.targetId);
    const specialists =
      await this.directory.listListingItemsForFavoriteSpecialists(
        locale,
        specIds,
      );
    return { specialists };
  }

  async add(userId: string, body: AddFavoriteBody): Promise<void> {
    await this.assertTargetExists(body.targetKind, body.targetId);
    await this.favorites.createIgnoreDuplicate(
      userId,
      body.targetKind,
      body.targetId,
    );
  }

  async remove(
    userId: string,
    targetKind: FavoriteTargetKind,
    targetId: string,
  ): Promise<void> {
    await this.favorites.deleteOne(userId, targetKind, targetId);
  }

  async merge(
    userId: string,
    body: MergeFavoritesBody,
  ): Promise<{ favorites: FavoriteApiItem[] }> {
    const filtered = await this.filterExistingTargets(body.items);
    await this.favorites.createManyIgnoreDuplicates(userId, filtered);
    return this.list(userId);
  }

  private async assertTargetExists(
    kind: FavoriteTargetKind,
    targetId: string,
  ): Promise<void> {
    const ok =
      kind === 'organization'
        ? (await this.favorites.findActiveOrganizationIds([targetId])).has(
            targetId,
          )
        : (await this.favorites.findActiveSpecialistIds([targetId])).has(
            targetId,
          );
    if (!ok) {
      throw new NotFoundException({
        code: 'FAVORITE_TARGET_NOT_FOUND',
        message: 'Organization or specialist not found or inactive',
      });
    }
  }

  private async filterExistingTargets(
    items: MergeFavoritesBody['items'],
  ): Promise<{ targetKind: FavoriteTargetKind; targetId: string }[]> {
    const orgIds = items
      .filter((i) => i.targetKind === 'organization')
      .map((i) => i.targetId);
    const specIds = items
      .filter((i) => i.targetKind === 'specialist')
      .map((i) => i.targetId);
    const orgOk = await this.favorites.findActiveOrganizationIds(orgIds);
    const specOk = await this.favorites.findActiveSpecialistIds(specIds);
    const seen = new Set<string>();
    const out: { targetKind: FavoriteTargetKind; targetId: string }[] = [];
    for (const i of items) {
      const key = `${i.targetKind}:${i.targetId}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      const exists =
        i.targetKind === 'organization'
          ? orgOk.has(i.targetId)
          : specOk.has(i.targetId);
      if (exists) {
        out.push(i);
      }
    }
    return out;
  }

  parseTargetKindParam(raw: string): FavoriteTargetKind {
    if (raw === 'organization' || raw === 'specialist') {
      return raw;
    }
    throw new BadRequestException({
      code: 'INVALID_TARGET_KIND',
      message: 'targetKind must be organization or specialist',
    });
  }
}
