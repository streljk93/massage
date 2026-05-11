import {
  OrganizationBookingActions,
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
});
