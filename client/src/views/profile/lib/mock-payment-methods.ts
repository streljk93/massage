export type ProfilePaymentMethodDemo =
  | {
      id: string;
      kind: "cash";
      isDefault: boolean;
    }
  | {
      id: string;
      kind: "card";
      brandKey: "demoVisa" | "demoMastercard";
      last4: string;
      expMonth: string;
      expYear: string;
      isDefault: boolean;
    };

export const profilePaymentMethodsMock: ProfilePaymentMethodDemo[] = [
  {
    id: "cash",
    kind: "cash",
    isDefault: true,
  },
  {
    id: "pm1",
    kind: "card",
    brandKey: "demoVisa",
    last4: "4242",
    expMonth: "12",
    expYear: "28",
    isDefault: false,
  },
  {
    id: "pm2",
    kind: "card",
    brandKey: "demoMastercard",
    last4: "5544",
    expMonth: "06",
    expYear: "27",
    isDefault: false,
  },
];
