"use client";

import { useRef, useState } from "react";
import { Upload, X } from "lucide-react";
import { cn, motion } from "@/shared/lib";

const DEFAULT_ACCEPT = "image/jpeg,image/png,image/webp,image/gif";

export function pickFirstImageFile(fileList: FileList | undefined): File | undefined {
  const f = fileList?.[0];
  if (!f?.type.startsWith("image/")) {
    return undefined;
  }
  return f;
}

/** Извлекает из списка только изображения, не больше `max` штук. */
export function collectImageFilesFromList(fileList: FileList | undefined, max: number): File[] {
  const out: File[] = [];
  if (!fileList || max <= 0) {
    return out;
  }
  for (let i = 0; i < fileList.length; i++) {
    const f = fileList[i];
    if (f?.type.startsWith("image/")) {
      out.push(f);
      if (out.length >= max) {
        break;
      }
    }
  }
  return out;
}

/** Максимум файлов для галереи салона в одной форме создания. */
export const ORG_SALON_GALLERY_MAX_FILES = 12;

export type ImageMediaDropzoneSingleProps = {
  selectionMode?: "single";
  disabled?: boolean;
  title: string;
  hint: string;
  previewUrl?: string | null;
  fileLabel?: string | null;
  titleWithPreview?: string;
  hintWithPreview?: string;
  pendingNote?: string | null;
  dropzoneAriaLabel: string;
  onFileChosen: (file: File) => void;
  accept?: string;
  className?: string;
};

export type ImageMediaGalleryItem = {
  id: string;
  previewUrl: string;
  name: string;
};

export type ImageMediaDropzoneMultipleProps = {
  selectionMode: "multiple";
  disabled?: boolean;
  items: ImageMediaGalleryItem[];
  onAdd: (files: File[]) => void;
  onRemove: (id: string) => void;
  maxFiles?: number;
  title: string;
  hint: string;
  titleWhenHasItems?: string;
  hintWhenHasItems?: string;
  dropzoneAriaLabel: string;
  addMoreAriaLabel: string;
  removeItemAriaLabel: (fileName: string) => string;
  accept?: string;
  className?: string;
};

export type ImageMediaDropzoneProps = ImageMediaDropzoneSingleProps | ImageMediaDropzoneMultipleProps;

export function ImageMediaDropzone(props: ImageMediaDropzoneProps) {
  if (props.selectionMode === "multiple") {
    return <ImageMediaDropzoneMultiple {...props} />;
  }
  return <ImageMediaDropzoneSingle {...props} />;
}

function ImageMediaDropzoneSingle({
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
  accept = DEFAULT_ACCEPT,
  className,
}: ImageMediaDropzoneSingleProps) {
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
          !hasPreview && dragActive && !disabled ? "border-primary bg-primary/5" : null,
          hasPreview && dragActive && !disabled ? "border-primary ring-1 ring-primary/20" : null,
          disabled && "pointer-events-none cursor-not-allowed opacity-60",
        )}
      >
        {hasPreview && previewUrl ? (
          <>
            <div className="relative aspect-[4/3] w-full bg-muted/40">
              {/* eslint-disable-next-line @next/next/no-img-element -- blob/data preview */}
              <img src={previewUrl} alt="" className="h-full w-full object-cover" />
            </div>
            {fileLabel ? (
              <p
                className="truncate px-3 pt-2 text-left text-xs text-muted-foreground"
                title={fileLabel}
              >
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

function ImageMediaDropzoneMultiple({
  disabled,
  items,
  onAdd,
  onRemove,
  maxFiles = ORG_SALON_GALLERY_MAX_FILES,
  title,
  hint,
  titleWhenHasItems,
  hintWhenHasItems,
  dropzoneAriaLabel,
  addMoreAriaLabel,
  removeItemAriaLabel,
  accept = DEFAULT_ACCEPT,
  className,
}: ImageMediaDropzoneMultipleProps) {
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const room = Math.max(0, maxFiles - items.length);
  const canAdd = room > 0 && !disabled;
  const hasItems = items.length > 0;
  const showTitle = hasItems ? (titleWhenHasItems ?? title) : title;
  const showHint = hasItems ? (hintWhenHasItems ?? hint) : hint;

  const openPicker = () => {
    if (canAdd) {
      inputRef.current?.click();
    }
  };

  const handleFiles = (list: FileList | undefined) => {
    const next = collectImageFilesFromList(list, room);
    if (next.length > 0) {
      onAdd(next);
    }
  };

  return (
    <div className={cn("w-full space-y-2", className)}>
      {hasItems ? (
        <ul className="grid grid-cols-3 gap-2" role="list">
          {items.map((item) => (
            <li
              key={item.id}
              className="relative aspect-square overflow-hidden rounded-xl border border-border/50 bg-muted/30"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- blob preview */}
              <img src={item.previewUrl} alt="" className="size-full object-cover" />
              <button
                type="button"
                disabled={disabled}
                aria-label={removeItemAriaLabel(item.name)}
                className={cn(
                  motion.interactive,
                  "absolute top-1 right-1 flex size-8 items-center justify-center rounded-full bg-background/90 text-foreground shadow-sm",
                  disabled && "pointer-events-none opacity-50",
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  if (!disabled) {
                    onRemove(item.id);
                  }
                }}
              >
                <X className="size-4" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {canAdd ? (
        <div
          role="button"
          tabIndex={0}
          aria-label={hasItems ? addMoreAriaLabel : dropzoneAriaLabel}
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
            if (!disabled) {
              handleFiles(e.dataTransfer.files);
            }
          }}
          className={cn(
            motion.interactive,
            "flex cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden rounded-xl border-2 border-dashed border-border/80 bg-muted/20 px-4 py-6 text-center transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
            dragActive && !disabled ? "border-primary bg-primary/5" : null,
            disabled && "pointer-events-none cursor-not-allowed opacity-60",
            hasItems ? "py-4" : null,
          )}
        >
          <Upload className="size-7 shrink-0 text-muted-foreground" aria-hidden />
          <span className="text-sm font-medium text-foreground">{showTitle}</span>
          <span className="text-pretty text-xs text-muted-foreground">{showHint}</span>
          {room < maxFiles ? (
            <span className="text-[0.6875rem] text-muted-foreground tabular-nums">
              {items.length}/{maxFiles}
            </span>
          ) : null}
        </div>
      ) : null}

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple
        className="sr-only"
        tabIndex={-1}
        disabled={disabled || !canAdd}
        onChange={(e) => {
          handleFiles(e.target.files ?? undefined);
          e.target.value = "";
        }}
      />
    </div>
  );
}
