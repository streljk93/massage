import type { createBrowserSdkClient } from "@/shared/api";

export type ProvisionOrganizationTeamMemberBody = {
  email: string;
  name: string;
  phone?: string | null;
  password?: string | null;
  targetRole?: "admin" | "specialist";
  imageUrl?: string | null;
};

export type ProvisionOrganizationTeamMemberResponse = {
  createdUser: boolean;
  member: {
    employmentId: string;
    specialistId: string;
    userId: string;
    email: string;
    displayName: string | null;
    role: "admin" | "specialist";
  };
};

type SdkClient = ReturnType<typeof createBrowserSdkClient>;

/** До `openapi:sync` — прямой POST на новый endpoint кабинета. */
export async function provisionOrganizationTeamMember(
  client: SdkClient,
  organizationId: string,
  body: ProvisionOrganizationTeamMemberBody,
): Promise<
  | { data: ProvisionOrganizationTeamMemberResponse; error: null }
  | { data: null; error: unknown }
> {
  const res = (await client.post({
    security: [{ scheme: "bearer", type: "http" }],
    url: "/organizations/{organizationId}/cabinet-team/provision-member",
    path: { organizationId },
    body,
    headers: { "Content-Type": "application/json" },
    suppressGlobalErrorToast: true,
  } as Parameters<SdkClient["post"]>[0])) as {
    data?: ProvisionOrganizationTeamMemberResponse;
    error?: unknown;
  };
  if (res.error != null) {
    return { data: null, error: res.error };
  }
  if (res.data == null) {
    return { data: null, error: new Error("Empty provision-member response") };
  }
  return { data: res.data, error: null };
}
