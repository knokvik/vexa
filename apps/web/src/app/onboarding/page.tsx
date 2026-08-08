"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

/** Profile lives with Resume on /resumes — keep this route as a redirect. */
export default function OnboardingRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/resumes");
  }, [router]);

  return (
    <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
      <Loader2 className="size-4 animate-spin" />
      Opening profile & resume…
    </div>
  );
}
