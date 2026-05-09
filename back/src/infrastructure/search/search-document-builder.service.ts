import { Injectable } from '@nestjs/common';
import { MARKETPLACE_OFFERING_DOCUMENT_SCHEMA_VERSION } from './marketplace-document-schema.const';

/** Для сборки документа маркетплейса из `OrganizationOffering`. */
export type OrganizationOfferingForSearchDoc = {
  id: string;
  organizationId: string;
  title: string;
  slug: string;
  categorySlug: string;
};

/**
 * Сборка документов маркетплейса (ADR §3 — оффер точки).
 * Effective price подставляет индексатор через {@link PricingResolver}.
 */
@Injectable()
export class SearchDocumentBuilderService {
  buildFromOrganizationOffering(input: OrganizationOfferingForSearchDoc): Record<
    string,
    unknown
  > {
    return {
      schemaVersion: MARKETPLACE_OFFERING_DOCUMENT_SCHEMA_VERSION,
      source: 'organization_offering',
      organizationOfferingId: input.id,
      organizationId: input.organizationId,
      categorySlug: input.categorySlug,
      title: input.title,
      slug: input.slug,
    };
  }
}
