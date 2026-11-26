import React, { useState, useRef } from 'react';
import { supabase } from './supabase';
import { choosePhoto } from './photoPicker';
import { useLanguage } from './i18n';
import { color, font, radius, ui } from './theme';
import Icon from './ui/Icon';


const compressImage = (file, maxSizeMB = 2) => new Promise((resolve) => {
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let w = img.width, h = img.height;
      const maxPx = 1200;
      if (w > maxPx) { h = h * maxPx / w; w = maxPx; }
      if (h > maxPx) { w = w * maxPx / h; h = maxPx; }
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      canvas.toBlob((blob) => resolve(new File([blob], file.name, { type: 'image/jpeg' })), 'image/jpeg', 0.8);
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
});

export default function PhotoUploadModal({ booking, onClose, onSubmitted }) {
  const { t: tr } = useLanguage();
  const [photos, setPhotos] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  const handlePhotoSelect = async (e) => {
    const files = Array.from(e.target.files || []);
    if (photos.length + files.length > 3) { setError(tr('photoUpload_maxPhotosError')); return; }
    if (!files.length) return;

    setUploading(true);
    setError('');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      for (let file of files.slice(0, 3 - photos.length)) {
        const compressed = await compressImage(file);
        const path = 'walk-' + user.id + '-' + Date.now() + '-' + Math.random().toString(36).slice(2) + '.jpg';
        const { error: uploadError } = await supabase.storage.from('walk-photos').upload(path, compressed);
        if (uploadError) throw uploadError;
        const { data: { publicUrl } } = supabase.storage.from('walk-photos').getPublicUrl(path);
        setPhotos(prev => [...prev, publicUrl]);
      }
    } catch (e) {
      setError(e.message || tr('photoUpload_uploadFailedFallback'));
    }
    setUploading(false);
  };

  const submitPhotos = async () => {
    if (photos.length === 0) { setError(tr('photoUpload_minPhotosError')); return; }

    setUploading(true);
    try {
      const { error: err } = await supabase.from('walk_photo_reports').insert({
        booking_id: booking.id,
        sitter_id: booking.sitter_id,
        pet_parent_id: booking.pet_parent_id,
        photo_urls: photos,
        photo_count: photos.length,
      });
      if (err) throw err;

      const { error: bookingUpdateError } = await supabase.from('bookings').update({ sitter_uploaded_photos: true }).eq('id', booking.id);
      if (bookingUpdateError) console.error('Could not mark photos uploaded:', bookingUpdateError.message);

      // TIER 1: Send walk proof notification to pet parent
      try {
        const { data: parentContact } = await supabase.rpc('get_user_contact', { target_id: booking.pet_parent_id });

        const { data: sitterData } = await supabase
          .from('sitter_profiles')
          .select('users(name)')
          .eq('id', booking.sitter_id)
          .single();

        if (parentContact && sitterData) {
          const { notifyWalkProofReceived } = await import('./notificationService');
          await notifyWalkProofReceived(
            booking.pet_parent_id,
            parentContact?.[0]?.email,
            parentContact?.[0]?.phone,
            sitterData.users?.name
          );
        }
      } catch(notifErr) { console.error('Photo notification failed:', notifErr); }

      setSubmitted(true);
      setTimeout(() => { onSubmitted && onSubmitted(); }, 1500);
    } catch (e) {
      setError(e.message || tr('photoUpload_saveFailedFallback'));
    }
    setUploading(false);
  };

  const overlay = { position: 'fixed', inset: 0, background: 'rgba(16,24,40,0.5)', display: 'flex', justifyContent: 'center', zIndex: 1000, fontFamily: font.family };

  if (submitted) {
    return (
      <div style={{ ...overlay, alignItems: 'center', padding: 16 }}>
        <div role="status" style={{ background: color.surface, borderRadius: radius.xl, padding: 28, textAlign: 'center', maxWidth: 320, width: '100%', boxSizing: 'border-box' }}>
          <div style={{ width: 56, height: 56, borderRadius: radius.pill, background: color.successSoft, color: color.success, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
            <Icon name="check" size={28} strokeWidth={2.2} />
          </div>
          <div style={{ fontSize: font.lg, fontWeight: 700, color: color.ink, marginBottom: 6 }}>{tr('photoUpload_successTitle')}</div>
          <div style={{ fontSize: font.md, color: color.muted, lineHeight: 1.5 }}>{tr('photoUpload_successBody')}</div>
        </div>
      </div>
    );
  }

  const canSubmit = photos.length > 0 && !uploading;

  return (
    <div style={{ ...overlay, alignItems: 'flex-end' }}>
      <div role="dialog" aria-modal="true" aria-label={tr('photoUpload_title')}
        style={{ width: '100%', maxWidth: 480, background: color.surface, borderRadius: `${radius.xl}px ${radius.xl}px 0 0`, padding: '20px 20px calc(20px + env(safe-area-inset-bottom))', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: font.lg, fontWeight: 700, color: color.ink }}>{tr('photoUpload_title')}</div>
          <button onClick={onClose} aria-label={tr('common_close')} style={{ ...ui.backButton, width: 36, height: 36 }}>
            <Icon name="close" size={18} />
          </button>
        </div>

        <div style={{ background: color.successSoft, borderRadius: radius.md, padding: 12, marginBottom: 16 }}>
          <div style={{ fontSize: font.md, fontWeight: 600, color: color.success, marginBottom: 4 }}>{tr('photoUpload_proofHeading')}</div>
          <div style={{ fontSize: font.sm, color: color.text, lineHeight: 1.5 }}>{tr('photoUpload_proofBody', { pet: booking.pet_name || tr('photoUpload_thePetFallback') })}</div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 10 }}>
          {photos.map((url, i) => (
            <div key={i} style={{ position: 'relative', aspectRatio: '1' }}>
              <img src={url} alt={tr('photoUpload_photoAlt', { num: i + 1 })} style={{ width: '100%', height: '100%', borderRadius: radius.md, objectFit: 'cover', display: 'block' }} />
              <button type="button" onClick={() => setPhotos(prev => prev.filter((_, j) => j !== i))} aria-label={tr('photoUpload_removePhotoAria', { num: i + 1 })}
                style={{ position: 'absolute', top: 6, right: 6, width: 28, height: 28, borderRadius: radius.pill, background: color.surface, color: color.danger, border: 'none', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 1px 4px rgba(16,24,40,0.2)' }}>
                <Icon name="close" size={16} />
              </button>
            </div>
          ))}
          {photos.length < 3 && (
            <button type="button" onClick={() => choosePhoto(fileInputRef, handlePhotoSelect)} aria-label={uploading ? tr('photoUpload_uploadingButton') : tr('photoUpload_addPhotoAria')}
              style={{ aspectRatio: '1', boxSizing: 'border-box', padding: 0, fontFamily: 'inherit', borderRadius: radius.md, background: color.tile, border: `1.5px dashed ${color.faint}`, color: color.navy, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', gap: 4 }}>
              {uploading ? <span style={{ fontSize: font.sm }}>...</span> : <><Icon name="camera" size={22} /><span style={{ fontSize: font.xs, fontWeight: 600 }}>{photos.length === 0 ? tr('photoUpload_addLabel') : tr('photoUpload_moreLabel')}</span></>}
            </button>
          )}
        </div>

        <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handlePhotoSelect} style={{ display: 'none' }} />
        <div style={{ fontSize: font.xs, color: color.muted, marginBottom: 16 }}>{tr('photoUpload_countLabel', { count: photos.length })}</div>

        {error && (
          <div role="alert" style={{ background: color.dangerSoft, borderRadius: radius.md, padding: '10px 12px', marginBottom: 14, fontSize: font.sm, color: color.danger }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{ ...ui.secondaryButton, flex: 1, padding: '0 10px' }}>
            {tr('photoUpload_skipForNow')}
          </button>
          <button onClick={submitPhotos} disabled={!canSubmit}
            style={{ ...ui.primaryButton, flex: 1, padding: '0 10px', background: photos.length === 0 ? color.tile : color.navy, color: photos.length === 0 ? color.faint : color.surface, cursor: photos.length === 0 ? 'not-allowed' : 'pointer', opacity: uploading ? 0.7 : 1 }}>
            {uploading ? tr('photoUpload_uploadingButton') : photos.length > 0 ? tr('photoUpload_uploadPhotosButton') : tr('photoUpload_selectPhotosButton')}
          </button>
        </div>
      </div>
    </div>
  );
}
