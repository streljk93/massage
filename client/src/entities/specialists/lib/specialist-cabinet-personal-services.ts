import type { CabinetSpecialistBlob } from "../model/cabinet-specialist.types";

export type SpecialistCabinetPersonalServiceRow = {
  id: string;
  categoryId: string;
  categoryName: string;
  /**
   * Показывать ли услугу как доступную при текущем месте приёма: учёт сфер организации и строки услуги.
   * В ответе API нет поля `isActive` услуги.
   */
  listedAtActiveWorkplace: boolean;
  kind: "standard" | "combo";
  comboCategoryIds: string[];
  bodyZoneSlugs: string[];
  priceOptions: Array<{
    durationMinutes: number;
    priceAmount: number;
    currency: string;
  }>;
};

export function specialistPersonalServicesFromCabinetBlob(
  spec: CabinetSpecialistBlob | null | undefined,
): SpecialistCabinetPersonalServiceRow[] {
  if (spec == null || typeof spec !== "object") {
    return [];
  }
  const raw = (spec as { personalServices?: unknown }).personalServices;
  if (!Array.isArray(raw)) {
    return [];
  }
  const out: SpecialistCabinetPersonalServiceRow[] = [];
  for (const row of raw) {
    if (row == null || typeof row !== "object") {
      continue;
    }
    const r = row as Record<string, unknown>;
    const id = typeof r.id === "string" ? r.id : null;
    const categoryId = typeof r.categoryId === "string" ? r.categoryId.trim() : "";
    const categoryName =
      typeof r.categoryName === "string" ? r.categoryName.trim() : "";
    const kind = r.kind === "combo" ? "combo" : "standard";
    const comboCategoryIds = Array.isArray(r.comboCategoryIds)
      ? r.comboCategoryIds.filter((v): v is string => typeof v === "string")
      : [];
    const bodyZoneSlugs = Array.isArray(r.bodyZoneSlugs)
      ? r.bodyZoneSlugs.filter((v): v is string => typeof v === "string")
      : [];
    const listedAtActiveWorkplace =
      typeof r.listedAtActiveWorkplace === "boolean"
        ? r.listedAtActiveWorkplace
        /** Совместимость со старым API */
        : r.isActive === false ?
          false
        : true;
    const poRaw = r.priceOptions;
    if (!id || !categoryId || !categoryName || !Array.isArray(poRaw)) {
      continue;
    }
    const priceOptions: SpecialistCabinetPersonalServiceRow["priceOptions"] = [];
    for (const o of poRaw) {
      if (o == null || typeof o !== "object") {
        continue;
      }
      const op = o as Record<string, unknown>;
      const durationMinutes =
        typeof op.durationMinutes === "number" && Number.isFinite(op.durationMinutes)
          ? op.durationMinutes
          : null;
      const priceAmount =
        typeof op.priceAmount === "number" && Number.isFinite(op.priceAmount)
          ? op.priceAmount
          : null;
      const currency = typeof op.currency === "string" ? op.currency : "VND";
      if (durationMinutes != null && priceAmount != null) {
        priceOptions.push({ durationMinutes, priceAmount, currency });
      }
    }
    if (priceOptions.length === 0) {
      continue;
    }
    out.push({
      id,
      categoryId,
      categoryName,
      listedAtActiveWorkplace,
      kind,
      comboCategoryIds,
      bodyZoneSlugs,
      priceOptions,
    });
  }
  return out;
}
