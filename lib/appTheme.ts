export type AppTheme = {
  topNavColor: string;
  bannerColor: string;
  accentColor: string;
  topNavTextColor: string;
  bannerTextColor: string;
  bannerButtonTextColor: string;
  bannerOverlayOpacity: number;
  pageOverlayOpacity: number;
  bannerImageDataUrl: string;
};

export const DEFAULT_APP_THEME: AppTheme = {
  topNavColor: "#06182d",
  bannerColor: "#071a2f",
  accentColor: "#3abeff",
  topNavTextColor: "#ffffff",
  bannerTextColor: "#ffffff",
  bannerButtonTextColor: "#ffffff",
  bannerOverlayOpacity: 86,
  pageOverlayOpacity: 85,
  bannerImageDataUrl: "",
};

export const BANNER_IMAGE_RECOMMENDED_SIZE = "1920 x 360 px";

export function isHexColor(value: string) {
  return /^#[0-9a-fA-F]{6}$/.test(value.trim());
}

export function hexToRgb(hex: string): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `${r},${g},${b}`;
}

export function normalizeTheme(theme: Partial<AppTheme> | null | undefined): AppTheme {
  const topNavColor = theme?.topNavColor;
  const bannerColor = theme?.bannerColor;
  const accentColor = theme?.accentColor;
  const topNavTextColor = theme?.topNavTextColor;
  const bannerTextColor = theme?.bannerTextColor;
  const bannerButtonTextColor = theme?.bannerButtonTextColor;

  return {
    topNavColor: isHexColor(topNavColor || "") ? topNavColor as string : DEFAULT_APP_THEME.topNavColor,
    bannerColor: isHexColor(bannerColor || "") ? bannerColor as string : DEFAULT_APP_THEME.bannerColor,
    accentColor: isHexColor(accentColor || "") ? accentColor as string : DEFAULT_APP_THEME.accentColor,
    topNavTextColor: isHexColor(topNavTextColor || "") ? topNavTextColor as string : DEFAULT_APP_THEME.topNavTextColor,
    bannerTextColor: isHexColor(bannerTextColor || "") ? bannerTextColor as string : DEFAULT_APP_THEME.bannerTextColor,
    bannerButtonTextColor: isHexColor(bannerButtonTextColor || "") ? bannerButtonTextColor as string : DEFAULT_APP_THEME.bannerButtonTextColor,
    bannerOverlayOpacity: typeof theme?.bannerOverlayOpacity === "number"
      ? Math.min(100, Math.max(0, theme.bannerOverlayOpacity))
      : DEFAULT_APP_THEME.bannerOverlayOpacity,
    pageOverlayOpacity: typeof theme?.pageOverlayOpacity === "number"
      ? Math.min(100, Math.max(0, theme.pageOverlayOpacity))
      : DEFAULT_APP_THEME.pageOverlayOpacity,
    bannerImageDataUrl: typeof theme?.bannerImageDataUrl === "string" ? theme.bannerImageDataUrl : "",
  };
}

export function applyAppTheme(theme: AppTheme) {
  if (typeof document === "undefined") return;

  const t = normalizeTheme(theme);
  const root = document.documentElement;
  root.style.setProperty("--axis-navy", t.topNavColor);
  root.style.setProperty("--axis-blue", t.accentColor);
  root.style.setProperty("--axis-vivid", t.accentColor);
  root.style.setProperty("--axis-cyan", t.accentColor);
  root.style.setProperty("--theme-top-nav", t.topNavColor);
  root.style.setProperty("--theme-banner", t.bannerColor);
  root.style.setProperty("--theme-accent", t.accentColor);
  root.style.setProperty("--theme-top-nav-text", t.topNavTextColor);
  root.style.setProperty("--theme-banner-text", t.bannerTextColor);
  root.style.setProperty("--theme-banner-button-text", t.bannerButtonTextColor);

  // Full-page background photo with color overlay
  if (t.bannerImageDataUrl) {
    const rgb = hexToRgb(t.topNavColor);
    const alpha = (t.pageOverlayOpacity / 100).toFixed(2);
    document.body.style.backgroundImage =
      `linear-gradient(rgba(${rgb},${alpha}),rgba(${rgb},${alpha})),url(${t.bannerImageDataUrl})`;
    document.body.style.backgroundSize = "cover";
    document.body.style.backgroundAttachment = "fixed";
    document.body.style.backgroundPosition = "center";
    root.dataset.pageBg = "1";
  } else {
    document.body.style.backgroundImage = "";
    document.body.style.backgroundSize = "";
    document.body.style.backgroundAttachment = "";
    document.body.style.backgroundPosition = "";
    delete root.dataset.pageBg;
  }
}
