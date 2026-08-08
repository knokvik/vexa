"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/**
 * Soft fade/slide when switching pages — no logo spin, no bounce.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [visible, setVisible] = useState(true);
  const [key, setKey] = useState(pathname);

  useEffect(() => {
    // Instant hide then fade in new route
    setVisible(false);
    const t = window.setTimeout(() => {
      setKey(pathname);
      setVisible(true);
    }, 40);
    return () => window.clearTimeout(t);
  }, [pathname]);

  return (
    <div
      key={key}
      className={cn(
        "w-full transition-[opacity,transform] duration-200 ease-out",
        visible
          ? "translate-y-0 opacity-100"
          : "translate-y-1 opacity-0"
      )}
    >
      {children}
    </div>
  );
}
