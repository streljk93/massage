import { BusinessLayerChrome } from "@/widgets/business/chrome";

type Props = {
  children: React.ReactNode;
};

/**
 * Кабинет бизнеса: каркас, полоса «онбординг не завершён» и нижняя навигация после полной настройки.
 */
export default function BusinessLayout({ children }: Props) {
  return <BusinessLayerChrome>{children}</BusinessLayerChrome>;
}
