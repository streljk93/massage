"use client";

import { AlertDialog as AlertDialogPrimitive } from "radix-ui";
import { useEffect, useRef } from "react";

import { useConfirmActionStore } from "../lib/notifications/confirm-store";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./shadcn/alert-dialog";
import { Button as ShadcnButton } from "./shadcn/button";
import { Button } from "./button";

const DEFAULT_CONFIRM = "Продолжить";
const DEFAULT_CANCEL = "Отмена";

/**
 * Императивный `confirmAction` требует один экземпляра хоста в дереве (рядом с провайдерами).
 */
export function ConfirmActionHost() {
  const open = useConfirmActionStore((s) => s.open);
  const session = useConfirmActionStore((s) => s.session);
  const respond = useConfirmActionStore((s) => s.respond);
  const closeWithoutResolve = useConfirmActionStore((s) => s.closeWithoutResolve);
  const ignoreNextClose = useRef(false);

  useEffect(() => {
    return () => {
      closeWithoutResolve();
    };
  }, [closeWithoutResolve]);

  if (!session) {
    return null;
  }

  const confirmLabel = session.confirmLabel ?? DEFAULT_CONFIRM;
  const cancelLabel = session.cancelLabel ?? DEFAULT_CANCEL;
  const destructive = session.destructive ?? false;

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          if (ignoreNextClose.current) {
            ignoreNextClose.current = false;
            return;
          }
          respond(false);
        }
      }}
    >
      <AlertDialogContent
        className="min-w-0"
        onEscapeKeyDown={() => {
          respond(false);
        }}
      >
        <AlertDialogHeader className="min-w-0">
          <AlertDialogTitle>{session.title}</AlertDialogTitle>
          {(session.description !== undefined && session.description !== "") ||
          session.body != null ?
            <AlertDialogDescription asChild>
              <div className="min-w-0 max-w-full space-y-3 text-sm font-normal leading-relaxed tracking-normal [&_strong]:font-medium">
                {session.description !== undefined && session.description !== "" ?
                  <p className="whitespace-pre-wrap text-muted-foreground">
                    {session.description}
                  </p>
                : null}
                {session.body}
              </div>
            </AlertDialogDescription>
          : null}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogPrimitive.Cancel asChild>
            <Button type="button" variant="secondary" tone="light">
              {cancelLabel}
            </Button>
          </AlertDialogPrimitive.Cancel>
          <AlertDialogPrimitive.Action asChild>
            <ShadcnButton
              type="button"
              variant={destructive ? "destructive" : "default"}
              onClick={() => {
                ignoreNextClose.current = true;
                respond(true);
              }}
            >
              {confirmLabel}
            </ShadcnButton>
          </AlertDialogPrimitive.Action>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
