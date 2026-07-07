function loadImage(dataUrl: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Image could not be decoded.'));
    image.src = dataUrl;
  });
}

/**
 * Downscale artwork to a small JPEG data URL for storing alongside a saved
 * palette. Keeps localStorage usage modest while the full-resolution image
 * stays in memory only (never persisted).
 */
export async function createArtworkThumbnail(dataUrl: string, maxDimension = 480) {
  const image = await loadImage(dataUrl);
  const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight, 1));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error('Canvas is unavailable.');
  }

  // JPEG has no alpha channel; flatten onto white first.
  context.fillStyle = '#FFFFFF';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.8);
}
