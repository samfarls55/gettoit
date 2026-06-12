// GetToIt web — optional App Store URL for mobile-app CTAs.

export function normalizeAppStoreUrl(value?: string | null): string | null {
  const url = value?.trim();
  return url ? url : null;
}

export const APP_STORE_URL = normalizeAppStoreUrl(
  process.env.NEXT_PUBLIC_APP_STORE_URL,
);
