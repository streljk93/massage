import { redirect } from "next/navigation";

type Props = {
  params: Promise<{ locale: string; jobPostingId: string }>;
};

/** Старый маршрут вакансии перенесён в отдельный раздел найма. */
export default async function Page({ params }: Props) {
  const { locale, jobPostingId } = await params;
  redirect(`/${locale}/business/hiring/job-postings/${jobPostingId}`);
}
