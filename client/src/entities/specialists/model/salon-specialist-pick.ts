/** Снимок специалиста для выбора в контексте организации (салона). */
export type SalonSpecialistPick = {
  specialistId: string;
  name: string;
  imageSrc: string;
  imageAlt: string;
  rating: number;
  metaLine: string;
  specialtiesLine: string;
};
