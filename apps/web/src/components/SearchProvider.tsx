"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { SearchDialog } from "@/components/SearchDialog";

type SearchCtx = {
  openSearch: (query?: string) => void;
  closeSearch: () => void;
};

const Ctx = createContext<SearchCtx | null>(null);

export function useSearchDialog() {
  const ctx = useContext(Ctx);
  if (!ctx) {
    return {
      openSearch: () => {},
      closeSearch: () => {},
    };
  }
  return ctx;
}

export function SearchProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [initialQuery, setInitialQuery] = useState("");

  const openSearch = useCallback((query?: string) => {
    setInitialQuery(query?.trim() || "");
    setOpen(true);
  }, []);

  const closeSearch = useCallback(() => setOpen(false), []);

  const value = useMemo(
    () => ({ openSearch, closeSearch }),
    [openSearch, closeSearch]
  );

  return (
    <Ctx.Provider value={value}>
      {children}
      <SearchDialog
        open={open}
        onOpenChange={setOpen}
        initialQuery={initialQuery}
      />
    </Ctx.Provider>
  );
}
