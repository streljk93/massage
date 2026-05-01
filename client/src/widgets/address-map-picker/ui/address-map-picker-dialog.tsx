/* eslint-disable react-hooks/set-state-in-effect -- debounce подсказок адреса с API */
"use client";

import dynamic from "next/dynamic";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useTranslations } from "next-intl";
import { LocateFixed, X } from "lucide-react";
import type { AppLocale } from "@/app/i18n/routing";
import {
  addressMapPickFromResolved,
  type AddressMapPickResult,
} from "@/entities/address";
import {
  addressResolve,
  addressReverse,
  addressSuggestions,
} from "@/shared/api";
import type { Client } from "@/shared/api/generated/sdk/client";
import { cn, motion, useUserGeolocation } from "@/shared/lib";
import { Button, SearchAutocomplete, type SearchAutocompleteItem } from "@/shared/ui";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/shared/ui/shadcn/dialog";

const AddressMapPickerLeaflet = dynamic(
  () =>
    import("./address-map-picker-leaflet").then((m) => m.AddressMapPickerLeaflet),
  {
    ssr: false,
    loading: () => (
      <div
        className="flex h-full min-h-[200px] w-full items-center justify-center bg-neutral-100"
        aria-hidden
      />
    ),
  },
);

const DEFAULT_CENTER: [number, number] = [10.223, 103.968];

const COORD_EPS = 2e-5;

function coordsMatchResolved(
  marker: [number, number],
  r: Pick<AddressMapPickResult, "latitude" | "longitude">,
): boolean {
  return (
    Math.abs(marker[0] - r.latitude) < COORD_EPS &&
    Math.abs(marker[1] - r.longitude) < COORD_EPS
  );
}

/**
 * Reverse‑геокодеры обычно возвращают в `resolved` центроид найденного объекта (OSM и т.п.),
 * а не координаты запроса — поэтому в формы и БД передаём именно точку маркера Leaflet.
 */
function pickPinnedToLeafletMarker(
  pick: AddressMapPickResult,
  leafletLat: number,
  leafletLng: number,
): AddressMapPickResult {
  return {
    ...pick,
    latitude: leafletLat,
    longitude: leafletLng,
  };
}

export type AddressMapPickerDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: Client;
  locale: AppLocale;
  onPick: (result: AddressMapPickResult) => void;
  /**
   * Центр при открытии (до выбора). По умолчанию как на экране поиска (Phú Quốc).
   */
  defaultCenter?: [number, number];
  initialZoom?: number;
};

