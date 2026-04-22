"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Toast as ToastPrimitives } from "radix-ui";
import { XIcon } from "lucide-react";

import { cn } from "../../lib/utils";
import { Button } from "./button";

const toastVariants = cva(
  "group pointer-events-auto relative flex w-full max-w-[min(100%,var(--toast-width,24rem))] items-center gap-2 overflow-hidden rounded-lg border p-3 pr-8 text-sm shadow-none data-[swipe=end]:animate-out data-[swipe=end]:slide-out-to-bottom-full data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[swipe=move]:translate-y-[var(--radix-toast-swipe-move-y)] data-[swipe=cancel]:translate-x-0 data-[swipe=cancel]:translate-y-0 data-[swipe=cancel]:duration-200 data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom-full data-[state=closed]:animate-out data-[state=closed]:fade-out-80",
  {
    variants: {
      variant: {
        default: "border-border bg-popover text-popover-foreground",
        destructive:
          "border-red-200 bg-red-100 text-red-950 dark:border-red-800 dark:bg-red-950 dark:text-red-50",
        success: "border-0 bg-primary text-primary-foreground",
        warning:
          "border-amber-200 bg-amber-100 text-amber-950 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-50",
        info: "border-sky-200 bg-sky-100 text-sky-950 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-50",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function ToastProvider({
  ...props
}: React.ComponentProps<typeof ToastPrimitives.Provider>) {
  return <ToastPrimitives.Provider data-slot="toast-provider" {...props} />;
}

function ToastViewport({
  className,
  ...props
}: React.ComponentProps<typeof ToastPrimitives.Viewport>) {
  return (
    <ToastPrimitives.Viewport
      data-slot="toast-viewport"
      className={cn(
        "pointer-events-none fixed right-0 bottom-0 left-0 z-[100] mx-auto flex max-h-screen w-full max-w-lg flex-col-reverse gap-2 px-4 pt-3",
        "pb-[calc(5.25rem+env(safe-area-inset-bottom,0px))] sm:px-4",
        className,
      )}
      {...props}
    />
  );
}

type ToastProps = React.ComponentProps<typeof ToastPrimitives.Root> &
  VariantProps<typeof toastVariants>;

function ToastRoot({ className, variant, ...props }: ToastProps) {
  return (
    <ToastPrimitives.Root
      data-slot="toast"
      className={cn(toastVariants({ variant }), className)}
      {...props}
    />
  );
}

function ToastTitle({
  className,
  ...props
}: React.ComponentProps<typeof ToastPrimitives.Title>) {
  return (
    <ToastPrimitives.Title
      data-slot="toast-title"
      className={cn("font-heading text-sm leading-snug font-medium", className)}
      {...props}
    />
  );
}

function ToastDescription({
  className,
  ...props
}: React.ComponentProps<typeof ToastPrimitives.Description>) {
  return (
    <ToastPrimitives.Description
      data-slot="toast-description"
      className={cn("text-sm leading-snug text-current/85", className)}
      {...props}
    />
  );
}

function ToastClose({
  className,
  ...props
}: React.ComponentProps<typeof ToastPrimitives.Close>) {
  return (
    <ToastPrimitives.Close
      data-slot="toast-close"
      asChild
      className={cn("absolute top-1.5 right-1.5", className)}
      {...props}
    >
      <Button
        variant="ghost"
        size="icon-xs"
        type="button"
        aria-label="Close"
        className="text-inherit opacity-80 hover:bg-current/10 hover:opacity-100"
      >
        <XIcon className="size-3.5" />
      </Button>
    </ToastPrimitives.Close>
  );
}

export { ToastProvider, ToastViewport, ToastRoot, ToastTitle, ToastDescription, ToastClose, toastVariants };
export type { ToastProps };
