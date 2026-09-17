import sharp from 'sharp';

const MAX_DIMENSION = 2000;
const JPEG_QUALITY = 82;

export interface CompressedImage {
  buffer: Buffer;
  contentType: string;
  extension: string;
}

// Every uploaded image (Product photos, Story moments) goes through this
// before it ever reaches S3 — a raw phone-camera photo can be 4-6MB, which
// is fine for a browser but was confirmed to silently break WhatsApp/social
// share previews (og:image) on a Story page. Compressing once at upload
// time fixes every future consumer (the page itself, og:image, admin
// previews, a direct S3 link) without needing per-consumer workarounds.
export async function compressImage(buffer: Buffer): Promise<CompressedImage> {
  // `.rotate()` with no args reads the EXIF orientation tag, physically
  // applies it, then strips EXIF entirely — avoids the classic "sideways
  // phone photo" bug and shrinks the file further on its own.
  const image = sharp(buffer).rotate();
  const metadata = await image.metadata();

  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;
  if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
    image.resize({ width: MAX_DIMENSION, height: MAX_DIMENSION, fit: 'inside', withoutEnlargement: true });
  }

  // Real transparency (an actual PNG graphic) stays PNG — flattening it to
  // JPEG would silently destroy the alpha channel. Everything else (the
  // overwhelming majority: real photos) normalizes to JPEG, which is also
  // the deliberate choice for social-share compatibility — this exact file
  // is what og:image links point at directly, and JPEG's universal support
  // matters more there than WebP's extra ~20% size saving.
  if (metadata.hasAlpha) {
    const out = await image.png({ compressionLevel: 9 }).toBuffer();
    return { buffer: out, contentType: 'image/png', extension: 'png' };
  }

  const out = await image.jpeg({ quality: JPEG_QUALITY, mozjpeg: true }).toBuffer();
  return { buffer: out, contentType: 'image/jpeg', extension: 'jpg' };
}
