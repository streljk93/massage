"use client";

import { useId } from "react";
import {
  Avatar as ShadcnAvatar,
  AvatarFallback as ShadcnAvatarFallback,
  AvatarImage as ShadcnAvatarImage,
} from "./shadcn/avatar";

export const Avatar = ShadcnAvatar;
export const AvatarImage = ShadcnAvatarImage;
export const AvatarFallback = ShadcnAvatarFallback;

export type UserAvatarProps = {
  src?: string | null;
  alt: string;
  fallback: string;
  size?: "sm" | "default" | "lg";
  className?: string;
};

export function UserAvatar({
  src,
  alt,
  fallback,
  size = "default",
  className,
}: UserAvatarProps) {
  const noImageKey = useId();
  /**
   * Radix Avatar держит `imageLoadingStatus === "loaded"` после показа картинки.
   * Если убрать `AvatarImage`, статус не сбрасывается — `AvatarFallback` не рендерится.
   * Смена `key` при пропаже `src` монтирует корень заново и показывает инициалы.
   */
  const rootKey = src ? src : `__user-avatar-fallback__${noImageKey}`;

  return (
    <ShadcnAvatar key={rootKey} size={size} className={className}>
      {src ? <ShadcnAvatarImage src={src} alt={alt} /> : null}
      <ShadcnAvatarFallback>{fallback}</ShadcnAvatarFallback>
    </ShadcnAvatar>
  );
}
