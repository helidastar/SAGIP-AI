/**
 * Shrinks a phone photo in the browser before upload.
 *
 * Vercel rejects request bodies over 4.5 MB, but phone photos are often 5-10 MB (ISS-030).
 * Photos that are already small are returned unchanged. If the browser cannot decode the
 * image, the original file is returned and the server limit still applies.
 */
const SMALL_ENOUGH_BYTES = 3 * 1024 * 1024;
const MAX_SIDE_PX = 1600;
const JPEG_QUALITY = 0.8;

export async function shrinkPhoto(file: File): Promise<File> {
  if (file.size <= SMALL_ENOUGH_BYTES) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE_PX / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY));
    if (!blob) return file;
    const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
    return new File([blob], name, { type: "image/jpeg" });
  } catch {
    return file;
  }
}
