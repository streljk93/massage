import { Suspense } from "react";
import { SearchMapPage } from "@/views/search";

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen flex-col bg-surface-background" />
      }
    >
      <SearchMapPage />
    </Suspense>
  );
}
