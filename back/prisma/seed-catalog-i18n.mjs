/**
 * Локали каталога (совпадают с UI next-intl). Новый язык — новый ключ в объектах + строки в БД.
 * @typedef {'en' | 'vi' | 'ru'} CatalogLocale
 */

/** @type {readonly CatalogLocale[]} */
export const SUPPORTED_CATALOG_LOCALES = ['en', 'vi', 'ru'];

/** Имена большой категории «Массаж» по локалям. */
export const majorMassageI18n = /** @type {Record<CatalogLocale, string>} */ ({
  en: 'Massage',
  vi: 'Massage',
  ru: 'Массаж',
});

/** Имена большой категории «Ногти» по локалям. */
export const majorNailI18n = /** @type {Record<CatalogLocale, string>} */ ({
  en: 'Nail',
  vi: 'Nail',
  ru: 'Ногти',
});

/**
 * Полное имя и короткое имя подкатегории по локалям (slug как в `ServiceCategory.slug`).
 * @type {Record<string, Record<CatalogLocale, { name: string; shortName: string }>>}
 */
export const serviceCategoryI18n = {
  'thai-massage': {
    en: { name: 'Thai massage', shortName: 'Thai' },
    vi: { name: 'Massage Thái', shortName: 'Thái' },
    ru: { name: 'Тайский массаж', shortName: 'тайский' },
  },
  'aroma-massage': {
    en: { name: 'Aromatherapy massage', shortName: 'Aroma' },
    vi: { name: 'Massage hương liệu', shortName: 'Hương liệu' },
    ru: { name: 'Аромамассаж', shortName: 'арома' },
  },
  'herbal-massage': {
    en: { name: 'Herbal massage', shortName: 'Herbal' },
    vi: { name: 'Massage thảo dược', shortName: 'Thảo dược' },
    ru: { name: 'Травяной массаж', shortName: 'травяной' },
  },
  'deep-tissue-massage': {
    en: { name: 'Deep tissue massage', shortName: 'Deep tissue' },
    vi: { name: 'Massage mô sâu', shortName: 'Mô sâu' },
    ru: { name: 'Глубокотканный массаж', shortName: 'глубокий' },
  },
  'hot-stone-massage': {
    en: { name: 'Hot stone massage', shortName: 'Hot stone' },
    vi: { name: 'Massage đá nóng', shortName: 'Đá nóng' },
    ru: { name: 'Массаж горячими камнями', shortName: 'стоун' },
  },
  'foot-massage': {
    en: { name: 'Foot massage', shortName: 'Foot' },
    vi: { name: 'Massage chân', shortName: 'Chân' },
    ru: { name: 'Массаж стоп', shortName: 'стопы' },
  },
  'hair-wash': {
    en: { name: 'Hair wash massage', shortName: 'Hair wash' },
    vi: { name: 'Gội đầu thư giãn', shortName: 'Gội đầu' },
    ru: { name: 'Массаж с мытьем головы', shortName: 'мытье головы' },
  },
  'prenatal-massage': {
    en: { name: 'Prenatal massage', shortName: 'Prenatal' },
    vi: { name: 'Massage cho bà bầu', shortName: 'Bầu' },
    ru: { name: 'Массаж для беременных', shortName: 'беременность' },
  },
  'kids-massage': {
    en: { name: 'Kids massage', shortName: 'Kids' },
    vi: { name: 'Massage cho trẻ em', shortName: 'Trẻ em' },
    ru: { name: 'Детский массаж', shortName: 'детский' },
  },
  'neck-shoulder-back-therapy': {
    en: { name: 'Neck, shoulder and back therapy', shortName: 'Neck-shoulder-back' },
    vi: { name: 'Trị liệu cổ vai gáy và lưng', shortName: 'Cổ vai gáy' },
    ru: { name: 'Терапия шеи, плеч и спины', shortName: 'шея-плечи-спина' },
  },
  combo: {
    en: { name: 'Massage combo', shortName: 'Combo' },
    vi: { name: 'Combo massage', shortName: 'Combo' },
    ru: { name: 'Комбо-массаж', shortName: 'комбо' },
  },
  'nail-color': {
    en: { name: 'Nail color', shortName: 'Nail color' },
    vi: { name: 'Sơn móng', shortName: 'Sơn móng' },
    ru: { name: 'Покрытие ногтей', shortName: 'покрытие' },
  },
  manicure: {
    en: { name: 'Manicure', shortName: 'Manicure' },
    vi: { name: 'Làm móng tay', shortName: 'Manicure' },
    ru: { name: 'Маникюр', shortName: 'маникюр' },
  },
  pedicure: {
    en: { name: 'Pedicure', shortName: 'Pedicure' },
    vi: { name: 'Làm móng chân', shortName: 'Pedicure' },
    ru: { name: 'Педикюр', shortName: 'педикюр' },
  },
  'nail-care': {
    en: { name: 'Nail care', shortName: 'Nail care' },
    vi: { name: 'Chăm sóc móng', shortName: 'Chăm sóc móng' },
    ru: { name: 'Уход за ногтями', shortName: 'уход' },
  },
};

