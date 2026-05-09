/** Секция навыков (подкатегории каталога) для мульти-выбора без цены/длительности. */
export type ServiceCategorySkillSection = {
  majorSlug: string;
  majorName: string;
  items: Array<{ categoryId: string; name: string }>;
};

export type ServiceCategorySkillsPickerProps = {
  sections: ServiceCategorySkillSection[];
  selectedIds: ReadonlySet<string>;
  onToggle: (categoryId: string) => void;
  disabled?: boolean;
  groupAriaLabel: (majorName: string) => string;
  optionAriaLabel: (name: string) => string;
};
