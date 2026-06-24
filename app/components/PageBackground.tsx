"use client";

import { useEffect } from "react";
import { applyAppTheme, DEFAULT_APP_THEME, normalizeTheme } from "@/lib/appTheme";
import { getConfigItem } from "@/lib/firestore";
import { storageKeys } from "@/lib/appStorage";

export default function PageBackground() {
  useEffect(() => {
    async function apply() {
      const theme = normalizeTheme(
        await getConfigItem<Partial<typeof DEFAULT_APP_THEME>>(storageKeys.appTheme, DEFAULT_APP_THEME)
      );
      applyAppTheme(theme);
    }
    apply();
    window.addEventListener(`${storageKeys.appTheme}-updated`, apply as EventListener);
    return () => {
      window.removeEventListener(`${storageKeys.appTheme}-updated`, apply as EventListener);
    };
  }, []);
  return null;
}
