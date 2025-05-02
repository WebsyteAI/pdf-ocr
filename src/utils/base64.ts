// Helper: Validate base64 string
export function isValidBase64(str: string) {
  if (!str || typeof str !== "string" || str.length < 8) return false;
  // Basic base64 regex (not strict, but avoids obvious errors)
  return /^[A-Za-z0-9+/=\s]+$/.test(str);
}

// Helper: Strip data URL prefix if present
export function stripDataUrlPrefix(dataUrl: string): string {
  const match = dataUrl.match(/^data:(image\/(jpeg|png|jpg));base64,(.*)$/);
  if (match) return match[3];
  return dataUrl;
}
