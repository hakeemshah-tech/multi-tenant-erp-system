// app/join-review/page.tsx (Server Component)
import { Suspense } from "react";
import ClientView from "./JoinReviewPage";

export default function Page() {
  return (
    <Suspense fallback={<div>Loading…</div>}>
      <ClientView />
    </Suspense>
  );
}