export function AddressMapPickerDialog({
  open,
  onOpenChange,
  client,
  locale,
  onPick,
  defaultCenter = DEFAULT_CENTER,
  initialZoom = 13,
}: AddressMapPickerDialogProps) {
  const t = useTranslations("addressMapPicker");
  const { userPosition, requestFromUserGesture } = useUserGeolocation();
  const mapFlyToRef = useRef<((p: [number, number]) => void) | null>(null);
  const registerMapFlyTo = useCallback((flyTo: (p: [number, number]) => void) => {
    mapFlyToRef.current = flyTo;
  }, []);

  const [addrQ, setAddrQ] = useState("");
  const [addrHits, setAddrHits] = useState<SearchAutocompleteItem[]>([]);
  const [addrPending, setAddrPending] = useState(false);
  const [addrSuggestOpen, setAddrSuggestOpen] = useState(true);
  const [selectedAddrId, setSelectedAddrId] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const [marker, setMarker] = useState<[number, number]>(defaultCenter);
  const [mapFlySeq, setMapFlySeq] = useState(0);
  /** Пин не трогали после последнего выбора из поиска — можно отдать snapshot без reverse. */
  const [pinCleanAfterSearch, setPinCleanAfterSearch] = useState(false);
  const [resolvedFromSearch, setResolvedFromSearch] =
    useState<AddressMapPickResult | null>(null);

  const markerRef = useRef(marker);
  useLayoutEffect(() => {
    markerRef.current = marker;
  }, [marker]);

  const addrQRef = useRef(addrQ);
  useLayoutEffect(() => {
    addrQRef.current = addrQ;
  }, [addrQ]);

  const mapReverseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mapReverseSeqRef = useRef(0);
  /** После выбора из списка не дёргаем авто-resolve по первой подсказке, пока пользователь снова не меняет ввод. */
  const suppressAutoResolveAfterListPickRef = useRef(false);
  /** Не вызывать suggestions на следующий тик после программного `setAddrQ` (reverse / выбор из списка). */
  const suppressSuggestionsAfterProgrammaticAddrQRef = useRef(false);
  const suggestionsBatchIdRef = useRef(0);

  useEffect(() => {
    if (!open) {
      if (mapReverseTimerRef.current != null) {
        clearTimeout(mapReverseTimerRef.current);
        mapReverseTimerRef.current = null;
      }
      mapReverseSeqRef.current += 1;
      suppressAutoResolveAfterListPickRef.current = false;
      suppressSuggestionsAfterProgrammaticAddrQRef.current = false;
      setAddrPending(false);
    }
  }, [open]);

  const cancelPendingMapReverse = useCallback(() => {
    if (mapReverseTimerRef.current != null) {
      clearTimeout(mapReverseTimerRef.current);
      mapReverseTimerRef.current = null;
    }
    mapReverseSeqRef.current += 1;
  }, []);

  const applyResolvedSuggestion = useCallback(
    (
      mapped: AddressMapPickResult,
      item: { id: string; name: string },
      opts: { syncInput: boolean; closeList: boolean },
    ) => {
      cancelPendingMapReverse();
      setMarker([mapped.latitude, mapped.longitude]);
      setResolvedFromSearch(mapped);
      setPinCleanAfterSearch(true);
      setMapFlySeq((s) => s + 1);
      setSelectedAddrId(item.id);
      if (opts.syncInput) {
        suppressSuggestionsAfterProgrammaticAddrQRef.current = true;
        setAddrQ(item.name);
      }
      if (opts.closeList) {
        setAddrSuggestOpen(false);
      }
      setLocalError(null);
    },
    [cancelPendingMapReverse],
  );

  useEffect(
    () => () => {
      if (mapReverseTimerRef.current != null) {
        clearTimeout(mapReverseTimerRef.current);
      }
    },
    [],
  );

  const scheduleReverseFillFromMap = useCallback(
    (lat: number, lng: number) => {
      if (mapReverseTimerRef.current != null) {
        clearTimeout(mapReverseTimerRef.current);
      }
      mapReverseTimerRef.current = setTimeout(() => {
        mapReverseTimerRef.current = null;
        mapReverseSeqRef.current += 1;
        const seq = mapReverseSeqRef.current;
        void (async () => {
          const { data, error } = await addressReverse({
            client,
            query: { locale },
            body: { latitude: lat, longitude: lng },
          });
          if (seq !== mapReverseSeqRef.current) {
            return;
          }
          const [curLat, curLng] = markerRef.current;
          if (
            Math.abs(curLat - lat) > COORD_EPS ||
            Math.abs(curLng - lng) > COORD_EPS
          ) {
            return;
          }
          if (error || !data?.resolved) {
            return;
          }
          const mapped = addressMapPickFromResolved(data.resolved);
          if (!mapped) {
            return;
          }
          suppressSuggestionsAfterProgrammaticAddrQRef.current = true;
          setAddrHits([]);
          setAddrQ(mapped.addressLine);
          setResolvedFromSearch(mapped);
          setPinCleanAfterSearch(true);
          setSelectedAddrId(null);
          setAddrSuggestOpen(false);
        })();
      }, 320);
    },
    [client, locale],
  );

  const [mapInstanceKey, setMapInstanceKey] = useState<string | null>(null);
  useEffect(() => {
    if (!open) {
      return;
    }
    const key = `address-map-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}`}`;
    let cancelled = false;
    let raf1 = 0;
    let raf2 = 0;
    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        if (!cancelled) {
          setMapInstanceKey(key);
        }
      });
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    if (suppressSuggestionsAfterProgrammaticAddrQRef.current) {
      suppressSuggestionsAfterProgrammaticAddrQRef.current = false;
      setAddrPending(false);
      return;
    }
    const q = addrQ.trim();
    if (q.length < 2) {
      suggestionsBatchIdRef.current += 1;
      setAddrPending(false);
      setAddrHits([]);
      return;
    }
    setAddrPending(true);
    const tmr = window.setTimeout(() => {
      const batchAtStart = suggestionsBatchIdRef.current;
      void (async () => {
        const { data, error } = await addressSuggestions({
          client,
          query: { query: q, locale },
        });
        if (batchAtStart !== suggestionsBatchIdRef.current) {
          return;
        }
        setAddrPending(false);
        if (error || !data?.suggestions) {
          setAddrHits([]);
          return;
        }
        const hits: SearchAutocompleteItem[] = data.suggestions.map((s) => {
          const name = [s.mainText, s.secondaryText]
            .filter((x) => (x as string | undefined)?.length)
            .join(" — ");
          const id = JSON.stringify({ p: s.provider, i: s.placeId });
          const item: SearchAutocompleteItem = {
            id,
            name: name.length > 0 ? name : s.mainText,
            addressLine: s.secondaryText ?? null,
          };
          if (s.resolved) {
            item.resolved = { ...s.resolved };
          }
          return item;
        });
        setAddrHits(hits);

        if (suppressAutoResolveAfterListPickRef.current) {
          return;
        }
        const first = hits[0];
        if (!first) {
          return;
        }
        if (first.resolved) {
          const mapped = addressMapPickFromResolved(first.resolved);
          if (mapped) {
            applyResolvedSuggestion(mapped, first, {
              syncInput: false,
              closeList: false,
            });
          }
          return;
        }
        let parsed: { p: string; i: string };
        try {
          parsed = JSON.parse(first.id) as { p: string; i: string };
        } catch {
          return;
        }
        if (
          typeof parsed.p !== "string" ||
          typeof parsed.i !== "string" ||
          !parsed.p ||
          !parsed.i
        ) {
          return;
        }
        const { data: resData, error: resErr } = await addressResolve({
          client,
          query: { locale },
          body: {
            provider: parsed.p as
              | "locationiq"
              | "geoapify"
              | "opencage"
              | "nominatim",
            placeId: parsed.i,
          },
        });
        if (batchAtStart !== suggestionsBatchIdRef.current) {
          return;
        }
        if (addrQRef.current.trim() !== q) {
          return;
        }
        if (resErr || !resData?.resolved) {
          return;
        }
        const mapped = addressMapPickFromResolved(resData.resolved);
        if (!mapped) {
          return;
        }
        applyResolvedSuggestion(mapped, first, {
          syncInput: false,
          closeList: false,
        });
      })();
    }, 300);
    return () => {
      window.clearTimeout(tmr);
      suggestionsBatchIdRef.current += 1;
    };
  }, [open, addrQ, locale, client, applyResolvedSuggestion]);

  const onPinPositionChange = (lat: number, lng: number) => {
    setMarker([lat, lng]);
    setPinCleanAfterSearch(false);
    setResolvedFromSearch(null);
    setSelectedAddrId(null);
    setAddrQ("");
    scheduleReverseFillFromMap(lat, lng);
  };

  const onConfirm = async () => {
    setLocalError(null);

    const [leafLat, leafLng] = marker;

    if (
      resolvedFromSearch &&
      pinCleanAfterSearch &&
      coordsMatchResolved(marker, resolvedFromSearch)
    ) {
      onPick(pickPinnedToLeafletMarker(resolvedFromSearch, leafLat, leafLng));
      onOpenChange(false);
      return;
    }

    setSubmitting(true);
    try {
      const { data, error } = await addressReverse({
        client,
        query: { locale },
        body: { latitude: leafLat, longitude: leafLng },
      });
      if (error || !data?.resolved) {
        setLocalError(t("reverseError"));
        return;
      }
      const mapped = addressMapPickFromResolved(data.resolved);
      if (!mapped) {
        setLocalError(t("reverseError"));
        return;
      }
      onPick(pickPinnedToLeafletMarker(mapped, leafLat, leafLng));
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="z-[100] flex h-[min(92dvh,720px)] max-h-[92dvh] w-[calc(100%-1.5rem)] max-w-lg flex-col gap-0 overflow-hidden rounded-2xl border border-neutral-200/90 bg-neutral-100 p-0 shadow-xl"
        showCloseButton={false}
      >
        <DialogTitle className="sr-only">{t("title")}</DialogTitle>

        <div
          className="relative min-h-0 w-full flex-1 bg-neutral-100 [&_.leaflet-control-attribution]:!hidden [&_.leaflet-top.leaflet-left]:!mt-[4.5rem]"
          data-vaul-no-drag
        >
          {mapInstanceKey ? (
            <AddressMapPickerLeaflet
              mapInstanceKey={mapInstanceKey}
              defaultCenter={defaultCenter}
              initialZoom={initialZoom}
              marker={marker}
              onPositionChange={onPinPositionChange}
              mapFlySeq={mapFlySeq}
              onMapFlyReady={registerMapFlyTo}
              className="z-0 h-full min-h-[240px] w-full [&_.leaflet-container]:!h-full [&_.leaflet-container]:!w-full"
              mapMinHeight="100%"
            />
          ) : (
            <div
              className="flex min-h-[240px] h-full w-full items-center justify-center bg-neutral-100"
              aria-hidden
            />
          )}
        </div>

        <div
          className={cn(
            "pointer-events-none absolute top-0 right-0 left-0 z-[1200] px-4",
            "pt-[max(1rem,env(safe-area-inset-top))]",
          )}
        >
          <div className="pointer-events-auto flex min-w-0 items-stretch gap-2">
            <div className="min-w-0 flex-1">
              <SearchAutocomplete
                value={addrQ}
                onValueChange={(v) => {
                  suppressAutoResolveAfterListPickRef.current = false;
                  setAddrQ(v);
                  setSelectedAddrId(null);
                  setPinCleanAfterSearch(false);
                  setResolvedFromSearch(null);
                }}
                onSelect={(item) => {
                  const fromSnap = item.resolved
                    ? addressMapPickFromResolved(item.resolved)
                    : null;
                  if (fromSnap) {
                    setLocalError(null);
                    applyResolvedSuggestion(fromSnap, item, {
                      syncInput: true,
                      closeList: true,
                    });
                    suppressAutoResolveAfterListPickRef.current = true;
                    return;
                  }
                  void (async () => {
                    let parsed: { p: string; i: string };
                    try {
                      parsed = JSON.parse(item.id) as { p: string; i: string };
                    } catch {
                      setLocalError(t("resolveError"));
                      return;
                    }
                    if (
                      typeof parsed.p !== "string" ||
                      typeof parsed.i !== "string" ||
                      !parsed.p ||
                      !parsed.i
                    ) {
                      setLocalError(t("resolveError"));
                      return;
                    }
                    setLocalError(null);
                    setSubmitting(true);
                    try {
                      const { data, error } = await addressResolve({
                        client,
                        query: { locale },
                        body: {
                          provider: parsed.p as
                            | "locationiq"
                            | "geoapify"
                            | "opencage"
                            | "nominatim",
                          placeId: parsed.i,
                        },
                      });
                      if (error || !data?.resolved) {
                        setLocalError(t("resolveError"));
                        return;
                      }
                      const mapped = addressMapPickFromResolved(data.resolved);
                      if (!mapped) {
                        setLocalError(t("resolveError"));
                        return;
                      }
                      applyResolvedSuggestion(mapped, item, {
                        syncInput: true,
                        closeList: true,
                      });
                      suppressAutoResolveAfterListPickRef.current = true;
                    } finally {
                      setSubmitting(false);
                    }
                  })();
                }}
                items={addrHits}
                isLoading={addrPending}
                selectedId={selectedAddrId}
                listOpen={addrSuggestOpen}
                onListOpenChange={setAddrSuggestOpen}
                minQueryLength={2}
                inputId="address-map-picker-search"
                listboxId="address-map-picker-search-list"
                inputAriaLabel={t("searchPlaceholder")}
                placeholder={t("searchPlaceholder")}
                listAriaLabel={t("searchPlaceholder")}
                loadingText={t("searchLoading")}
                emptyText={t("searchEmpty")}
                disabled={submitting}
                suppressBrowserSavedAddresses
                popoverContentClassName="z-[5000] rounded-xl border border-neutral-200 bg-white text-base shadow-lg"
                inputClassName="h-12 min-h-12 rounded-full border border-neutral-200/90 bg-white/95 px-4 text-base shadow-md backdrop-blur-sm md:text-base"
              />
            </div>
            <button
              type="button"
              className={cn(
                motion.interactivePressStrong,
                "inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-neutral-200/90 bg-white/95 text-foreground shadow-md backdrop-blur-sm outline-none transition-colors hover:bg-white focus-visible:ring-2 focus-visible:ring-ring/50",
              )}
              aria-label={t("closeLabel")}
              disabled={submitting}
              onClick={() => onOpenChange(false)}
            >
              <X className="size-5 shrink-0" aria-hidden />
            </button>
          </div>
        </div>

        <div
          className={cn(
            "pointer-events-none absolute right-0 bottom-0 left-0 z-[1200]",
            "pb-[max(1rem,env(safe-area-inset-bottom))] pt-4",
          )}
        >
          {localError ? (
            <p
              className="pointer-events-auto mx-auto mb-2 max-w-[min(100%,24rem)] rounded-lg border border-destructive/30 bg-white/95 px-2.5 py-1.5 text-center text-pretty text-xs text-destructive backdrop-blur-sm"
              role="alert"
            >
              {localError}
            </p>
          ) : null}
          <div className="pointer-events-auto px-4">
            <div className="mb-2 flex justify-end">
              <Button
                type="button"
                variant="secondary"
                tone="light"
                size="lg"
                className={cn(
                  motion.interactivePressStrong,
                  "h-12 w-12 min-h-12 min-w-12 shrink-0 rounded-full border border-neutral-200/90 p-0 text-foreground shadow-md backdrop-blur-sm",
                )}
                aria-label={t("locateMeLabel")}
                disabled={submitting}
                onClick={() => {
                  const fly = mapFlyToRef.current;
                  if (userPosition && fly) {
                    fly(userPosition);
                    onPinPositionChange(userPosition[0], userPosition[1]);
                  }
                  requestFromUserGesture((p) => {
                    mapFlyToRef.current?.(p);
                    onPinPositionChange(p[0], p[1]);
                  });
                }}
              >
                <LocateFixed className="size-5 shrink-0" aria-hidden />
              </Button>
            </div>
            <div className="flex w-full items-stretch">
              <Button
                type="button"
                variant="primary"
                size="lg"
                className="h-12 min-h-12 w-full min-w-0 shrink rounded-full px-3 text-base shadow-md"
                disabled={submitting}
                onClick={() => void onConfirm()}
              >
                <span className="truncate">
                  {submitting ? t("loading") : t("confirm")}
                </span>
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
