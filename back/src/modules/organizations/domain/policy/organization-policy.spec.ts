import {
  OrganizationBookingActions,
  OrganizationCalendarActions,
  OrganizationCapabilities,
  canOrganization,
  explainOrganizationPolicy,
  type OrganizationAccessContext,
} from './index';
import { buildOrganizationScope } from '../organization-scope';
import { buildOrganizationPermissions } from '../organization-permissions';

const baseCtx: OrganizationAccessContext = {
  userId: 'user-1',
  organizationId: 'org-1',
  isOwner: false,
  role: null,
  specialistId: null,
  isPlatformMaster: false,
};

describe('organization policy', () => {
  it('allows owner/admin to manage organization profile', () => {
    const owner = { ...baseCtx, isOwner: true };
    const admin = { ...baseCtx, role: 'admin' as const, specialistId: 'sp-1' };

    expect(
      canOrganization(owner, OrganizationCapabilities.PROFILE_MANAGE, {
        type: 'Organization',
        organizationId: 'org-1',
      }),
    ).toBe(true);
    expect(
      canOrganization(admin, OrganizationCapabilities.PROFILE_MANAGE, {
        type: 'Organization',
        organizationId: 'org-1',
      }),
    ).toBe(true);
  });

  it('limits specialist booking management to own bookings', () => {
    const specialist = {
      ...baseCtx,
      role: 'specialist' as const,
      specialistId: 'sp-1',
    };

    expect(
      canOrganization(specialist, OrganizationCapabilities.BOOKINGS, {
        type: 'Booking',
        action: OrganizationBookingActions.CONFIRM,
        organizationId: 'org-1',
        specialistId: 'sp-1',
      }),
    ).toBe(true);

    const decision = explainOrganizationPolicy(
      specialist,
      OrganizationCapabilities.BOOKINGS,
      {
        type: 'Booking',
        action: OrganizationBookingActions.CONFIRM,
        organizationId: 'org-1',
        specialistId: 'sp-2',
      },
    );
    expect(decision.allowed).toBe(false);
    if (!decision.allowed) {
      expect(decision.reason).toBe('NOT_OWN_BOOKING');
      expect(decision.metadata?.subjectAction).toBe(
        OrganizationBookingActions.CONFIRM,
      );
    }
  });

  it('forbids specialist-role booking cancellation even for own organization booking', () => {
    const specialist = {
      ...baseCtx,
      role: 'specialist' as const,
      specialistId: 'sp-1',
    };

    const decision = explainOrganizationPolicy(
      specialist,
      OrganizationCapabilities.BOOKINGS,
      {
        type: 'Booking',
        action: OrganizationBookingActions.CANCEL,
        organizationId: 'org-1',
        specialistId: 'sp-1',
      },
    );

    expect(decision.allowed).toBe(false);
    if (!decision.allowed) {
      expect(decision.reason).toBe('NOT_MANAGER');
    }
  });

  it('does not turn platform master into implicit organization manager', () => {
    const platform = { ...baseCtx, isPlatformMaster: true };

    expect(
      canOrganization(platform, OrganizationCapabilities.BOOKINGS, {
        type: 'Booking',
        action: OrganizationBookingActions.VIEW,
        organizationId: 'org-1',
        specialistId: 'sp-1',
      }),
    ).toBe(true);

    expect(
      canOrganization(platform, OrganizationCapabilities.BOOKINGS, {
        type: 'Booking',
        action: OrganizationBookingActions.CANCEL,
        organizationId: 'org-1',
        specialistId: 'sp-1',
      }),
    ).toBe(false);

    expect(buildOrganizationScope(platform).bookings).toEqual({
      AND: [{ id: null }],
    });
  });

  it('keeps permissions and scope aligned for specialist own access', () => {
    const specialist = {
      ...baseCtx,
      role: 'specialist' as const,
      specialistId: 'sp-1',
    };

    expect(buildOrganizationScope(specialist).bookings).toEqual({
      specialistId: 'sp-1',
    });
    expect(buildOrganizationPermissions(specialist).bookings).toMatchObject({
      manageAll: false,
      manageOwn: true,
      confirm: true,
      cancel: false,
    });
    expect(buildOrganizationPermissions(specialist).calendar).toMatchObject({
      manage: true,
      manageAll: false,
      manageWorkingHours: false,
    });
  });

  it('keeps client-list booking scope aligned for organization managers and specialists', () => {
    const owner = { ...baseCtx, isOwner: true };
    const admin = { ...baseCtx, role: 'admin' as const, specialistId: 'sp-1' };
    const specialist = {
      ...baseCtx,
      role: 'specialist' as const,
      specialistId: 'sp-2',
    };

    expect(buildOrganizationScope(owner).bookings).toEqual({});
    expect(buildOrganizationScope(admin).bookings).toEqual({});
    expect(buildOrganizationScope(specialist).bookings).toEqual({
      specialistId: 'sp-2',
    });
  });

  it('exposes delete permission only for the organization owner', () => {
    expect(
      buildOrganizationPermissions({ ...baseCtx, isOwner: true }).profile,
    ).toMatchObject({
      manage: true,
      delete: true,
    });
    expect(
      buildOrganizationPermissions({
        ...baseCtx,
        role: 'admin',
        specialistId: 'sp-1',
      }).profile,
    ).toMatchObject({
      manage: true,
      delete: false,
    });
  });

  it('exposes hiring permissions only to organization managers', () => {
    const owner = { ...baseCtx, isOwner: true };
    const admin = { ...baseCtx, role: 'admin' as const, specialistId: 'sp-1' };
    const specialist = {
      ...baseCtx,
      role: 'specialist' as const,
      specialistId: 'sp-2',
    };

    for (const caps of [
      OrganizationCapabilities.HIRING_VIEW,
      OrganizationCapabilities.MARKETING_VIEW,
      OrganizationCapabilities.ANALYTICS_VIEW,
    ] as const) {
      for (const ctx of [owner, admin]) {
        expect(canOrganization(ctx, caps)).toBe(true);
      }
      expect(canOrganization(specialist, caps)).toBe(false);
    }

    for (const ctx of [owner, admin]) {
      expect(buildOrganizationPermissions(ctx).hiring).toMatchObject({
        view: true,
        manage: true,
        reviewApplications: true,
        accept: true,
      });
      expect(buildOrganizationPermissions(ctx).marketing).toMatchObject({
        view: true,
      });
      expect(buildOrganizationPermissions(ctx).analytics).toMatchObject({
        view: true,
      });
    }

    expect(
      canOrganization(specialist, OrganizationCapabilities.HIRING_VIEW),
    ).toBe(false);
    expect(buildOrganizationPermissions(specialist).hiring).toMatchObject({
      view: false,
      manage: false,
      reviewApplications: false,
      accept: false,
    });
    expect(buildOrganizationPermissions(specialist).marketing).toMatchObject({
      view: false,
    });
    expect(buildOrganizationPermissions(specialist).analytics).toMatchObject({
      view: false,
    });
  });

  it('keeps team role and removal permissions behind their own capabilities', () => {
    const owner = { ...baseCtx, isOwner: true };
    const admin = { ...baseCtx, role: 'admin' as const, specialistId: 'sp-1' };

    expect(
      canOrganization(owner, OrganizationCapabilities.TEAM_MANAGE_ROLES),
    ).toBe(true);
    expect(
      canOrganization(owner, OrganizationCapabilities.TEAM_REMOVE_MEMBERS),
    ).toBe(true);
    expect(buildOrganizationPermissions(owner).team).toMatchObject({
      manageRoles: true,
      removeMembers: true,
    });

    expect(
      canOrganization(admin, OrganizationCapabilities.TEAM_MANAGE_ROLES),
    ).toBe(false);
    expect(
      canOrganization(admin, OrganizationCapabilities.TEAM_REMOVE_MEMBERS),
    ).toBe(false);
    expect(buildOrganizationPermissions(admin).team).toMatchObject({
      manageRoles: false,
      removeMembers: false,
    });
  });

  it('allows specialist to manage only self-created calendar blocks on own resource', () => {
    const specialist = {
      ...baseCtx,
      userId: 'user-1',
      role: 'specialist' as const,
      specialistId: 'sp-1',
    };

    expect(
      canOrganization(specialist, OrganizationCapabilities.CALENDAR, {
        type: 'Resource',
        action: 'manage',
        organizationId: 'org-1',
        specialistId: 'sp-1',
        createdByUserId: 'user-1',
      }),
    ).toBe(true);

    const decision = explainOrganizationPolicy(
      specialist,
      OrganizationCapabilities.CALENDAR,
      {
        type: 'Resource',
        action: 'manage',
        organizationId: 'org-1',
        specialistId: 'sp-1',
        createdByUserId: 'admin-user',
      },
    );

    expect(decision.allowed).toBe(false);
    if (!decision.allowed) {
      expect(decision.reason).toBe('NOT_RESOURCE_EVENT_AUTHOR');
    }
  });

  it('allows only organization managers to change working hours', () => {
    const owner = { ...baseCtx, isOwner: true };
    const specialist = {
      ...baseCtx,
      role: 'specialist' as const,
      specialistId: 'sp-1',
    };

    expect(
      canOrganization(owner, OrganizationCapabilities.CALENDAR, {
        type: 'Resource',
        action: OrganizationCalendarActions.MANAGE_WORKING_HOURS,
        organizationId: 'org-1',
        specialistId: 'sp-1',
      }),
    ).toBe(true);

    const decision = explainOrganizationPolicy(
      specialist,
      OrganizationCapabilities.CALENDAR,
      {
        type: 'Resource',
        action: OrganizationCalendarActions.MANAGE_WORKING_HOURS,
        organizationId: 'org-1',
        specialistId: 'sp-1',
      },
    );

    expect(decision.allowed).toBe(false);
    if (!decision.allowed) {
      expect(decision.reason).toBe('NOT_MANAGER');
    }
  });
});
