// Shared upload validation for HR / credential uploads.
export const MAX_UPLOAD_MB = 10;
export const ALLOWED_UPLOAD_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];
export const ALLOWED_UPLOAD_EXT = /\.(pdf|jpe?g|png|webp|heic|docx?|)$/i;

export function validateUpload(file: File): string | null {
  if (file.size > MAX_UPLOAD_MB * 1024 * 1024) {
    return `File is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Max ${MAX_UPLOAD_MB} MB.`;
  }
  const okType = ALLOWED_UPLOAD_TYPES.includes(file.type) || ALLOWED_UPLOAD_EXT.test(file.name);
  if (!okType) {
    return `Unsupported file type. Allowed: PDF, JPG, PNG, WEBP, HEIC, DOC, DOCX.`;
  }
  return null;
}
