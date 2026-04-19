import { cn } from "../lib";
import { Input as ShadcnInput } from "./shadcn/input";
import { forwardRef, type ComponentProps, type ReactNode } from "react";

export type InputProps = ComponentProps<typeof ShadcnInput> & {
  /** Иконка или слот слева (отступ поля задаётся автоматически) */
  startAdornment?: ReactNode;
  /** Иконка или слот справа */
  endAdornment?: ReactNode;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, startAdornment, endAdornment, ...props },
  ref,
) {
  if (!startAdornment && !endAdornment) {
    return <ShadcnInput ref={ref} className={cn(className)} {...props} />;
  }

  return (
    <div className="relative w-full min-w-0">
      {startAdornment ? (
        <span className="pointer-events-none absolute top-1/2 left-3.5 z-10 flex size-4 -translate-y-1/2 items-center justify-center text-muted-foreground">
          {startAdornment}
        </span>
      ) : null}
      <ShadcnInput
        ref={ref}
        className={cn(
          startAdornment && "pl-11",
          endAdornment && "pr-12",
          className,
        )}
        {...props}
      />
      {endAdornment ? (
        <span className="absolute top-1/2 right-2 z-10 flex -translate-y-1/2 items-center">
          {endAdornment}
        </span>
      ) : null}
    </div>
  );
});
