import React, { useState, useRef, useEffect } from 'react';
import { ArrowLeft, Camera, X, ChevronRight } from 'lucide-react';
import { supabase } from './supabase';

const THEMES = {
  Gurgaon: { primary: '#FF6B35', light: '#FFF0EB', grad: 'linear-gradient(135deg,#FF6B35,#FF8C5A)' },
  Pune: { primary: '#6C5CE7', light: '#F0EEFF', grad: 'linear-gradient(135deg,#6C5CE7,#8E7CF3)' },
};

const BREEDS = ['Labrador','Golden Retriever','German Shepherd','Beagle','Pug','Shih Tzu','Pomeranian','Chihuahua','Jack Russell Terrier','Indie/Mixed','Husky','Doberman','Rottweiler','Cocker Spaniel','Dachshund','Boxer','Border Collie','Dalmatian','Great Dane','Saint Bernard','Maltese','Bichon Frise','Lhasa Apso','Tibetan Mastiff','Spitz','Other'];


const compressImage = (file, maxSizeMB = 1) => new Promise((resolve) => {
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
export default function PetProfile({ onBack, city, onSave, petId }) {
  const t = THEMES[city] || THEMES.Gurgaon;
  const [step, setStep] = useState(0);
  const [photos, setPhotos] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef(null);
  const [loading, setLoading] = useState(petId ? true : false);

  const [pet, setPet] = useState({
    name: '', breed: '', age: '', weight: '', gender: '',
    energy: '', strangers: '', leash: '',
    vaccinated: null, emergency: '', notes: '',
  });

  const update = (k, v) => setPet(prev => ({ ...prev, [k]: v }));

  useEffect(() => {
    if (petId) {
      const loadPet = async () => {
        const { data } = await supabase.from('pet_profiles').select('*').eq('id', petId).single();
        if (data) {
          setPet({
            name: data.name || '', breed: data.breed || '', age: data.age_years || '', weight: data.weight_kg || '', gender: data.gender || '',
            energy: data.energy_level || '', strangers: data.behavior_strangers || '', leash: data.behavior_leash || '',
            vaccinated: data.vaccinated || null, emergency: data.emergency_contact || '', notes: data.notes || '',
          });
          if (data.photo_url) setPhotos([data.photo_url]);
        }
        setLoading(false);
      };
      loadPet();
    }
  }, [petId]);

  const handlePhotoUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length || photos.length >= 4) return;
    setUploading(true);
    for (let file of files) {
      file = await compressImage(file);
      const ext = file.name.split('.').pop();
      const name = 'pet_' + Date.now() + '_' + Math.random().toString(36).slice(2) + '.' + ext;
      const { error } = await supabase.storage.from('pet-photos').upload(name, file);
      if (!error) {
        const { data } = supabase.storage.from('pet-photos').getPublicUrl(name);
        setPhotos(prev => [...prev, data.publicUrl]);
      }
    }
    setUploading(false);
  };

  const savePet = async () => {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const insertData = {
        user_id: user.id,
        name: pet.name,
        breed: pet.breed,
        age_years: parseInt(pet.age) || 0,
        weight_kg: parseFloat(pet.weight) || 0,
        gender: pet.gender,
        // pet_profiles has no is_vaccinated/emergency_contact columns (those
        // live on the separate, unused `pets` table) — folded into notes
        // alongside the other free-text fields so the data isn't lost.
        notes: [
          pet.vaccinated ? 'Vaccinated: ' + pet.vaccinated : '',
          pet.energy ? 'Energy: ' + pet.energy : '',
          pet.strangers ? 'With strangers: ' + pet.strangers : '',
          pet.leash ? 'On leash: ' + pet.leash : '',
          pet.emergency ? 'Emergency contact: ' + pet.emergency : '',
          pet.notes || '',
        ].filter(Boolean).join('. '),
        photo_url: photos[0] || null,
      };
      const { data, error } = petId
        ? await supabase.from('pet_profiles').update(insertData).eq('id', petId)
        : await supabase.from('pet_profiles').insert(insertData);
      if (error) { alert('Error saving pet: ' + error.message); setSaving(false); return; }
    } else {
      alert('Not logged in! Please log in first.');
    }
    setSaving(false);
    onSave && onSave();
  };

  const canNext0 = pet.name && pet.breed && pet.age && pet.gender;
  const canNext1 = pet.energy && pet.strangers && pet.leash;
  const canSave = pet.vaccinated !== null;

  const Btn = ({ label, selected, onClick }) => (
    <div onClick={onClick} style={{ flex:1, padding:'10px 6px', borderRadius:12, border:selected?'2px solid '+t.primary:'1.5px solid #E0E0E0', background:selected?t.light:'white', textAlign:'center', cursor:'pointer', fontSize:13, fontWeight:selected?600:400, color:selected?t.primary:'#555' }}>
      {label}
    </div>
  );

  return (
    <div style={{ maxWidth:390, margin:'0 auto', minHeight:'100vh', background:'#F8F8F8', fontFamily:'-apple-system,sans-serif', paddingBottom:100 }}>
      <div style={{ background:t.grad, padding:'48px 20px 20px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:16 }}>
          <div onClick={step === 0 ? onBack : () => setStep(s => s-1)} style={{ width:36, height:36, borderRadius:12, background:'rgba(255,255,255,0.2)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}>
            <ArrowLeft size={18} color="white" />
          </div>
          <div style={{ color:'white', fontSize:17, fontWeight:700 }}>
            {['About your pet','Personality','Safety'][step]}
          </div>
        </div>
        <div style={{ display:'flex', gap:6 }}>
          {[0,1,2].map(i => (
            <div key={i} style={{ flex:1, height:4, borderRadius:2, background:i<=step?'white':'rgba(255,255,255,0.3)' }} />
          ))}
        </div>
      </div>

      <div style={{ padding:'20px 16px' }}>

        {step === 0 && (
          <div>
            <div style={{ display:'flex', gap:10, flexWrap:'wrap', justifyContent:'center', marginBottom:8 }}>
              {photos.map((url, i) => (
                <div key={i} style={{ position:'relative', width:80, height:80 }}>
                  <img src={url} alt="Pet" style={{ width:80, height:80, borderRadius:18, objectFit:'cover' }} />
                  <div onClick={() => setPhotos(p => p.filter((_,j) => j!==i))}
                    style={{ position:'absolute', top:-6, right:-6, width:22, height:22, borderRadius:11, background:'#A32D2D', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}>
                    <X size={12} color="white" />
                  </div>
                </div>
              ))}
              {photos.length < 4 && (
                <div onClick={() => fileInputRef.current?.click()}
                  style={{ width:80, height:80, borderRadius:18, background:t.light, border:'2px dashed '+t.primary, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', cursor:'pointer', gap:4 }}>
                  {uploading ? <span style={{ fontSize:11, color:t.primary }}>...</span> : <><Camera size={20} color={t.primary} /><span style={{ fontSize:10, color:t.primary }}>{photos.length===0?'Add photo':'More'}</span></>}
                </div>
              )}
              <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handlePhotoUpload} style={{ display:'none' }} />
            </div>
            <div style={{ fontSize:11, color:'#AAA', textAlign:'center', marginBottom:20 }}>{photos.length}/4 photos</div>

            <div style={{ fontSize:13, fontWeight:600, color:'#1a1a1a', marginBottom:6 }}>Pet name *</div>
            <input value={pet.name} onChange={e => update('name', e.target.value)} placeholder="e.g. Bruno"
              style={{ width:'100%', padding:'12px 14px', borderRadius:12, border:'1.5px solid #E0E0E0', fontSize:15, outline:'none', marginBottom:14, boxSizing:'border-box' }} />

            <div style={{ fontSize:13, fontWeight:600, color:'#1a1a1a', marginBottom:6 }}>Breed *</div>
            <select value={pet.breed} onChange={e => update('breed', e.target.value)}
              style={{ width:'100%', padding:'12px 14px', borderRadius:12, border:'1.5px solid #E0E0E0', fontSize:15, outline:'none', marginBottom:14, background:'white', boxSizing:'border-box' }}>
              <option value="">Select breed</option>
              {BREEDS.map(b => <option key={b} value={b}>{b}</option>)}
            </select>

            <div style={{ display:'flex', gap:10, marginBottom:14 }}>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13, fontWeight:600, color:'#1a1a1a', marginBottom:6 }}>Age (years) *</div>
                <input value={pet.age} onChange={e => update('age', e.target.value)} placeholder="e.g. 3" type="number"
                  style={{ width:'100%', padding:'12px 14px', borderRadius:12, border:'1.5px solid #E0E0E0', fontSize:15, outline:'none', boxSizing:'border-box' }} />
              </div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13, fontWeight:600, color:'#1a1a1a', marginBottom:6 }}>Weight (kg)</div>
                <input value={pet.weight} onChange={e => update('weight', e.target.value)} placeholder="e.g. 12" type="number"
                  style={{ width:'100%', padding:'12px 14px', borderRadius:12, border:'1.5px solid #E0E0E0', fontSize:15, outline:'none', boxSizing:'border-box' }} />
              </div>
            </div>

            <div style={{ fontSize:13, fontWeight:600, color:'#1a1a1a', marginBottom:8 }}>Gender *</div>
            <div style={{ display:'flex', gap:8, marginBottom:24 }}>
              <Btn label="🐕 Male" selected={pet.gender==='male'} onClick={() => update('gender','male')} />
              <Btn label="🐕 Female" selected={pet.gender==='female'} onClick={() => update('gender','female')} />
            </div>
          </div>
        )}

        {step === 1 && (
          <div>
            <div style={{ background:t.light, borderRadius:14, padding:'10px 14px', marginBottom:20, fontSize:13, color:t.primary }}>
              This helps sitters understand your dog before the first meet. Tap to select.
            </div>

            <div style={{ fontSize:14, fontWeight:600, color:'#1a1a1a', marginBottom:10 }}>Energy level *</div>
            <div style={{ display:'flex', gap:8, marginBottom:20 }}>
              <Btn label="🐢 Lazy" selected={pet.energy==='lazy'} onClick={() => update('energy','lazy')} />
              <Btn label="🐕 Moderate" selected={pet.energy==='moderate'} onClick={() => update('energy','moderate')} />
              <Btn label="⚡ Hyper" selected={pet.energy==='hyper'} onClick={() => update('energy','hyper')} />
            </div>

            <div style={{ fontSize:14, fontWeight:600, color:'#1a1a1a', marginBottom:10 }}>With strangers *</div>
            <div style={{ display:'flex', gap:8, marginBottom:20 }}>
              <Btn label="😊 Friendly" selected={pet.strangers==='friendly'} onClick={() => update('strangers','friendly')} />
              <Btn label="😐 Shy" selected={pet.strangers==='shy'} onClick={() => update('strangers','shy')} />
              <Btn label="⚠️ Cautious" selected={pet.strangers==='cautious'} onClick={() => update('strangers','cautious')} />
            </div>

            <div style={{ fontSize:14, fontWeight:600, color:'#1a1a1a', marginBottom:10 }}>On the leash *</div>
            <div style={{ display:'flex', gap:8, marginBottom:24 }}>
              <Btn label="✅ Good" selected={pet.leash==='good'} onClick={() => update('leash','good')} />
              <Btn label="😤 Pulls" selected={pet.leash==='pulls'} onClick={() => update('leash','pulls')} />
              <Btn label="⚠️ Reactive" selected={pet.leash==='reactive'} onClick={() => update('leash','reactive')} />
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <div style={{ fontSize:14, fontWeight:600, color:'#1a1a1a', marginBottom:10 }}>Is your dog vaccinated? *</div>
            <div style={{ display:'flex', gap:8, marginBottom:20 }}>
              <Btn label="✅ Yes" selected={pet.vaccinated==='yes'} onClick={() => update('vaccinated','yes')} />
              <Btn label="❌ No" selected={pet.vaccinated==='no'} onClick={() => update('vaccinated','no')} />
            </div>

            <div style={{ fontSize:13, fontWeight:600, color:'#1a1a1a', marginBottom:6 }}>Emergency contact number</div>
            <input value={pet.emergency} onChange={e => update('emergency', e.target.value)} placeholder="+91 98765 43210" type="tel"
              style={{ width:'100%', padding:'12px 14px', borderRadius:12, border:'1.5px solid #E0E0E0', fontSize:15, outline:'none', marginBottom:14, boxSizing:'border-box' }} />

            <div style={{ fontSize:13, fontWeight:600, color:'#1a1a1a', marginBottom:6 }}>Anything the sitter must know?</div>
            <textarea value={pet.notes} onChange={e => update('notes', e.target.value)}
              placeholder="e.g. Scared of motorcycles, loves fetch, knows sit and stay..."
              rows={3} style={{ width:'100%', padding:'12px 14px', borderRadius:12, border:'1.5px solid #E0E0E0', fontSize:14, outline:'none', resize:'none', boxSizing:'border-box', fontFamily:'inherit', marginBottom:24 }} />
          </div>
        )}

        <div style={{ display:'flex', gap:10 }}>
          {step < 2 ? (
            <button onClick={() => setStep(s => s+1)} disabled={step===0?!canNext0:!canNext1}
              style={{ flex:1, padding:'14px 0', borderRadius:100, border:'none', background:(step===0?canNext0:canNext1)?t.primary:'#E0E0E0', color:'white', fontSize:15, fontWeight:700, cursor:(step===0?canNext0:canNext1)?'pointer':'not-allowed' }}>
              Continue <ChevronRight size={16} style={{ display:'inline', verticalAlign:'middle' }} />
            </button>
          ) : (
            <button onClick={savePet} disabled={!canSave || saving}
              style={{ flex:1, padding:'14px 0', borderRadius:100, border:'none', background:canSave?t.primary:'#E0E0E0', color:'white', fontSize:15, fontWeight:700, cursor:canSave?'pointer':'not-allowed' }}>
              {saving ? 'Saving...' : 'Save pet profile 🐾'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}