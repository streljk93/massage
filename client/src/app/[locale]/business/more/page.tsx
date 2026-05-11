import { redirect } from "next/navigation";

type Props = {
  params: Promise<{ locale: string }>;
};

/** Старый маршрут «Ещё» — перенаправляем в профиль кабинета бизнеса. */
export default async function Page({ params }: Props) {
  const { locale } = await params;
  redirect(`/${locale}/business/profile`);
}
