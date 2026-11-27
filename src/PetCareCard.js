import React, { useEffect, useState } from 'react';
import { supabase } from './supabase';
import { useLanguage } from './i18n';
import { color, font, radius, ui } from './theme';
import Icon from './ui/Icon';

const todayISO = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };

// What a sitter needs to look after the dogs on a booking: health, food,
// medicines, the vet and whether they may take the dog there. Pass the pet
// rows (`pets`) or their ids (`petIds`, e.g. booking.pet_ids || [booking.pet_id]).
export default function PetCareCard({ pets: petsProp, petIds }) {
  const { t: tr, lang } = useLanguage();
  const [loaded, setLoaded] = useState(petsProp || null);
  const key = (petIds || []).filter(Boolean).join(',');

  useEffect(() => {
    if (petsProp) { setLoaded(petsProp); return; }
    const ids = key ? key.split(',') : [];
    if (!ids.length) { setLoaded([]); return; }
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase.from('pet_profiles').select('*').in('id', ids);
        if (!cancelled) setLoaded(Array.isArray(data) ? ids.map(id => data.find(p => p.id === id)).filter(Boolean) : []);
      } catch (e) {
        if (!cancelled) setLoaded([]);
      }
    })();
    return () => { cancelled = true; };
  }, [petsProp, key]);

  const fmt = (iso) => new Date(String(iso).slice(0, 10) + 'T00:00:00').toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  const row = (icon, label, value) => (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '8px 0', borderTop: `1px solid ${color.line}` }}>
      <Icon name={icon} size={16} color={color.muted} style={{ marginTop: 2 }} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: font.xs, color: color.muted, fontWeight: 600 }}>{label}</div>
        <div style={{ fontSize: font.md, color: color.ink, lineHeight: 1.5, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{value}</div>
      </div>
    </div>
  );

  if (loaded === null) return <div role="status" style={{ ...ui.card, color: color.muted, fontSize: font.sm }}>{tr('petCare_loading')}</div>;
  if (!loaded.length) return <div style={{ ...ui.card, color: color.muted, fontSize: font.sm }}>{tr('petCare_none')}</div>;

  return (
    <section aria-label={tr('petCare_title')} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {loaded.map(p => {
        const until = p.vaccinated_until ? String(p.vaccinated_until).slice(0, 10) : null;
        const vaccine = !p.vaccination_cert_url
          ? { tone: 'warning', text: tr('petCare_vaccineNoCert') }
          : until && until >= todayISO() ? { tone: 'success', text: tr('petCare_vaccineValid', { date: fmt(until) }) }
          : { tone: 'danger', text: until ? tr('petCare_vaccineExpired', { date: fmt(until) }) : tr('petCare_vaccineNoCert') };
        const behaviour = [p.energy_level, p.behavior_strangers, p.behavior_leash].filter(Boolean).join(' · ');
        return (
          <div key={p.id} style={ui.card}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 10 }}>
              <div style={{ ...ui.iconTile, overflow: 'hidden' }}>
                {p.photo_url ? <img src={p.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Icon name="paw" size={24} />}
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: font.lg, fontWeight: 700, color: color.ink }}>{p.name}</div>
                <div style={{ fontSize: font.sm, color: color.muted }}>
                  {[p.breed, p.age_years ? p.age_years + 'y' : null, p.size ? tr('petCare_size_' + p.size) : null].filter(Boolean).join(' · ')}
                </div>
              </div>
              {p.is_puppy && <span style={ui.badge('info')}>{tr('petCare_puppy')}</span>}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
              <span style={{ ...ui.badge(vaccine.tone), fontSize: font.sm, padding: '4px 10px' }}><Icon name="shield" size={13} />{vaccine.text}</span>
              {p.vaccination_cert_url && (
                <a href={p.vaccination_cert_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: font.sm, fontWeight: 600, color: color.navy, minHeight: 32, display: 'inline-flex', alignItems: 'center' }}>{tr('petCare_viewCert')}</a>
              )}
            </div>
            {p.feeding_notes && row('droplet', tr('petCare_feeding'), p.feeding_notes)}
            {p.medication_notes && row('pill', tr('petCare_meds'), p.medication_notes)}
            {(p.vet_name || p.vet_phone) && (
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '8px 0', borderTop: `1px solid ${color.line}` }}>
                <Icon name="stethoscope" size={16} color={color.muted} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: font.xs, color: color.muted, fontWeight: 600 }}>{tr('petCare_vet')}</div>
                  <div style={{ fontSize: font.md, color: color.ink }}>{p.vet_name || p.vet_phone}</div>
                </div>
                {p.vet_phone && (
                  <a href={'tel:' + p.vet_phone} aria-label={tr('petCare_callVet', { name: p.vet_name || '' })}
                    style={{ width: 44, height: 44, borderRadius: radius.md, background: color.tile, color: color.navy, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon name="phone" size={18} />
                  </a>
                )}
              </div>
            )}
            <div style={{ marginTop: 6, padding: '10px 12px', borderRadius: radius.md, background: p.emergency_vet_consent ? color.successSoft : color.warningSoft, color: p.emergency_vet_consent ? color.success : color.warning, fontSize: font.sm, lineHeight: 1.5 }}>
              {tr(p.emergency_vet_consent ? 'petCare_vetConsentYes' : 'petCare_vetConsentNo')}
            </div>
            {behaviour && row('paw', tr('petCare_behaviour'), behaviour)}
            {p.emergency_contact && row('phone', tr('petCare_emergency'), p.emergency_contact)}
            {p.notes && row('fileText', tr('petCare_notes'), p.notes)}
          </div>
        );
      })}
    </section>
  );
}
