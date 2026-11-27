import React, { useState, useRef, useEffect } from 'react';
import { supabase } from './supabase';
import { choosePhoto } from './photoPicker';
import { useLanguage } from './i18n';
import { color, font, radius, ui } from './theme';
import Icon from './ui/Icon';
import { writeWithFallback } from './schemaFallback';

// Health columns from migration 038; dropped from the save until it runs.
const PET_038_COLUMNS = ['size', 'is_puppy', 'vaccination_cert_url', 'vaccinated_until', 'vet_name', 'vet_phone', 'feeding_notes', 'medication_notes', 'emergency_vet_consent'];
const SIZES = [['small', 'pet_sizeSmall'], ['medium', 'pet_sizeMedium'], ['large', 'pet_sizeLarge'], ['giant', 'pet_sizeGiant']];

const BREED_LABEL_KEYS = { 'Indie/Mixed': 'pet_breedIndie', 'Other': 'pet_breedOther' };

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
  const { t: tr } = useLanguage();
  const [step, setStep] = useState(0);
  const [photos, setPhotos] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef(null);
  const certInputRef = useRef(null);
  const [certUploading, setCertUploading] = useState(false);

  const [pet, setPet] = useState({
    name: '', breed: '', age: '', weight: '', gender: '',
    energy: '', strangers: '', leash: '',
    vaccinated: null, emergency: '', notes: '',
    size: '', puppy: false, certUrl: '', vaccinatedUntil: '', vetName: '', vetPhone: '', feeding: '', medication: '', vetConsent: false,
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
            size: data.size || '', puppy: !!data.is_puppy, certUrl: data.vaccination_cert_url || '', vaccinatedUntil: data.vaccinated_until ? String(data.vaccinated_until).slice(0, 10) : '',
            vetName: data.vet_name || '', vetPhone: data.vet_phone || '', feeding: data.feeding_notes || '', medication: data.medication_notes || '', vetConsent: !!data.emergency_vet_consent,
          });
          if (data.photo_url) setPhotos([data.photo_url]);
        }
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

  const handleCertUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCertUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name || '');
      const upload = isPdf ? file : await compressImage(file);
      const path = (user?.id || 'anon') + '/vaccination/' + Date.now() + (isPdf ? '.pdf' : '.jpg');
      const { error } = await supabase.storage.from('pet-photos').upload(path, upload, { contentType: isPdf ? 'application/pdf' : 'image/jpeg' });
      if (error) throw error;
      const { data } = supabase.storage.from('pet-photos').getPublicUrl(path);
      update('certUrl', data.publicUrl);
    } catch (err) {
      alert(tr('pet_vaccineCertFailed'));
    }
    setCertUploading(false);
    if (certInputRef.current) certInputRef.current.value = '';
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
        vaccinated: pet.vaccinated || null,
        energy_level: pet.energy || null,
        behavior_strangers: pet.strangers || null,
        behavior_leash: pet.leash || null,
        emergency_contact: pet.emergency || null,
        notes: pet.notes || '',
        photo_url: photos[0] || null,
        size: pet.size || null,
        is_puppy: !!pet.puppy,
        vaccination_cert_url: pet.certUrl || null,
        vaccinated_until: pet.vaccinatedUntil || null,
        vet_name: pet.vetName.trim() || null,
        vet_phone: pet.vetPhone.trim() || null,
        feeding_notes: pet.feeding.trim() || null,
        medication_notes: pet.medication.trim() || null,
        emergency_vet_consent: !!pet.vetConsent,
      };
      const write = (row) => (petId ? supabase.from('pet_profiles').update(row).eq('id', petId) : supabase.from('pet_profiles').insert(row));
      const { error } = await writeWithFallback(write, insertData, PET_038_COLUMNS);
      if (error) { alert(tr('pet_errorSaving') + error.message); setSaving(false); return; }
    } else {
      alert(tr('pet_notLoggedIn'));
    }
    setSaving(false);
    onSave && onSave();
  };

  const canNext0 = pet.name && pet.breed && pet.age && pet.gender;
  const canNext1 = pet.energy && pet.strangers && pet.leash;
  const canSave = pet.vaccinated !== null;

  const Btn = ({ label, selected, onClick }) => (
    <button type="button" onClick={onClick} aria-pressed={selected} style={{ flex:1, minWidth:0, padding:'10px 6px', borderRadius:radius.md, border:`1.5px solid ${selected ? color.navy : color.line}`, background:selected ? color.navySoft : color.surface, textAlign:'center', cursor:'pointer', fontFamily:'inherit', fontSize:13, fontWeight:600, color:selected ? color.navy : color.text, minHeight:44 }}>
      {label}
    </button>
  );
  const fieldLabel = { ...ui.label, fontSize:13 };
  const questionLabel = { fontSize:font.md, fontWeight:600, color:color.ink, marginBottom:10 };
  const nextEnabled = step === 0 ? canNext0 : canNext1;

  return (
    <div style={{ ...ui.page, paddingBottom:40 }}>
      <div style={{ ...ui.header, flexWrap:'wrap', rowGap:12 }}>
        <button type="button" aria-label={tr('common_back')} onClick={step === 0 ? onBack : () => setStep(s => s-1)} style={ui.backButton}>
          <Icon name="arrowLeft" size={20} />
        </button>
        <h1 style={{ ...ui.headerTitle, flex:1 }}>
          {[tr('pet_stepAbout'), tr('pet_stepPersonality'), tr('pet_stepSafety')][step]}
        </h1>
        <div aria-hidden="true" style={{ display:'flex', gap:6, width:'100%' }}>
          {[0,1,2].map(i => (
            <div key={i} style={{ flex:1, height:4, borderRadius:2, background:i<=step ? color.navy : color.line }} />
          ))}
        </div>
      </div>

      <div style={{ padding:'20px 16px' }}>

        {step === 0 && (
          <div>
            <div style={{ display:'flex', gap:10, flexWrap:'wrap', justifyContent:'center', marginBottom:8 }}>
              {photos.map((url, i) => (
                <div key={i} style={{ position:'relative', width:80, height:80 }}>
                  <img src={url} alt={tr('pet_photoAlt')} style={{ width:80, height:80, borderRadius:radius.lg, objectFit:'cover', border:`1px solid ${color.line}` }} />
                  <button type="button" aria-label={tr('pet_removePhotoAria')} onClick={() => setPhotos(p => p.filter((_,j) => j!==i))}
                    style={{ position:'absolute', top:-8, right:-8, width:26, height:26, borderRadius:radius.pill, border:`2px solid ${color.surface}`, padding:0, background:color.ink, color:color.surface, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}>
                    <Icon name="plus" size={14} strokeWidth={2.25} style={{ transform:'rotate(45deg)' }} />
                  </button>
                </div>
              ))}
              {photos.length < 4 && (
                <button type="button" onClick={() => choosePhoto(fileInputRef, handlePhotoUpload)}
                  style={{ width:80, height:80, borderRadius:radius.lg, padding:0, fontFamily:'inherit', background:color.surface, border:`1.5px dashed ${color.faint}`, color:color.navy, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', cursor:'pointer', gap:4 }}>
                  {uploading ? <span style={{ fontSize:font.xs, color:color.muted }}>...</span> : <><Icon name="camera" size={22} /><span style={{ fontSize:font.xs, fontWeight:600 }}>{photos.length===0?tr('pet_addPhotoLabel'):tr('pet_morePhotoLabel')}</span></>}
                </button>
              )}
              <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handlePhotoUpload} style={{ display:'none' }} />
            </div>
            <div style={{ fontSize:font.xs, color:color.muted, textAlign:'center', marginBottom:20 }}>{tr('pet_photosCount', { n: photos.length })}</div>

            <div style={{ ...ui.card, marginBottom:16 }}>
              <label htmlFor="pet-name" style={fieldLabel}>{tr('pet_nameLabel')} *</label>
              <input id="pet-name" value={pet.name} onChange={e => update('name', e.target.value)} placeholder={tr('pet_namePlaceholder')}
                style={{ ...ui.input, marginBottom:14 }} />

              <label htmlFor="pet-breed" style={fieldLabel}>{tr('pet_breedLabel')} *</label>
              <select id="pet-breed" value={pet.breed} onChange={e => update('breed', e.target.value)}
                style={{ ...ui.input, marginBottom:14 }}>
                <option value="">{tr('pet_selectBreed')}</option>
                {BREEDS.map(b => <option key={b} value={b}>{BREED_LABEL_KEYS[b] ? tr(BREED_LABEL_KEYS[b]) : b}</option>)}
              </select>

              <div style={{ display:'flex', gap:10, marginBottom:14 }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <label htmlFor="pet-age" style={fieldLabel}>{tr('pet_ageLabel')} *</label>
                  <input id="pet-age" value={pet.age} onChange={e => update('age', e.target.value)} placeholder={tr('pet_agePlaceholder')} type="number"
                    style={ui.input} />
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <label htmlFor="pet-weight" style={fieldLabel}>{tr('pet_weightLabel')}</label>
                  <input id="pet-weight" value={pet.weight} onChange={e => update('weight', e.target.value)} placeholder={tr('pet_weightPlaceholder')} type="number"
                    style={ui.input} />
                </div>
              </div>

              <div style={fieldLabel}>{tr('pet_genderLabel')} *</div>
              <div style={{ display:'flex', gap:8, marginBottom:14 }}>
                <Btn label={tr('pet_genderMale')} selected={pet.gender==='male'} onClick={() => update('gender','male')} />
                <Btn label={tr('pet_genderFemale')} selected={pet.gender==='female'} onClick={() => update('gender','female')} />
              </div>

              <div style={fieldLabel}>{tr('pet_sizeLabel')}</div>
              <div role="group" aria-label={tr('pet_sizeLabel')} style={{ display:'flex', gap:8, marginBottom:14 }}>
                {SIZES.map(([id, key]) => <Btn key={id} label={tr(key)} selected={pet.size===id} onClick={() => update('size', pet.size===id ? '' : id)} />)}
              </div>

              <label style={{ display:'flex', alignItems:'center', gap:10, minHeight:44, cursor:'pointer' }}>
                <input type="checkbox" checked={pet.puppy} onChange={e => update('puppy', e.target.checked)}
                  style={{ width:20, height:20, accentColor:color.navy, cursor:'pointer', flexShrink:0 }} />
                <span style={{ fontSize:font.md, fontWeight:600, color:color.ink }}>{tr('pet_puppyLabel')}</span>
              </label>
            </div>
          </div>
        )}

        {step === 1 && (
          <div>
            <div style={{ background:color.infoSoft, color:color.info, borderRadius:radius.md, padding:'10px 12px', marginBottom:16, fontSize:13, display:'flex', gap:8, alignItems:'flex-start', lineHeight:1.5 }}>
              <Icon name="info" size={16} style={{ marginTop:1 }} /><div>{tr('pet_personalityIntro')}</div>
            </div>

            <div style={{ ...ui.card, marginBottom:16 }}>
              <div style={questionLabel}>{tr('pet_energyLabel')} *</div>
              <div style={{ display:'flex', gap:8, marginBottom:20 }}>
                <Btn label={tr('pet_energyLazy')} selected={pet.energy==='lazy'} onClick={() => update('energy','lazy')} />
                <Btn label={tr('pet_energyModerate')} selected={pet.energy==='moderate'} onClick={() => update('energy','moderate')} />
                <Btn label={tr('pet_energyHyper')} selected={pet.energy==='hyper'} onClick={() => update('energy','hyper')} />
              </div>

              <div style={questionLabel}>{tr('pet_strangersLabel')} *</div>
              <div style={{ display:'flex', gap:8, marginBottom:20 }}>
                <Btn label={tr('pet_strangersFriendly')} selected={pet.strangers==='friendly'} onClick={() => update('strangers','friendly')} />
                <Btn label={tr('pet_strangersShy')} selected={pet.strangers==='shy'} onClick={() => update('strangers','shy')} />
                <Btn label={tr('pet_strangersCautious')} selected={pet.strangers==='cautious'} onClick={() => update('strangers','cautious')} />
              </div>

              <div style={questionLabel}>{tr('pet_leashLabel')} *</div>
              <div style={{ display:'flex', gap:8 }}>
                <Btn label={tr('pet_leashGood')} selected={pet.leash==='good'} onClick={() => update('leash','good')} />
                <Btn label={tr('pet_leashPulls')} selected={pet.leash==='pulls'} onClick={() => update('leash','pulls')} />
                <Btn label={tr('pet_leashReactive')} selected={pet.leash==='reactive'} onClick={() => update('leash','reactive')} />
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div style={{ ...ui.card, marginBottom:16 }}>
            <div style={questionLabel}>{tr('pet_vaccinatedLabel')} *</div>
            <div style={{ display:'flex', gap:8, marginBottom:20 }}>
              <Btn label={tr('pet_vaccinatedYes')} selected={pet.vaccinated==='yes'} onClick={() => update('vaccinated','yes')} />
              <Btn label={tr('pet_vaccinatedNo')} selected={pet.vaccinated==='no'} onClick={() => update('vaccinated','no')} />
            </div>

            <label htmlFor="pet-emergency" style={fieldLabel}>{tr('pet_emergencyLabel')}</label>
            <input id="pet-emergency" value={pet.emergency} onChange={e => update('emergency', e.target.value)} placeholder={tr('pet_emergencyPlaceholder')} type="tel"
              style={{ ...ui.input, marginBottom:14 }} />

            <label htmlFor="pet-notes" style={fieldLabel}>{tr('pet_notesLabel')}</label>
            <textarea id="pet-notes" value={pet.notes} onChange={e => update('notes', e.target.value)}
              placeholder={tr('pet_notesPlaceholder')}
              rows={3} style={{ ...ui.input, fontSize:14, resize:'none', lineHeight:1.5 }} />
          </div>
        )}

        {step === 2 && (
          <div style={{ ...ui.card, marginBottom:16 }}>
            <h2 style={{ ...ui.sectionTitle, display:'flex', alignItems:'center', gap:8 }}><Icon name="stethoscope" size={18} color={color.navy} />{tr('pet_healthHeading')}</h2>

            <div style={fieldLabel}>{tr('pet_vaccineCertLabel')}</div>
            <div style={{ fontSize:font.sm, color:color.muted, marginBottom:8 }}>{tr('pet_vaccineCertHint')}</div>
            <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap', marginBottom:12 }}>
              {pet.certUrl && (
                <a href={pet.certUrl} target="_blank" rel="noopener noreferrer" style={{ ...ui.secondaryButton, minHeight:44, textDecoration:'none', color:color.navy, fontSize:14 }}>
                  <Icon name="fileText" size={18} />{tr('pet_vaccineCertView')}
                </a>
              )}
              <button type="button" onClick={() => choosePhoto(certInputRef, handleCertUpload)} disabled={certUploading}
                style={{ ...ui.secondaryButton, minHeight:44, fontSize:14, borderStyle:pet.certUrl ? 'solid' : 'dashed', color:color.navy }}>
                <Icon name={pet.certUrl ? 'refresh' : 'plus'} size={18} />
                {certUploading ? tr('pet_vaccineCertUploading') : pet.certUrl ? tr('pet_vaccineCertReplace') : tr('pet_vaccineCertUpload')}
              </button>
              <input ref={certInputRef} type="file" accept="image/*,application/pdf" onChange={handleCertUpload} style={{ display:'none' }} data-testid="pet-cert-input" />
            </div>
            <label htmlFor="pet-vaccinated-until" style={fieldLabel}>{tr('pet_vaccinatedUntilLabel')}</label>
            <input id="pet-vaccinated-until" type="date" value={pet.vaccinatedUntil} onChange={e => update('vaccinatedUntil', e.target.value)}
              style={{ ...ui.input, marginBottom:14 }} />

            <div style={{ display:'flex', gap:10, marginBottom:14 }}>
              <div style={{ flex:1, minWidth:0 }}>
                <label htmlFor="pet-vet-name" style={fieldLabel}>{tr('pet_vetNameLabel')}</label>
                <input id="pet-vet-name" value={pet.vetName} onChange={e => update('vetName', e.target.value)} placeholder={tr('pet_vetNamePlaceholder')} style={ui.input} />
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <label htmlFor="pet-vet-phone" style={fieldLabel}>{tr('pet_vetPhoneLabel')}</label>
                <input id="pet-vet-phone" value={pet.vetPhone} onChange={e => update('vetPhone', e.target.value)} type="tel" inputMode="tel" style={ui.input} />
              </div>
            </div>

            <label htmlFor="pet-feeding" style={fieldLabel}>{tr('pet_feedingLabel')}</label>
            <textarea id="pet-feeding" value={pet.feeding} onChange={e => update('feeding', e.target.value)} placeholder={tr('pet_feedingPlaceholder')}
              rows={2} style={{ ...ui.input, fontSize:14, resize:'none', lineHeight:1.5, marginBottom:14 }} />

            <label htmlFor="pet-medication" style={fieldLabel}>{tr('pet_medicationLabel')}</label>
            <textarea id="pet-medication" value={pet.medication} onChange={e => update('medication', e.target.value)} placeholder={tr('pet_medicationPlaceholder')}
              rows={2} style={{ ...ui.input, fontSize:14, resize:'none', lineHeight:1.5, marginBottom:14 }} />

            <label style={{ display:'flex', alignItems:'flex-start', gap:10, minHeight:44, cursor:'pointer' }}>
              <input type="checkbox" checked={pet.vetConsent} onChange={e => update('vetConsent', e.target.checked)}
                style={{ width:20, height:20, marginTop:1, accentColor:color.navy, cursor:'pointer', flexShrink:0 }} />
              <span>
                <span style={{ display:'block', fontSize:font.md, fontWeight:600, color:color.ink }}>{tr('pet_vetConsentLabel')}</span>
                <span style={{ display:'block', fontSize:font.sm, color:color.muted, marginTop:2 }}>{tr('pet_vetConsentHint')}</span>
              </span>
            </label>
          </div>
        )}

        <div style={{ display:'flex', gap:10 }}>
          {step < 2 ? (
            <button onClick={() => setStep(s => s+1)} disabled={!nextEnabled}
              style={{ ...ui.primaryButton, flex:1, opacity:nextEnabled ? 1 : 0.45, cursor:nextEnabled ? 'pointer' : 'not-allowed' }}>
              {tr('pet_continueButton')} <Icon name="chevronRight" size={18} />
            </button>
          ) : (
            <button onClick={savePet} disabled={!canSave || saving}
              style={{ ...ui.primaryButton, flex:1, opacity:canSave ? 1 : 0.45, cursor:canSave ? 'pointer' : 'not-allowed' }}>
              {saving ? tr('common_saving') : tr('pet_saveButton')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
