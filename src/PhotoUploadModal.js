import React, { useState, useRef } from 'react';
import { Upload, X, Check } from 'lucide-react';
import { supabase } from './supabase';
import { useLanguage } from './i18n';


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

  if (submitted) {
    return (
      <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 }}>
        <div style={{ background:'white', borderRadius:20, padding:32, textAlign:'center', maxWidth:320 }}>
          <div style={{ fontSize:48, marginBottom:16 }}>✅</div>
          <div style={{ fontSize:18, fontWeight:700, color:'#1a1a1a', marginBottom:8 }}>{tr('photoUpload_successTitle')}</div>
          <div style={{ fontSize:14, color:'#888' }}>{tr('photoUpload_successBody')}</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'flex-end', zIndex:1000 }}>
      <div style={{ width:'100%', maxWidth:390, background:'white', borderRadius:'24px 24px 0 0', padding:'24px', boxSizing:'border-box' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
          <div style={{ fontSize:18, fontWeight:700, color:'#1a1a1a' }}>{tr('photoUpload_title')}</div>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', padding:0 }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ background:'#E8F5E9', borderRadius:14, padding:12, marginBottom:20 }}>
          <div style={{ fontSize:13, fontWeight:600, color:'#2E7D32', marginBottom:4 }}>{tr('photoUpload_proofHeading')}</div>
          <div style={{ fontSize:12, color:'#555' }}>{tr('photoUpload_proofBody', { pet: booking.pet_name || tr('photoUpload_thePetFallback') })}</div>
        </div>

        {/* Photo gallery */}
        <div style={{ display:'flex', gap:10, flexWrap:'wrap', marginBottom:16 }}>
          {photos.map((url, i) => (
            <div key={i} style={{ position:'relative', width:90, height:90 }}>
              <img src={url} alt={tr('photoUpload_photoAlt', { num: i + 1 })} style={{ width:90, height:90, borderRadius:12, objectFit:'cover' }} />
              <div onClick={() => setPhotos(prev => prev.filter((_, j) => j !== i))}
                style={{ position:'absolute', top:-8, right:-8, width:28, height:28, borderRadius:14, background:'#D32F2F', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}>
                <X size={16} color="white" />
              </div>
            </div>
          ))}
          {photos.length < 3 && (
            <div onClick={() => fileInputRef.current?.click()}
              style={{ width:90, height:90, borderRadius:12, background:'#E8F5E9', border:'2px dashed #2E7D32', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', cursor:'pointer', gap:4 }}>
              {uploading ? <span style={{ fontSize:12, color:'#2E7D32' }}>...</span> : <><Upload size={20} color="#2E7D32" /><span style={{ fontSize:10, color:'#2E7D32' }}>{photos.length === 0 ? tr('photoUpload_addLabel') : tr('photoUpload_moreLabel')}</span></>}
            </div>
          )}
        </div>

        <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handlePhotoSelect} style={{ display:'none' }} />
        <div style={{ fontSize:12, color:'#AAA', marginBottom:16 }}>{tr('photoUpload_countLabel', { count: photos.length })}</div>

        {error && (
          <div style={{ background:'#FCEBEB', borderRadius:10, padding:'10px 12px', marginBottom:14, fontSize:12, color:'#A32D2D' }}>
            {error}
          </div>
        )}

        {/* Buttons */}
        <div style={{ display:'flex', gap:10 }}>
          <button onClick={onClose} style={{ flex:1, padding:'12px 0', borderRadius:12, border:'1.5px solid #E0E0E0', background:'white', fontSize:14, fontWeight:600, cursor:'pointer', color:'#555' }}>
            {tr('photoUpload_skipForNow')}
          </button>
          <button onClick={submitPhotos} disabled={photos.length === 0 || uploading} style={{ flex:1, padding:'12px 0', borderRadius:12, border:'none', background:photos.length === 0 ? '#E0E0E0' : '#2E7D32', fontSize:14, fontWeight:600, cursor:photos.length === 0 ? 'not-allowed' : 'pointer', color:'white' }}>
            {uploading ? tr('photoUpload_uploadingButton') : photos.length > 0 ? tr('photoUpload_uploadPhotosButton') : tr('photoUpload_selectPhotosButton')}
          </button>
        </div>
      </div>
    </div>
  );
}
