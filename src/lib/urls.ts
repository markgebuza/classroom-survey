/**
 * Public student URL for a survey slug. Uses VITE_PUBLIC_SITE_URL when set (so QR codes shown
 * from a local dev server still point at production), otherwise the current origin.
 */
export function publicSurveyUrl(
  slug: string,
  siteUrl: string | undefined = import.meta.env.VITE_PUBLIC_SITE_URL,
  origin: string = window.location.origin,
): string {
  // `||` rather than `??` so an empty VITE_PUBLIC_SITE_URL= line in .env falls back too.
  const base = (siteUrl || origin).replace(/\/+$/, '')
  return `${base}/s/${encodeURIComponent(slug)}`
}

export function qrFileName(slug: string): string {
  return `${slug}-qr.png`
}
