import { Suspense } from "react";
import { ProfileFavoritesPage } from "@/views/profile";

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex-1 bg-surface-background" />
      }
    >
      <ProfileFavoritesPage />
    </Suspense>
  );
}
