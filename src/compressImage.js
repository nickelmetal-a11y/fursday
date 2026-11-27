// Resizes a photo to at most maxPx on its long side and re-encodes it as JPEG.
// If the browser can't decode it, the original file is uploaded instead.
export function compressImage(file, maxPx = 1200) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onerror = () => resolve(file);
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => resolve(file);
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let w = img.width, h = img.height;
        if (w > maxPx) { h = h * maxPx / w; w = maxPx; }
        if (h > maxPx) { w = w * maxPx / h; h = maxPx; }
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        canvas.toBlob((blob) => resolve(blob ? new File([blob], file.name, { type: 'image/jpeg' }) : file), 'image/jpeg', 0.8);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}
