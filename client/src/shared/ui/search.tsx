"use client";

import { useId, useMemo, useState, type ReactNode } from "react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@/components/ui/popover";
import { Input } from "@/shared/ui/input";
import { cn } from "@/shared/lib";
import { Search as SearchIcon } from "lucide-react";

export type SearchOption = {
  id: string;
  label: string;
  subtitle?: string;
};

export type SearchVariant = "light" | "muted";

export type SearchProps = {
  options: SearchOption[];
  /** `light` — `surface-light`, `muted` — нейтральная заливка */
  variant?: SearchVariant;
  placeholder?: string;
  className?: string;
  onSelect?: (option: SearchOption) => void;
  /** Текст при пустом результате фильтрации */
  emptyMessage?: string;
  /** Слот слева (по умолчанию — иконка поиска). Обёртка задаёт позицию. */
  startAdornment?: ReactNode;
  /** Слот справа внутри поля (иконки, кнопки). Рендерится в flex-контейнере у правого края. */
  endAdornment?: ReactNode;
  /** Явный id списка подсказок (a11y); иначе генерируется */
  listboxId?: string;
};

const fieldVariants: Record<
  SearchVariant,
  { input: string }
> = {
  light: {
    input: "bg-surface-light",
  },
  muted: {
    input: "bg-muted",
  },
};

export function Search({
  options,
  variant = "light",
  placeholder = "Search...",
  className,
  onSelect,
  emptyMessage = "Ничего не найдено",
  startAdornment,
  endAdornment,
  listboxId: listboxIdProp,
}: SearchProps) {
  const reactId = useId();
  const listboxId = listboxIdProp ?? `search-listbox-${reactId}`;
  const v = fieldVariants[variant];
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        o.subtitle?.toLowerCase().includes(q),
    );
  }, [options, query]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <div className={cn("relative w-full", className)}>
          <span className="pointer-events-none absolute top-1/2 left-3.5 flex size-4 -translate-y-1/2 items-center justify-center text-muted-foreground">
            {startAdornment ?? <SearchIcon className="size-4" aria-hidden />}
          </span>
          <Input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            placeholder={placeholder}
            className={cn(
              "h-11 rounded-full border-0 py-2 pl-11",
              endAdornment ? "pr-12" : "pr-4",
              v.input,
            )}
            autoComplete="off"
            aria-expanded={open}
            aria-controls={listboxId}
          />
          {endAdornment ? (
            <div className="absolute top-1/2 right-2 flex -translate-y-1/2 items-center gap-0.5">
              {endAdornment}
            </div>
          ) : null}
        </div>
      </PopoverAnchor>
      <PopoverContent
        id={listboxId}
        className="w-[var(--radix-popover-anchor-width)] p-0"
        align="start"
        sideOffset={8}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <Command shouldFilter={false}>
          <CommandList>
            <CommandEmpty className="py-4 text-muted-foreground">
              {emptyMessage}
            </CommandEmpty>
            <CommandGroup>
              {filtered.map((opt) => (
                <CommandItem
                  key={opt.id}
                  value={opt.id}
                  onSelect={() => {
                    setQuery(opt.label);
                    setOpen(false);
                    onSelect?.(opt);
                  }}
                >
                  <span className="flex flex-col gap-0.5">
                    <span>{opt.label}</span>
                    {opt.subtitle ? (
                      <span className="text-xs text-muted-foreground">
                        {opt.subtitle}
                      </span>
                    ) : null}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
