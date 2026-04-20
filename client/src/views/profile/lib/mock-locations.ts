export type ProfileLocationOptionId =
  | "phu-quoc"
  | "ho-chi-minh"
  | "hanoi"
  | "da-nang";

export const profileLocationOptions: {
  id: ProfileLocationOptionId;
  labelKey:
    | "cityPhuQuoc"
    | "cityHoChiMinh"
    | "cityHanoi"
    | "cityDaNang";
}[] = [
  { id: "phu-quoc", labelKey: "cityPhuQuoc" },
  { id: "ho-chi-minh", labelKey: "cityHoChiMinh" },
  { id: "da-nang", labelKey: "cityDaNang" },
  { id: "hanoi", labelKey: "cityHanoi" },
];

/** Дефолтный город в демо-профиле (Phu Quoc). */
export const defaultProfileLocationId: ProfileLocationOptionId = "phu-quoc";
