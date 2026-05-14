import { redirect } from "next/navigation";

type Props = {
  params: Promise<{ locale: string }>;
};

/** Точка входа `/business` — сразу на список мест приёма. */
export default async function Page({ params }: Props) {
  const { locale } = await params;
  redirect(`/${locale}/business/organizations`);
}
