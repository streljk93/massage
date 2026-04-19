import { Input as ShadcnInput } from "@/components/ui/input";
import { cn } from "@/shared/lib";
import type { ComponentProps } from "react";

export type InputProps = ComponentProps<typeof ShadcnInput>;

export function Input({ className, ...props }: InputProps) {
  return <ShadcnInput className={cn(className)} {...props} />;
}
