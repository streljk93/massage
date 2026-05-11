import { Injectable, NotFoundException } from '@nestjs/common';
import {
  OrganizationMembershipRole,
  PlatformRole,
  type Prisma,
} from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import {
  assertCanOrganization,
  type OrganizationAccessContext,
  type OrganizationCapability,
  type OrganizationPolicySubject,
} from '../domain/policy';
import {
  buildOrganizationPermissions,
  type OrganizationScopedPermissions,
} from '../domain/organization-permissions';

type PrismaLike = PrismaService | Prisma.TransactionClient;

export class OrganizationAccessContextCache {
  private readonly cache = new Map<string, Promise<OrganizationAccessContext>>();

  constructor(
    private readonly load: (
      userId: string,
      organizationId: string,
    ) => Promise<OrganizationAccessContext>,
  ) {}

  resolve(
    userId: string,
    organizationId: string,
  ): Promise<OrganizationAccessContext> {
    const key = `${userId}:${organizationId}:v1`;
    const existing = this.cache.get(key);
    if (existing != null) {
      return existing;
    }
    const next = this.load(userId, organizationId);
    this.cache.set(key, next);
    return next;
  }
}

@Injectable()
export class OrganizationAccessPolicyService {
  constructor(private readonly prisma: PrismaService) {}

  createContextCache(
    prisma: PrismaLike = this.prisma,
  ): OrganizationAccessContextCache {
    return new OrganizationAccessContextCache((userId, organizationId) =>
      this.loadContext(prisma, userId, organizationId),
    );
  }

  resolveContext(
    userId: string,
    organizationId: string,
  ): Promise<OrganizationAccessContext> {
    return this.loadContext(this.prisma, userId, organizationId);
  }

  resolveContextTx(
    tx: Prisma.TransactionClient,
    userId: string,
    organizationId: string,
  ): Promise<OrganizationAccessContext> {
    return this.loadContext(tx, userId, organizationId);
  }

  async assertCan(
    userId: string,
    organizationId: string,
    capability: OrganizationCapability,
    subject?: OrganizationPolicySubject,
  ): Promise<OrganizationAccessContext> {
    const ctx = await this.resolveContext(userId, organizationId);
    assertCanOrganization(ctx, capability, subject);
    return ctx;
  }

  async buildPermissions(
    userId: string,
    organizationId: string,
  ): Promise<OrganizationScopedPermissions> {
    const ctx = await this.resolveContext(userId, organizationId);
    return buildOrganizationPermissions(ctx);
  }

  buildPermissionsForContext(
    ctx: OrganizationAccessContext,
  ): OrganizationScopedPermissions {
    return buildOrganizationPermissions(ctx);
  }

  private async loadContext(
    prisma: PrismaLike,
    userId: string,
    organizationId: string,
  ): Promise<OrganizationAccessContext> {
    const [org, user, specialist] = await Promise.all([
      prisma.organization.findFirst({
        where: { id: organizationId, deletedAt: null },
        select: { id: true, ownerUserId: true },
      }),
      prisma.user.findFirst({
        where: { id: userId, deletedAt: null },
        select: { platformRole: true },
      }),
      prisma.specialist.findFirst({
        where: { userId, deletedAt: null },
        select: { id: true },
      }),
    ]);

    if (org == null) {
      throw new NotFoundException({
        code: 'ORGANIZATION_NOT_FOUND',
        message: 'Organization not found',
      });
    }

    const specialistId = specialist?.id ?? null;
    const employment =
      specialistId == null
        ? null
        : await prisma.specialistOrganizationEmployment.findFirst({
            where: {
              specialistId,
              organizationId,
              isActive: true,
            },
            select: { role: true },
          });

    return {
      userId,
      organizationId,
      isOwner: org.ownerUserId === userId,
      role: normalizeMembershipRole(employment?.role ?? null),
      specialistId,
      isPlatformMaster: user?.platformRole === PlatformRole.master,
    };
  }
}

function normalizeMembershipRole(
  role: OrganizationMembershipRole | null,
): OrganizationAccessContext['role'] {
  if (role === OrganizationMembershipRole.admin) return 'admin';
  if (role === OrganizationMembershipRole.owner) return 'admin';
  if (role === OrganizationMembershipRole.specialist) return 'specialist';
  return null;
}

