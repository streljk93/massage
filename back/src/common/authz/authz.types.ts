export type Capability = string;

export type PolicySubject =
  | { type: string; [key: string]: unknown }
  | null
  | undefined;

export type Ability<Cap extends Capability, Subject extends PolicySubject> = {
  can(capability: Cap, subject?: Subject): boolean;
};

