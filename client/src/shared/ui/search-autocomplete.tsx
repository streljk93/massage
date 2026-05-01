"use client";

import { useId, useRef } from "react";

import { cn } from "@/shared/lib";
import { Input, type InputProps } from "./input";
import { Command, CommandItem, CommandList } from "./shadcn/command";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "./shadcn/popover";

export type SearchAutocompleteItem = {
  id: string;
  name: string;
  addressLine?: string | null;
  /** С подсказок адреса: провайдер + placeId для `placeReference` на бэке */
  provider?: string;
  placeId?: string;
  /** Как у ответа /address/resolve — если есть, второй запрос не нужен */
  resolved?: {
    addressLine: string;
    city: string | null;
    latitude: number;
    longitude: number;
    sourceProvider: string;
    sourceReference: string;
  };
};

export type SearchAutocompleteProps = {
  value: string;
  onValueChange: (value: string) => void;
  onSelect: (item: SearchAutocompleteItem) => void;
  items: readonly SearchAutocompleteItem[];
  isLoading: boolean;
  /** Подсветка строки, совпадающей с выбранным id */
  selectedId: string | null;
  listOpen: boolean;
  onListOpenChange: (open: boolean) => void;
  minQueryLength?: number;
  inputId: string;
  listboxId: string;
  /**
   * Уменьшить нативные подсказки браузера («раньше вводили…» / сохранённые адреса):
   * случайный `name`, `<form autocomplete="off">`, атрибуты для менеджеров паролей.
   */
  suppressBrowserSavedAddresses?: boolean;
  /**
   * Видимая подпись над полем: id элемента с `aria-labelledby`.
   * Либо это, либо {@link inputAriaLabel} (без видимого label).
   */
  inputLabelledBy?: string;
  /** Доступное имя поля без видимой подписи — `aria-label`. */
  inputAriaLabel?: string;
  placeholder: string;
  listAriaLabel: string;
  loadingText: string;
  emptyText: string;
  disabled?: boolean;
  className?: string;
  inputClassName?: string;
  /** Доп. классы для `PopoverContent` (например z-index поверх Leaflet). */
  popoverContentClassName?: string;
} & Pick<InputProps, "name" | "autoFocus">;

/**
 * shadcn: Popover + Command, `shouldFilter={false}` — список приходит снаружи (API).
 */
export function SearchAutocomplete({
  value,
  onValueChange,
  onSelect,
  items,
  isLoading,
  selectedId,
  listOpen,
  onListOpenChange,
  minQueryLength = 2,
  inputId,
  listboxId,
  inputLabelledBy,
  inputAriaLabel,
  placeholder,
  listAriaLabel,
  loadingText,
  emptyText,
  disabled = false,
  className,
  inputClassName,
  popoverContentClassName,
  name,
  autoFocus,
  suppressBrowserSavedAddresses = false,
}: SearchAutocompleteProps) {
  const suppressAutofillUid = useId().replace(/:/g, "");
  const anchorRef = useRef<HTMLDivElement | null>(null);
  const inputName = suppressBrowserSavedAddresses
    ? `addr-q-${suppressAutofillUid}`
    : name;

  const canShowList = value.trim().length >= minQueryLength && listOpen;
  const popover = (
    <Popover
      open={canShowList}
      onOpenChange={(next) => {
        if (!next) {
          onListOpenChange(false);
        }
      }}
    >
      <PopoverAnchor asChild>
        <div ref={anchorRef} className="relative z-20 w-full min-w-0">
          <Input
            id={inputId}
            name={inputName}
            className={cn(
              "h-12 min-h-12 rounded-full border-0 bg-muted/50 px-4 py-0 text-base md:text-sm",
              inputClassName,
            )}
            value={value}
            onChange={(e) => onValueChange(e.target.value)}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            {...(suppressBrowserSavedAddresses
              ? ({
                  "data-lpignore": "true",
                  "data-1p-ignore": "",
                  "data-bwignore": "",
                  "data-form-type": "other",
                } as const)
              : {})}
            inputMode="search"
            autoFocus={autoFocus}
            role="combobox"
            aria-autocomplete="list"
            aria-controls={listboxId}
            aria-expanded={canShowList}
            aria-labelledby={inputAriaLabel ? undefined : inputLabelledBy}
            aria-label={inputAriaLabel ?? undefined}
            placeholder={placeholder}
            disabled={disabled}
            onFocus={() => onListOpenChange(true)}
          />
        </div>
      </PopoverAnchor>
      <PopoverContent
        id={listboxId}
        data-slot="combobox-content"
        align="start"
        side="bottom"
        sideOffset={4}
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
        onInteractOutside={(e) => {
          if (anchorRef.current?.contains(e.target as Node)) {
            e.preventDefault();
          }
        }}
        className={cn(
          "z-[100] w-[var(--radix-popper-anchor-width)] min-w-0 p-0",
          popoverContentClassName,
        )}
      >
        <Command
          shouldFilter={false}
          className="max-h-52 min-w-0 overflow-hidden rounded-lg border-0 p-0 shadow-none"
          aria-label={listAriaLabel}
        >
          <CommandList className="max-h-52">
            {isLoading ? (
              <p className="px-3 py-2.5 text-sm text-muted-foreground" aria-live="polite">
                {loadingText}
              </p>
            ) : items.length === 0 ? (
              <p className="px-3 py-2.5 text-sm text-muted-foreground" role="status">
                {emptyText}
              </p>
            ) : (
              items.map((o) => (
                <CommandItem
                  key={o.id}
                  value={o.id}
                  keywords={[o.name, o.addressLine ?? ""]}
                  onSelect={() => onSelect(o)}
                  className={cn(
                    "h-auto min-h-0 w-full min-w-0 flex-col items-stretch gap-0.5 rounded-xl px-3 py-2.5 text-left !cursor-pointer [&>svg]:hidden",
                    selectedId === o.id
                      ? "bg-foreground text-background data-[selected=true]:bg-foreground data-[selected=true]:text-background"
                      : "data-[selected=true]:bg-muted data-[selected=true]:text-foreground",
                  )}
                >
                  <span className="line-clamp-2 font-medium">{o.name}</span>
                  {o.addressLine ? (
                    <span
                      className={cn(
                        "line-clamp-1 text-xs",
                        selectedId === o.id
                          ? "text-background/75"
                          : "text-muted-foreground",
                      )}
                    >
                      {o.addressLine}
                    </span>
                  ) : null}
                </CommandItem>
              ))
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );

  return (
    <div className={cn("w-full min-w-0", className)}>
      {suppressBrowserSavedAddresses ? (
        <form
          className="contents"
          autoComplete="off"
          onSubmit={(e) => {
            e.preventDefault();
          }}
        >
          {popover}
        </form>
      ) : (
        popover
      )}
    </div>
  );
}
