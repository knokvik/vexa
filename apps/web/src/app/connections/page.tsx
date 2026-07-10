import { Suspense } from "react";
import ConnectionsClient from "./ConnectionsClient";

export default function ConnectionsPage() {
  return (
    <Suspense
      fallback={
        <div className="text-sm text-zinc-400">Loading connections…</div>
      }
    >
      <ConnectionsClient />
    </Suspense>
  );
}
