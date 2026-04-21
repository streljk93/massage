"use client";

import { useRef, useState } from "react";
import { Upload } from "lucide-react";
import { cn } from "@/shared/lib";

function pickFirstImageFile(fileList: FileList | undefined): File | undefined {
  const f = fileList?.[0];
  if (!f?.type.startsWith("image/")) {
    return undefined;
  }
  return f;
}

export type AvatarPhotoDropzoneProps = {
  disabled?: boolean;
  title: string;
  hint: string;
  pendingNote?: string | null;
  dropzoneAriaLabel: string;
  onFileChosen: (file: File) => void;
  accept?: string;
  className?: string;
};

/**
 * Пунктирная зона выбора фото (drag-and-drop + клик).
 * На экране редактирования профиля сейчас не используется — оставлено для других сценариев.
 */
export function AvatarPhotoDropzone({
  disabled,
  title,
  hint,
  pendingNote,
  dropzoneAriaLabel,
  onFileChosen,
  accept = "image/jpeg,image/png,image/webp,image/gif",
  className,
}: AvatarPhotoDropzoneProps) {
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const openPicker = () => {
    if (!disabled) {
      inputRef.current?.click();
    }
  };

  return (
    <div className={cn("w-full space-y-2", className)}>
      <div
        role="button"
        tabIndex={0}
        aria-label={dropzoneAriaLabel}
        aria-disabled={disabled}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            openPicker();
          }
        }}
        onClick={openPicker}
        onDragEnter={(e) => {
          e.preventDefault();
          if (!disabled) {
            setDragActive(true);
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) {
            setDragActive(true);
          }
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragActive(false);
          if (disabled) {
            return;
          }
          const f = pickFirstImageFile(e.dataTransfer.files);
          if (f) {
            onFileChosen(f);
          }
        }}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
          dragActive && !disabled
            ? "border-primary bg-primary/5"
            : "border-border/80 bg-muted/20",
          disabled && "pointer-events-none cursor-not-allowed opacity-60",
        )}
      >
        <Upload className="size-8 text-muted-foreground" aria-hidden />
        <span className="text-sm font-medium text-foreground">{title}</span>
        <span className="text-xs text-muted-foreground">{hint}</span>
        {pendingNote ? (
          <span className="text-xs font-medium text-amber-700 dark:text-amber-500">
            {pendingNote}
          </span>
        ) : null}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="sr-only"
        tabIndex={-1}
        disabled={disabled}
        onChange={(e) => {
          const f = pickFirstImageFile(e.target.files ?? undefined);
          e.target.value = "";
          if (f) {
            onFileChosen(f);
          }
        }}
      />
    </div>
  );
}
