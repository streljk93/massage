"use client";

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
  return (
    <ShadcnAvatar size={size} className={className}>
      {src ? <ShadcnAvatarImage src={src} alt={alt} /> : null}
      <ShadcnAvatarFallback>{fallback}</ShadcnAvatarFallback>
    </ShadcnAvatar>
  );
}
