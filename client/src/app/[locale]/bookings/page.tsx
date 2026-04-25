import { Suspense } from "react";
import { BookingsPage } from "@/views/bookings";

export default function Page() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-surface-background" />}>
      <BookingsPage />
    </Suspense>
  );
}
