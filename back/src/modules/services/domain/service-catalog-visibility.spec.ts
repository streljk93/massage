import {
  isCategoryMajorInOrganizationSet,
  isOrganizationOfferingBookableMatchingDirectoryVitrineRules,
} from './service-catalog-visibility';

describe('service-catalog-visibility', () => {
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

  describe('isOrganizationOfferingBookableMatchingDirectoryVitrineRules', () => {
    const base = {
      offeringOrganizationId: 'org-1',
      categoryMajorServiceCategoryId: 'major-a',
      specialistListedInDirectory: true,
    };

    it('отклоняет мастера без витринного listing', () => {
      expect(
        isOrganizationOfferingBookableMatchingDirectoryVitrineRules({
          ...base,
          specialistListedInDirectory: false,
          workplaceOrganizationId: 'org-1',
          workplaceOrganizationMajorCategoryIds: ['major-a'],
        }),
      ).toBe(false);
    });

    it('без активного салона — отказ', () => {
      expect(
        isOrganizationOfferingBookableMatchingDirectoryVitrineRules({
          ...base,
          workplaceOrganizationId: null,
          workplaceOrganizationMajorCategoryIds: null,
        }),
      ).toBe(false);
    });

    it('несовпадение организации оффера и места приёма', () => {
      expect(
        isOrganizationOfferingBookableMatchingDirectoryVitrineRules({
          ...base,
          offeringOrganizationId: 'org-99',
          workplaceOrganizationId: 'org-1',
          workplaceOrganizationMajorCategoryIds: ['major-a'],
        }),
      ).toBe(false);
    });

    it('major должен быть в списке организации', () => {
      expect(
        isOrganizationOfferingBookableMatchingDirectoryVitrineRules({
          ...base,
          workplaceOrganizationId: 'org-1',
          workplaceOrganizationMajorCategoryIds: ['major-a'],
        }),
      ).toBe(true);
      expect(
        isOrganizationOfferingBookableMatchingDirectoryVitrineRules({
          ...base,
          workplaceOrganizationId: 'org-1',
          workplaceOrganizationMajorCategoryIds: ['other'],
        }),
      ).toBe(false);
      expect(
        isOrganizationOfferingBookableMatchingDirectoryVitrineRules({
          ...base,
          workplaceOrganizationId: 'org-1',
          workplaceOrganizationMajorCategoryIds: [],
        }),
      ).toBe(false);
    });
  });
});
