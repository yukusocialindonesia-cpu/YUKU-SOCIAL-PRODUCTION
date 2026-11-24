const MAX_INPUT_BYTES = 10 * 1024 * 1024;
const TARGET_OUTPUT_BYTES = 300 * 1024;
const MAX_DIMENSION = 1200;

/**
 * Compresses a user-selected profile image into a WebP file.
 * The original file is never modified.
 */
export async function compressProfileImage(file: File): Promise<File> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    throw new Error('Format foto harus JPG, PNG, atau WebP.');
  }
  if (file.size === 0 || file.size > MAX_INPUT_BYTES) {
    throw new Error('Ukuran foto asli maksimal 10 MB.');
  }

  let bitmap: ImageBitmap | null = null;
  let objectUrl: string | null = null;
  let image: HTMLImageElement | null = null;

  try {
    if (typeof createImageBitmap === 'function') {
      bitmap = await createImageBitmap(file);
    } else {
      objectUrl = URL.createObjectURL(file);
      image = new Image();
      image.src = objectUrl;
      await new Promise<void>((resolve, reject) => {
        image!.onload = () => resolve();
        image!.onerror = () => reject(new Error('Foto tidak dapat dibaca. Coba pilih foto lain.'));
      });
    }

    const sourceWidth = bitmap?.width ?? image?.naturalWidth ?? 0;
    const sourceHeight = bitmap?.height ?? image?.naturalHeight ?? 0;
    if (!sourceWidth || !sourceHeight) {
      throw new Error('Dimensi foto tidak valid. Coba pilih foto lain.');
    }

    const initialScale = Math.min(1, MAX_DIMENSION / Math.max(sourceWidth, sourceHeight));
    let width = Math.max(1, Math.round(sourceWidth * initialScale));
    let height = Math.max(1, Math.round(sourceHeight * initialScale));
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Browser tidak mendukung pemrosesan foto.');

    const drawAndEncode = (quality: number) => new Promise<Blob>((resolve, reject) => {
      canvas.width = width;
      canvas.height = height;
      context.clearRect(0, 0, width, height);
      context.drawImage(bitmap ?? image!, 0, 0, width, height);
      canvas.toBlob(
        (blob) => blob ? resolve(blob) : reject(new Error('Gagal mengompres foto. Coba foto lain.')),
        'image/webp',
        quality,
      );
    });

    let output: Blob | null = null;
    for (let dimensionAttempt = 0; dimensionAttempt < 4; dimensionAttempt += 1) {
      for (const quality of [0.82, 0.72, 0.62, 0.52]) {
        output = await drawAndEncode(quality);
        if (output.size <= TARGET_OUTPUT_BYTES) break;
      }
      if (output && output.size <= TARGET_OUTPUT_BYTES) break;
      width = Math.max(1, Math.round(width * 0.85));
      height = Math.max(1, Math.round(height * 0.85));
    }

    if (!output) throw new Error('Gagal mengompres foto.');
    return new File([output], `yuku-profile-${Date.now()}.webp`, {
      type: 'image/webp',
      lastModified: Date.now(),
    });
  } finally {
    bitmap?.close();
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  }
}
