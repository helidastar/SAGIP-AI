import "server-only";
import sharp from "sharp";

const MAX_DIMENSION = 1024;

/**
 * Shrink a photo for the AI (~1024px longest side, JPEG) to cut tokens and latency.
 * The original stays in storage. Falls back to the original bytes if the image can't be processed.
 */
export async function prepareImageForAi(image: { data: Buffer; mimeType: string }) {
  try {
    const data = await sharp(image.data, { failOn: "none" })
      .rotate() // apply EXIF orientation before stripping metadata
      .resize({ width: MAX_DIMENSION, height: MAX_DIMENSION, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 80, mozjpeg: true })
      .toBuffer();
    return { data, mimeType: "image/jpeg" };
  } catch (err) {
    console.warn("Image resize failed, sending original", err);
    return image;
  }
}
