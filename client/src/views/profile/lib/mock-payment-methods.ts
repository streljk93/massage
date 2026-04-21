export type ProfilePaymentMethodDemo = {
  id: string;
  kind: "cash";
  isDefault: boolean;
};

export const profilePaymentMethodsMock: ProfilePaymentMethodDemo[] = [
  {
    id: "cash",
    kind: "cash",
    isDefault: true,
  },
];
