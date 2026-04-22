"use client";

import * as React from "react";
import {
  Range,
  Root,
  Track,
  Thumb,
} from "@radix-ui/react-slider";
import { cn } from "../../lib/utils";

const thumbClass = cn(
  "block size-4 cursor-grab rounded-full border border-border/40 bg-white shadow-md",
  "shadow-black/8 transition-[box-shadow,transform] hover:ring-2 hover:ring-primary/20",
  "focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-white focus-visible:outline-none",
  "active:cursor-grabbing data-disabled:pointer-events-none data-disabled:opacity-40",
);

/**
 * shadcn/ui-стили на базе @radix-ui/react-slider (таков же практикум официального реестра shadcn).
 * Число «ползунков» = длине `value` / `defaultValue` (1 — одиночный, 2 — диапазон).
 */
function Slider({
  className,
  value,
  defaultValue,
  ...props
}: React.ComponentProps<typeof Root>) {
  const n = Math.max(1, value?.length ?? defaultValue?.length ?? 1);

  return (
    <Root
      className={cn(
        "relative flex h-5 w-full touch-none select-none items-center",
        className,
      )}
      value={value}
      defaultValue={defaultValue}
      {...props}
    >
      <Track className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-zinc-200/90">
        <Range className="absolute h-full rounded-full bg-primary/85" />
      </Track>
      {Array.from({ length: n }, (_, i) => (
        <Thumb key={i} className={thumbClass} />
      ))}
    </Root>
  );
}

export { Slider };
