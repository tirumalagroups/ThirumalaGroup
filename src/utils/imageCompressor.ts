/**
 * Image compression utility for resizing and converting customer/guarantor photos.
 */

export interface CompressionOptions {
  maxDimension?: number;
  quality?: number;
  format?: 'image/webp' | 'image/jpeg';
}

/**
 * Compresses an image file (JPEG/PNG/etc.) and returns a promise resolving to a Blob.
 * Auto-falls back from WebP to JPEG if needed.
 */
export async function compressToWebP(
  file: File | Blob,
  maxDimension: number = 1280,
  quality: number = 0.78
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          // Maintain aspect ratio
          if (width > height) {
            if (width > maxDimension) {
              height = Math.round((height * maxDimension) / width);
              width = maxDimension;
            }
          } else {
            if (height > maxDimension) {
              width = Math.round((width * maxDimension) / height);
              height = maxDimension;
            }
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            throw new Error('Could not get 2d context for canvas');
          }

          ctx.drawImage(img, 0, 0, width, height);

          // Try exporting to WebP first, fallback to JPEG
          canvas.toBlob(
            (blob) => {
              if (blob) {
                resolve(blob);
              } else {
                // Fallback to JPEG
                canvas.toBlob(
                  (jpegBlob) => {
                    if (jpegBlob) resolve(jpegBlob);
                    else reject(new Error('Canvas compression failed'));
                  },
                  'image/jpeg',
                  quality
                );
              }
            },
            'image/webp',
            quality
          );
        } catch (err) {
          reject(err);
        }
      };
      img.onerror = (err) => reject(err);
      img.src = event.target?.result as string;
    };
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}

/**
 * Creates a thumbnail version of the image (max 256px).
 */
export async function createThumbnail(file: File | Blob): Promise<Blob> {
  return compressToWebP(file, 256, 0.70);
}
