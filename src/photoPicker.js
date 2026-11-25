import { Capacitor } from '@capacitor/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { translate } from './i18n';

// Inside the native iOS/Android WebView a hidden <input type="file"> never
// offers the camera (Android shows only a file picker), so on native we go
// through the Camera plugin and hand the result to the same onChange handler
// the web input uses. On the web we just click the input as before.
export async function choosePhoto(inputRef, onChange, { cameraOnly = false } = {}) {
  if (!Capacitor.isNativePlatform()) { inputRef.current?.click(); return; }
  try {
    const photo = await Camera.getPhoto({
      source: cameraOnly ? CameraSource.Camera : CameraSource.Prompt,
      resultType: CameraResultType.Uri,
      quality: 80,
      width: 1600,
      correctOrientation: true,
      promptLabelHeader: translate('photo_promptHeader'),
      promptLabelPhoto: translate('photo_promptGallery'),
      promptLabelPicture: translate('photo_promptCamera'),
      promptLabelCancel: translate('photo_promptCancel'),
    });
    const blob = await (await fetch(photo.webPath)).blob();
    const file = new File([blob], 'photo_' + Date.now() + '.' + (photo.format || 'jpeg'), { type: blob.type || 'image/jpeg' });
    await onChange({ target: { files: [file] } });
  } catch (err) {
    if (/cancel/i.test(err?.message || '')) return;
    alert(translate('photo_permissionDenied'));
  }
}