/** Порядок и slug подкатегорий «Массаж» (канонические поля родителя = en). */
export const massageCategorySeeds = [
  { slug: 'thai-massage', sortOrder: 0 },
  { slug: 'aroma-massage', sortOrder: 1 },
  { slug: 'herbal-massage', sortOrder: 2 },
  { slug: 'deep-tissue-massage', sortOrder: 3 },
  { slug: 'hot-stone-massage', sortOrder: 4 },
  { slug: 'foot-massage', sortOrder: 5 },
  { slug: 'hair-wash', sortOrder: 6 },
  { slug: 'prenatal-massage', sortOrder: 7 },
  { slug: 'kids-massage', sortOrder: 8 },
  { slug: 'neck-shoulder-back-therapy', sortOrder: 9 },
  { slug: 'combo', sortOrder: 10 },
];

/** Порядок и slug подкатегорий «Ногти». */
export const nailCategorySeeds = [
  { slug: 'nail-color', sortOrder: 0 },
  { slug: 'manicure', sortOrder: 1 },
  { slug: 'pedicure', sortOrder: 2 },
  { slug: 'nail-care', sortOrder: 3 },
];

/**
 * Анатомические зоны (только для вертикали massage на MVP).
 * @type {Record<string, Record<CatalogLocale, { name: string }>>}
 */
export const bodyZoneI18n = {
  head: {
    en: { name: 'Head' },
    vi: { name: 'Đầu' },
    ru: { name: 'Голова' },
  },
  face: {
    en: { name: 'Face' },
    vi: { name: 'Mặt' },
    ru: { name: 'Лицо' },
  },
  neck: {
    en: { name: 'Neck' },
    vi: { name: 'Cổ' },
    ru: { name: 'Шея' },
  },
  shoulders: {
    en: { name: 'Shoulders' },
    vi: { name: 'Vai' },
    ru: { name: 'Плечи' },
  },
  arms: {
    en: { name: 'Arms' },
    vi: { name: 'Tay' },
    ru: { name: 'Руки' },
  },
  hands: {
    en: { name: 'Hands' },
    vi: { name: 'Bàn tay' },
    ru: { name: 'Кисти' },
  },
  chest: {
    en: { name: 'Chest' },
    vi: { name: 'Ngực' },
    ru: { name: 'Грудь' },
  },
  abdomen: {
    en: { name: 'Abdomen' },
    vi: { name: 'Bụng' },
    ru: { name: 'Живот' },
  },
  'back-upper': {
    en: { name: 'Upper back' },
    vi: { name: 'Lưng trên' },
    ru: { name: 'Верх спины' },
  },
  'back-lower': {
    en: { name: 'Lower back' },
    vi: { name: 'Lưng dưới' },
    ru: { name: 'Поясница' },
  },
  glutes: {
    en: { name: 'Glutes' },
    vi: { name: 'Mông' },
    ru: { name: 'Ягодицы' },
  },
  thighs: {
    en: { name: 'Thighs' },
    vi: { name: 'Đùi' },
    ru: { name: 'Бедра' },
  },
  knees: {
    en: { name: 'Knees' },
    vi: { name: 'Đầu gối' },
    ru: { name: 'Колени' },
  },
  calves: {
    en: { name: 'Calves' },
    vi: { name: 'Bắp chân' },
    ru: { name: 'Икры' },
  },
  feet: {
    en: { name: 'Feet' },
    vi: { name: 'Bàn chân' },
    ru: { name: 'Стопы' },
  },
  'full-body': {
    en: { name: 'Full body' },
    vi: { name: 'Toàn thân' },
    ru: { name: 'Все тело' },
  },
};

/** @type {Array<{ slug: string; sortOrder: number }>} */
export const massageBodyZoneSeeds = [
  { slug: 'head', sortOrder: 0 },
  { slug: 'face', sortOrder: 1 },
  { slug: 'neck', sortOrder: 2 },
  { slug: 'shoulders', sortOrder: 3 },
  { slug: 'arms', sortOrder: 4 },
  { slug: 'hands', sortOrder: 5 },
  { slug: 'chest', sortOrder: 6 },
  { slug: 'abdomen', sortOrder: 7 },
  { slug: 'back-upper', sortOrder: 8 },
  { slug: 'back-lower', sortOrder: 9 },
  { slug: 'glutes', sortOrder: 10 },
  { slug: 'thighs', sortOrder: 11 },
  { slug: 'knees', sortOrder: 12 },
  { slug: 'calves', sortOrder: 13 },
  { slug: 'feet', sortOrder: 14 },
  { slug: 'full-body', sortOrder: 15 },
];
