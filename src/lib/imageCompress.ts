export async function compressImageFile(
  file: File,
  maxDimension = 1024,
  initialQuality = 0.78
): Promise<string> {
  const rawDataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to read image file.'));
      }
    };
    reader.onerror = () => reject(new Error('Unable to read image file.'));
    reader.readAsDataURL(file);
  });

  if (typeof document === 'undefined' || typeof Image === 'undefined') {
    return rawDataUrl;
  }

  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error('Image decode failed.'));
      element.src = rawDataUrl;
    });

    const scale = Math.min(1, maxDimension / Math.max(img.width || 1, img.height || 1));
    const width = Math.max(1, Math.round((img.width || maxDimension) * scale));
    const height = Math.max(1, Math.round((img.height || maxDimension) * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return rawDataUrl;

    ctx.drawImage(img, 0, 0, width, height);

    // Keep base64 well within Firestore's 1 MiB document ceiling (~280 KB data URI target)
    let result = canvas.toDataURL('image/jpeg', initialQuality);
    if (result.length > 380_000) {
      result = canvas.toDataURL('image/jpeg', 0.62);
    }
    if (result.length > 380_000) {
      result = canvas.toDataURL('image/jpeg', 0.48);
    }
    return result;
  } catch {
    return rawDataUrl;
  }
}
