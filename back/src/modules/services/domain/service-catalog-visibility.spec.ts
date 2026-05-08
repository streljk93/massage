import { ServiceCatalogScope } from '@prisma/client';
import {
  isCategoryMajorInOrganizationSet,
  isSalonCounterServiceScope,
  isServiceBookableMatchingDirectoryVitrineRules,
} from './service-catalog-visibility';

describe('service-catalog-visibility', () => {
  describe('isSalonCounterServiceScope', () => {
    it('personal scope только при null organizationId', () => {
      expect(
        isSalonCounterServiceScope({
          scope: ServiceCatalogScope.personal,
          serviceOrganizationId: null,
          workplaceOrganizationId: 'org-1',
        }),
      ).toBe(true);
      expect(
        isSalonCounterServiceScope({
          scope: ServiceCatalogScope.personal,
          serviceOrganizationId: 'org-1',
          workplaceOrganizationId: 'org-1',
        }),
      ).toBe(false);
    });

    it('organization scope требует совпадения салона', () => {
      expect(
        isSalonCounterServiceScope({
          scope: ServiceCatalogScope.organization,
          serviceOrganizationId: 'org-1',
          workplaceOrganizationId: 'org-1',
        }),
      ).toBe(true);
      expect(
        isSalonCounterServiceScope({
          scope: ServiceCatalogScope.organization,
          serviceOrganizationId: 'org-1',
          workplaceOrganizationId: 'org-2',
        }),
      ).toBe(false);
      expect(
        isSalonCounterServiceScope({
          scope: ServiceCatalogScope.organization,
          serviceOrganizationId: 'org-1',
          workplaceOrganizationId: null,
        }),
      ).toBe(false);
    });
  });

  describe('isCategoryMajorInOrganizationSet', () => {
    it('выбирает по major id', () => {
      expect(
        isCategoryMajorInOrganizationSet('m1', new Set(['m1', 'm2'])),
      ).toBe(true);
      expect(isCategoryMajorInOrganizationSet('m9', new Set(['m1']))).toBe(
        false,
      );
    });
  });

  describe('isServiceBookableMatchingDirectoryVitrineRules', () => {
    const base = {
      categoryMajorServiceCategoryId: 'major-a',
      serviceIsActive: true,
      serviceDeletedAt: null,
      specialistListedInDirectory: true,
      scope: ServiceCatalogScope.personal,
      serviceOrganizationId: null as string | null,
    };

    it('отклоняет неактивную / удалённую услугу', () => {
      expect(
        isServiceBookableMatchingDirectoryVitrineRules({
          ...base,
          serviceIsActive: false,
          workplaceOrganizationId: null,
          workplaceOrganizationMajorCategoryIds: null,
        }),
      ).toBe(false);
      expect(
        isServiceBookableMatchingDirectoryVitrineRules({
          ...base,
          serviceDeletedAt: new Date(),
          workplaceOrganizationId: null,
          workplaceOrganizationMajorCategoryIds: null,
        }),
      ).toBe(false);
    });

    it('отклоняет мастера без витринного listing', () => {
      expect(
        isServiceBookableMatchingDirectoryVitrineRules({
          ...base,
          specialistListedInDirectory: false,
          workplaceOrganizationId: null,
          workplaceOrganizationMajorCategoryIds: null,
        }),
      ).toBe(false);
    });

    it('без салона: только personal', () => {
      expect(
        isServiceBookableMatchingDirectoryVitrineRules({
          ...base,
          scope: ServiceCatalogScope.personal,
          serviceOrganizationId: null,
          workplaceOrganizationId: null,
          workplaceOrganizationMajorCategoryIds: null,
        }),
      ).toBe(true);
      expect(
        isServiceBookableMatchingDirectoryVitrineRules({
          ...base,
          scope: ServiceCatalogScope.organization,
          serviceOrganizationId: 'org-1',
          workplaceOrganizationId: null,
          workplaceOrganizationMajorCategoryIds: null,
        }),
      ).toBe(false);
    });

    it('с салоном: нужен major в списке организации', () => {
      expect(
        isServiceBookableMatchingDirectoryVitrineRules({
          ...base,
          scope: ServiceCatalogScope.personal,
          serviceOrganizationId: null,
          workplaceOrganizationId: 'org-1',
          workplaceOrganizationMajorCategoryIds: ['major-a'],
        }),
      ).toBe(true);
      expect(
        isServiceBookableMatchingDirectoryVitrineRules({
          ...base,
          scope: ServiceCatalogScope.personal,
          serviceOrganizationId: null,
          workplaceOrganizationId: 'org-1',
          workplaceOrganizationMajorCategoryIds: ['other'],
        }),
      ).toBe(false);
      expect(
        isServiceBookableMatchingDirectoryVitrineRules({
          ...base,
          scope: ServiceCatalogScope.personal,
          serviceOrganizationId: null,
          workplaceOrganizationId: 'org-1',
          workplaceOrganizationMajorCategoryIds: [],
        }),
      ).toBe(false);
    });
  });
});
