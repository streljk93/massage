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
  /** Превью: выбранный файл (blob URL) или уже сохранённый URL. */
  previewUrl?: string | null;
  /** Подпись к превью: имя файла или «текущее фото с сервера». */
  fileLabel?: string | null;
  /** Заголовок, когда превью уже есть (заменить). По умолчанию — `title`. */
  titleWithPreview?: string;
  /** Подсказка при превью. По умолчанию — `hint`. */
  hintWithPreview?: string;
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
  previewUrl,
  fileLabel,
  titleWithPreview,
  hintWithPreview,
  pendingNote,
  dropzoneAriaLabel,
  onFileChosen,
  accept = "image/jpeg,image/png,image/webp,image/gif",
  className,
}: AvatarPhotoDropzoneProps) {
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const hasPreview = Boolean(previewUrl);
  const showTitle = titleWithPreview ?? title;
  const showHint = hintWithPreview ?? hint;

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
          "flex cursor-pointer flex-col items-stretch justify-center gap-0 overflow-hidden rounded-xl border-2 text-center transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
          hasPreview
            ? "border-solid border-border/80 bg-muted/20 p-0"
            : "items-center gap-2 border-dashed border-border/80 bg-muted/20 px-4 py-6",
          !hasPreview && dragActive && !disabled
            ? "border-primary bg-primary/5"
            : null,
          hasPreview && dragActive && !disabled ? "border-primary ring-1 ring-primary/20" : null,
          disabled && "pointer-events-none cursor-not-allowed opacity-60",
        )}
      >
        {hasPreview && previewUrl ? (
          <>
            <div className="relative aspect-[4/3] w-full bg-muted/40">
              {/* eslint-disable-next-line @next/next/no-img-element -- blob/data preview from user selection or API URL */}
              <img
                src={previewUrl}
                alt=""
                className="h-full w-full object-cover"
              />
            </div>
            {fileLabel ? (
              <p className="truncate px-3 pt-2 text-left text-xs text-muted-foreground" title={fileLabel}>
                {fileLabel}
              </p>
            ) : null}
            <div className="flex flex-col items-center gap-1 px-4 py-3">
              <span className="text-sm font-medium text-foreground">{showTitle}</span>
              <span className="text-pretty text-xs text-muted-foreground">{showHint}</span>
            </div>
          </>
        ) : (
          <>
            <Upload className="mx-auto size-8 shrink-0 text-muted-foreground" aria-hidden />
            <span className="text-sm font-medium text-foreground">{title}</span>
            <span className="text-xs text-muted-foreground">{hint}</span>
          </>
        )}
        {pendingNote ? (
          <span className="px-2 pb-2 text-xs font-medium text-amber-700 dark:text-amber-500">
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
