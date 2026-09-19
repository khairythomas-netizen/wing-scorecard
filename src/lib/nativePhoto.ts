import { isNative } from './platform';

/**
 * Picking a photo.
 *
 * On the web this is a file input, which on iOS Safari means an action sheet,
 * then the library, then a confirmation screen before the app sees anything.
 * The native shell opens the system picker directly and hands the image
 * straight back, which removes that middle step entirely.
 *
 * Returns null if the picker was dismissed, which is not an error.
 */
export async function pickPhoto(): Promise<File | null> {
  if (!isNative()) return null;

  const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera');
  try {
    const photo = await Camera.getPhoto({
      quality: 90,
      allowEditing: false,
      resultType: CameraResultType.Uri,
      // Offers the camera and the library, which is the right choice for a
      // wing you are looking at right now.
      source: CameraSource.Prompt,
      promptLabelHeader: 'Add a photo',
      promptLabelPhoto: 'Choose from library',
      promptLabelPicture: 'Take a photo',
    });
    if (!photo.webPath) return null;

    const blob = await (await fetch(photo.webPath)).blob();
    const ext = photo.format || 'jpeg';
    return new File([blob], `wing.${ext}`, { type: blob.type || `image/${ext}` });
  } catch {
    // Capacitor throws on cancel, which is not something to report.
    return null;
  }
}
