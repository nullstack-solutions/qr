"use client";

import { useEffect, useState } from "react";
import { clearDraft, loadDraft, saveDraft } from "@/lib/indexedDb";

export function useDraft<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(initial);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let mounted = true;
    loadDraft<T>(key).then((draft) => {
      if (mounted && draft) {
        setValue(draft);
      }
      if (mounted) {
        setHydrated(true);
      }
    });
    return () => {
      mounted = false;
    };
  }, [key]);

  useEffect(() => {
    if (!hydrated) return;
    saveDraft(key, value).catch((error) => {
      console.warn("Не удалось сохранить черновик", error);
    });
  }, [key, value, hydrated]);

  const reset = async () => {
    setValue(initial);
    await clearDraft(key);
  };

  return { value, setValue, hydrated, reset };
}
