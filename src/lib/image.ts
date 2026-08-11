/**
 * Image utilities for client-side photo compression.
 *
 * Mobile photos can be 3-5 MB each. SQLite/Turso rows can handle this,
 * but uploading 4 photos × 5 MB = 20 MB per registration is wasteful
 * and slow on mobile data. We resize + compress to JPEG before upload.
 *
 * Target: max 1280px on longest side, JPEG quality 0.7.
 * Typical result: 80-200 KB per photo.
 */

export interface CompressedImage {
  dataUrl: string;     // "data:image/jpeg;base64,..."
  width: number;
  height: number;
  sizeKb: number;
}

export async function compressImage(
  file: File | Blob,
  maxDim = 1280,
  quality = 0.7
): Promise<CompressedImage> {
  // Read file into an HTMLImageElement
  const bitmap = await loadBitmap(file);
  const { width: srcW, height: srcH } = bitmap;

  // Compute target dimensions preserving aspect ratio
  let targetW = srcW;
  let targetH = srcH;
  if (srcW > maxDim || srcH > maxDim) {
    const scale = maxDim / Math.max(srcW, srcH);
    targetW = Math.round(srcW * scale);
    targetH = Math.round(srcH * scale);
  }

  // Draw to canvas
  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');
  ctx.drawImage(bitmap, 0, 0, targetW, targetH);

  // Export as JPEG data URL
  const dataUrl = canvas.toDataURL('image/jpeg', quality);
  // dataUrl prefix is "data:image/jpeg;base64," (~23 chars). Base64 is ~4/3 the binary size.
  const base64 = dataUrl.split(',')[1] ?? '';
  const sizeKb = Math.round((base64.length * 3) / 4 / 1024);

  // Release bitmap memory if it's a ImageBitmap
  if ('close' in bitmap && typeof (bitmap as ImageBitmap).close === 'function') {
    (bitmap as ImageBitmap).close();
  }

  return { dataUrl, width: targetW, height: targetH, sizeKb };
}

async function loadBitmap(file: File | Blob): Promise<ImageBitmap | HTMLImageElement> {
  // Prefer createImageBitmap (faster, no DOM needed) — supported on modern browsers
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file);
    } catch {
      // Fall through to <img> approach
    }
  }
  // Fallback for older browsers (Safari < 14, etc.)
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(e);
    };
    img.src = url;
  });
}
