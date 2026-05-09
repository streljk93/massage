/** Рубрика каталога для онбординга и экранов ЛК (навыки, без личного прайса). */
export type Cat = {
  id: string;
  slug: string;
  name: string;
  shortName: string;
  description: string | null;
  label: string;
};
