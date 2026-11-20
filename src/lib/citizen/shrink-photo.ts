/**
 * Shrinks a photo in the browser before upload (ISS-030, Citizen Portal 2).
 *
 * Vercel rejects request bodies over 4.5 MB, and phone photos are often 3-12 MB. The AI only
 * needs about 1024 px (src/lib/ai/image.ts resizes to that on the server anyway), so the photo
 * is redrawn at most 1600 px on its long side as a JPEG, which is usually well under 1 MB.
 *
 * Returns the original file when it is already small enough, or when the browser cannot decode
 * it (for example HEIC outside Safari); the server then applies its own size limit.
 */
export const MAX_SIDE = 1600;
export const KEEP_UNDER_BYTES = 1.5 * 1024 * 1024;

export async function shrinkPhoto(file: File, maxSide = MAX_SIDE, quality = 0.82): Promise<File> {
  if (!file.type.startsWith("image/") || typeof createImageBitmap !== "function") return file;

  let bitmap: ImageBitmap;
  try {
    // "from-image" applies the EXIF rotation, so portrait phone photos stay upright.
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return file;
  }

  try {
    const longSide = Math.max(bitmap.width, bitmap.height);
    if (longSide <= maxSide && file.size <= KEEP_UNDER_BYTES) return file;

    const scale = Math.min(1, maxSide / longSide);
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    if (!blob || blob.size >= file.size) return file;
    const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
    return new File([blob], name, { type: "image/jpeg", lastModified: file.lastModified });
  } finally {
    bitmap.close();
  }
}
