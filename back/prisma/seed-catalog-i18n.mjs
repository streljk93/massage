/**
 * Локали каталога (совпадают с UI next-intl). Новый язык — новый ключ в объектах + строки в БД.
 * @typedef {'en' | 'vi' | 'ru'} CatalogLocale
 */

/** @type {readonly CatalogLocale[]} */
export const SUPPORTED_CATALOG_LOCALES = ["en", "vi", "ru"];

/** Имена большой категории «Массаж» по локалям. */
export const majorMassageI18n = /** @type {Record<CatalogLocale, string>} */ ({
  en: "Massage",
  vi: "Massage",
  ru: "Массаж",
});

/**
 * Полное имя и короткое имя подкатегории по локалям (slug как в `ServiceCategory.slug`).
 * @type {Record<string, Record<CatalogLocale, { name: string; shortName: string }>>}
 */
export const serviceCategoryI18n = {
  neck: {
    en: { name: "Neck and décolletage massage", shortName: "Neck" },
    vi: { name: "Massage cổ và vùng ngực", shortName: "Cổ" },
    ru: { name: "Массаж шеи и зоны декольте", shortName: "шея" },
  },
  body: {
    en: { name: "Full body massage", shortName: "Body" },
    vi: { name: "Massage toàn thân", shortName: "Toàn thân" },
    ru: { name: "Массаж тела (общий)", shortName: "тело" },
  },
  legs: {
    en: { name: "Legs and feet massage", shortName: "Legs" },
    vi: { name: "Massage chân và bàn chân", shortName: "Chân" },
    ru: { name: "Массаж ног и стоп", shortName: "ноги" },
  },
  spa: {
    en: { name: "SPA programs and rituals", shortName: "SPA" },
    vi: { name: "Liệu trình và nghi thức SPA", shortName: "SPA" },
    ru: { name: "СПА-программы и ритуалы", shortName: "спа" },
  },
  back: {
    en: { name: "Back massage", shortName: "Back" },
    vi: { name: "Massage lưng", shortName: "Lưng" },
    ru: { name: "Массаж спины", shortName: "спина" },
  },
  arms: {
    en: { name: "Arms and hands massage", shortName: "Arms" },
    vi: { name: "Massage tay và cánh tay", shortName: "Tay" },
    ru: { name: "Массаж рук и кистей", shortName: "руки" },
  },
  face: {
    en: { name: "Facial massage", shortName: "Face" },
    vi: { name: "Massage mặt", shortName: "Mặt" },
    ru: { name: "Лицевой массаж", shortName: "лицо" },
  },
  relaxing: {
    en: { name: "Relaxing massage", shortName: "Relax" },
    vi: { name: "Massage thư giãn", shortName: "Thư giãn" },
    ru: { name: "Расслабляющий массаж", shortName: "релакс" },
  },
  sports: {
    en: { name: "Sports massage", shortName: "Sports" },
    vi: { name: "Massage thể thao", shortName: "Thể thao" },
    ru: { name: "Спортивный массаж", shortName: "спорт" },
  },
  head: {
    en: { name: "Head massage", shortName: "Head" },
    vi: { name: "Massage đầu", shortName: "Đầu" },
    ru: { name: "Головной массаж", shortName: "голова" },
  },
  lymphatic: {
    en: { name: "Lymphatic drainage massage", shortName: "Lymph" },
    vi: { name: "Massage bạch huyết", shortName: "Bạch huyết" },
    ru: { name: "Лимфодренажный массаж", shortName: "лимфа" },
  },
  thai: {
    en: { name: "Thai massage", shortName: "Thai" },
    vi: { name: "Massage Thái", shortName: "Thái" },
    ru: { name: "Тайский массаж", shortName: "тайский" },
  },
  "hot-stone": {
    en: { name: "Hot stone massage", shortName: "Hot stone" },
    vi: { name: "Massage đá nóng", shortName: "Đá nóng" },
    ru: { name: "Массаж горячими камнями", shortName: "стоун" },
  },
  "anti-cellulite": {
    en: { name: "Anti-cellulite massage", shortName: "Anti-cellulite" },
    vi: { name: "Massage chống da sần vỏ cam", shortName: "Chống sần" },
    ru: { name: "Антицеллюлитный массаж", shortName: "антицеллюлит" },
  },
  honey: {
    en: { name: "Honey massage", shortName: "Honey" },
    vi: { name: "Massage mật ong", shortName: "Mật ong" },
    ru: { name: "Медовый массаж", shortName: "медовый" },
  },
  "feet-reflexology": {
    en: { name: "Foot massage (reflexology)", shortName: "Feet" },
    vi: { name: "Massage bàn chân (phản xạ)", shortName: "Bàn chân" },
    ru: { name: "Массаж стоп (рефлексология)", shortName: "стопы" },
  },
  pressotherapy: {
    en: { name: "Pressotherapy", shortName: "Presso" },
    vi: { name: "Xung điện trị liệu", shortName: "Presso" },
    ru: { name: "Прессотерапия", shortName: "прессо" },
  },
  pregnancy: {
    en: { name: "Prenatal massage", shortName: "Prenatal" },
    vi: { name: "Massage cho bà bầu", shortName: "Bầu" },
    ru: { name: "Массаж для беременных", shortName: "беременность" },
  },
  aroma: {
    en: { name: "Aromatherapy massage", shortName: "Aroma" },
    vi: { name: "Massage hương liệu", shortName: "Hương liệu" },
    ru: { name: "Аромамассаж", shortName: "арома" },
  },
  classic: {
    en: { name: "Classic massage", shortName: "Classic" },
    vi: { name: "Massage cổ điển", shortName: "Cổ điển" },
    ru: { name: "Классический массаж", shortName: "классика" },
  },
};

/** Порядок и slug подкатегорий «Массаж» (канонические поля родителя = en). */
export const massageCategorySeeds = [
  { slug: "neck", sortOrder: 0 },
  { slug: "body", sortOrder: 1 },
  { slug: "legs", sortOrder: 2 },
  { slug: "spa", sortOrder: 3 },
  { slug: "back", sortOrder: 4 },
  { slug: "arms", sortOrder: 5 },
  { slug: "face", sortOrder: 6 },
  { slug: "relaxing", sortOrder: 7 },
  { slug: "sports", sortOrder: 8 },
  { slug: "head", sortOrder: 9 },
  { slug: "lymphatic", sortOrder: 10 },
  { slug: "thai", sortOrder: 11 },
  { slug: "hot-stone", sortOrder: 12 },
  { slug: "anti-cellulite", sortOrder: 13 },
  { slug: "honey", sortOrder: 14 },
  { slug: "feet-reflexology", sortOrder: 15 },
  { slug: "pressotherapy", sortOrder: 16 },
  { slug: "pregnancy", sortOrder: 17 },
  { slug: "aroma", sortOrder: 18 },
  { slug: "classic", sortOrder: 19 },
];
