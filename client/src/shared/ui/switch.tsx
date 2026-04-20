"use client";

import type { ComponentProps } from "react";
import { Switch as SwitchBase } from "./shadcn/switch";
import { cn, motion } from "@/shared/lib";

export type SwitchProps = ComponentProps<typeof SwitchBase>;

export function Switch({
  className,
  size = "comfortable",
  ...props
}: SwitchProps) {
  return (
    <SwitchBase
      size={size}
      className={cn(motion.interactivePressStrong, className)}
      {...props}
    />
  );
}
