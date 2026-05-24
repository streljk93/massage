import { cn } from "@/shared/lib";

/** Корень клиентской страницы: отступ под нижнее меню на mobile, компактный на desktop. */
export function consumerPageRootClass(className?: string) {
  return cn(
    "flex min-h-screen flex-col pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))] lg:pb-6",
    className,
  );
}

/** Основной контент: ширина как у профиля салона/мастера. */
export function consumerPageMainClass(className?: string) {
  return cn("mx-auto w-full max-w-7xl flex-1 px-4 pt-3 lg:px-12", className);
}

/** Subpage с фиксированным back + заголовком (mobile). */
export function consumerSubpageContentClass(className?: string) {
  return cn(consumerPageMainClass("pt-4 lg:pt-6"), className);
}
