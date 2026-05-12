import { redirect } from "next/navigation";

type Props = {
  params: Promise<{ locale: string }>;
};

/** Старый маршрут поиска специалистов перенесён в отдельный раздел найма. */
export default async function Page({ params }: Props) {
  const { locale } = await params;
  redirect(`/${locale}/business/hiring/search`);
}
