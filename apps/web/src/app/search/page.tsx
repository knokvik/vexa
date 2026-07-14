"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { useSearchDialog } from "@/components/SearchProvider";

/**
 * /search is deprecated as a full page — opens the search dialog and
 * lands on Jobs (where results are stored).
 */
function SearchRedirect() {
  const router = useRouter();
  const params = useSearchParams();
  const { openSearch } = useSearchDialog();

  useEffect(() => {
    const q = params.get("q") || undefined;
    openSearch(q);
    router.replace("/jobs");
  }, [openSearch, params, router]);

  return (
    <div className="flex items-center justify-center gap-2 py-20 text-sm text-muted-foreground">
      <Loader2 className="size-4 animate-spin" />
      Opening search…
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-20 text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
        </div>
      }
    >
      <SearchRedirect />
    </Suspense>
  );
}
