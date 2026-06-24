"use client";

import { useEffect } from "react";
import { applyAppTheme, DEFAULT_APP_THEME, normalizeTheme } from "@/lib/appTheme";
import { getConfigItem } from "@/lib/firestore";
import { storageKeys } from "@/lib/appStorage";

export default function ClientPortalPageBackground() {
  useEffect(() => {
    async function apply() {
      const theme = normalizeTheme(
        await getConfigItem<Partial<typeof DEFAULT_APP_THEME>>(storageKeys.clientPortalTheme, DEFAULT_APP_THEME)
      );
      applyAppTheme(theme);
    }
    apply();
    window.addEventListener(`${storageKeys.clientPortalTheme}-updated`, apply as EventListener);
    return () => {
      window.removeEventListener(`${storageKeys.clientPortalTheme}-updated`, apply as EventListener);
    };
  }, []);
  return null;
}
