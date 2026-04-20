import { Suspense } from "react";
import { SearchPage } from "@/views/search";

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen flex-col bg-surface-background" />
      }
    >
      <div className="flex min-h-screen flex-col">
        <SearchPage />
      </div>
    </Suspense>
  );
}
