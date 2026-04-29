import {
  isPlausibleVnNational,
  toE164Vietnam,
} from "../setup/lib/specialist-onboarding-utils";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeWebsiteOnBlur(raw: string): string {
  const t = raw.trim();
  if (!t) {
    return "";
  }
  if (/^https?:\/\//i.test(t)) {
    return t;
  }
  return `https://${t}`;
}

export function normalizeEmailOnBlur(raw: string): string {
  return raw.trim().toLowerCase();
}

export type OrgContactValidationErrorKey =
  | "vErrPhone"
  | "vErrOrgEmail"
  | "vErrOrgWebsite";

export type OrgContactValidated = {
  phone: string | null;
  email: string | null;
  website: string | null;
};

export function validateOrgContactForSubmit(args: {
  phoneLocalDigits: string;
  email: string;
  website: string;
}):
  | { ok: true; value: OrgContactValidated }
  | { ok: false; errorKey: OrgContactValidationErrorKey } {
  const phoneDigits = args.phoneLocalDigits.replace(/\D/g, "");
  if (phoneDigits.length > 0 && !isPlausibleVnNational(phoneDigits)) {
    return { ok: false, errorKey: "vErrPhone" };
  }

  const emailT = args.email.trim().toLowerCase();
  if (emailT.length > 0 && !EMAIL_RE.test(emailT)) {
    return { ok: false, errorKey: "vErrOrgEmail" };
  }

  const webRaw = args.website.trim();
  if (webRaw.length > 0) {
    const withScheme = /^https?:\/\//i.test(webRaw) ? webRaw : `https://${webRaw}`;
    try {
      const u = new URL(withScheme);
      if (u.protocol !== "http:" && u.protocol !== "https:") {
        throw new Error("protocol");
      }
    } catch {
      return { ok: false, errorKey: "vErrOrgWebsite" };
    }
  }

  return {
    ok: true,
    value: {
      phone: phoneDigits.length === 0 ? null : toE164Vietnam(phoneDigits),
      email: emailT.length === 0 ? null : emailT,
      website:
        webRaw.length === 0 ? null
        : /^https?:\/\//i.test(webRaw) ? webRaw
        : `https://${webRaw}`,
    },
  };
}
