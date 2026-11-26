import React, { useState, useEffect } from 'react';
import { supabase } from './supabase';
import { useSupportContact, openWhatsAppSupport } from './supportContact';
import { useLanguage } from './i18n';
import { color, font, radius, ui, navPadding } from './theme';
import Icon from './ui/Icon';

export default function UserProfile({ onBack, city, onAddPet, onEditPet, onSignOut, onNav }) {
  const { t: tr } = useLanguage();
  const { whatsapp } = useSupportContact();
  const [user, setUser] = useState(null);
  const [pets, setPets] = useState([]);
  const [bookingCount, setBookingCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      if (user) {
        const { data: petsData } = await supabase
          .from('pet_profiles').select('*').eq('user_id', user.id);
        setPets(petsData || []);
        const { count } = await supabase
          .from('bookings').select('*', { count: 'exact', head: true })
          .eq('pet_parent_id', user.id);
        setBookingCount(count || 0);
      }
      setLoading(false);
    };
    load();
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    if (onSignOut) onSignOut();
  };

  const header = (
    <div style={ui.header}>
      <button type="button" aria-label={tr('common_back')} onClick={onBack} style={ui.backButton}>
        <Icon name="arrowLeft" size={20} />
      </button>
      <h1 style={ui.headerTitle}>{tr('profile_headerTitle')}</h1>
    </div>
  );

  if (loading) return (
    <div role="status" aria-label={tr('profile_loadingProfile')} style={{ ...ui.page, paddingBottom:navPadding }}>
      {header}
      <div style={{ padding:16 }}>
        {[120, 72, 72, 180].map((h, i) => <div key={i} style={{ height:h, borderRadius:radius.md, background:color.tile, marginBottom:12 }} />)}
      </div>
    </div>
  );

  const initials = user?.email ? user.email[0].toUpperCase() : 'U';
  const displayName = user?.user_metadata?.name || user?.email?.split('@')[0] || tr('profile_defaultDisplayName');
  const listCard = { background:color.surface, borderRadius:radius.lg, border:`1px solid ${color.line}`, overflow:'hidden', marginBottom:20 };
  const rowBtn = (i) => ({ width:'100%', minHeight:64, border:'none', borderTop:i ? `1px solid ${color.line}` : 'none', fontFamily:font.family, textAlign:'left', background:'none', padding:'12px 16px', display:'flex', alignItems:'center', gap:12, cursor:'pointer' });
  const tile = (tone) => ({ ...ui.iconTile, width:40, height:40, ...(tone ? { background:color[tone + 'Soft'], color:color[tone] } : null) });
  const rowLabel = { fontSize:font.md, fontWeight:600, color:color.ink };
  const rowSub = { fontSize:font.sm, color:color.muted, marginTop:1 };

  return (
    <div style={{ ...ui.page, paddingBottom:navPadding }}>
      {header}

      <div style={{ padding:16 }}>
        <div style={{ ...ui.card, marginBottom:20 }}>
          <div style={{ display:'flex', alignItems:'center', gap:14 }}>
            <div style={{ width:56, height:56, borderRadius:radius.pill, background:color.navy, color:color.surface, display:'flex', alignItems:'center', justifyContent:'center', fontSize:font.xl, fontWeight:700, flexShrink:0 }}>
              {initials}
            </div>
            <div style={{ minWidth:0 }}>
              <div style={{ fontSize:font.lg, fontWeight:700, color:color.ink, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{displayName}</div>
              <div style={{ fontSize:13, color:color.muted, marginTop:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{user?.email}</div>
            </div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', marginTop:16, paddingTop:14, borderTop:`1px solid ${color.line}` }}>
            {[
              { val: pets.length, label: tr('profile_statsPets') },
              { val: bookingCount, label: tr('profile_statsBookings') },
            ].map((s, i) => (
              <div key={i} style={{ textAlign:'center', borderLeft:i ? `1px solid ${color.line}` : 'none' }}>
                <div style={{ fontSize:font.xl, fontWeight:700, color:color.ink, fontVariantNumeric:'tabular-nums' }}>{s.val}</div>
                <div style={{ fontSize:font.sm, color:color.muted, marginTop:2 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        <h2 style={ui.sectionTitle}>{tr('nav_myPets')}</h2>

        {pets.length === 0 ? (
          <div style={{ ...ui.card, textAlign:'center', padding:'28px 20px', marginBottom:20 }}>
            <div style={{ ...ui.iconTile, margin:'0 auto 12px' }}><Icon name="paw" /></div>
            <div style={{ fontSize:15, fontWeight:600, color:color.ink, marginBottom:4 }}>{tr('profile_noPetsTitle')}</div>
            <div style={{ fontSize:13, color:color.muted, marginBottom:16 }}>{tr('profile_noPetsSubtitle')}</div>
            <button onClick={onAddPet} style={ui.primaryButton}>
              {tr('profile_addPetButton')}
            </button>
          </div>
        ) : (
          <div style={{ marginBottom:20 }}>
            <div style={{ ...listCard, marginBottom:10 }}>
              {pets.map((pet, i) => (
                <div key={pet.id || i} style={{ padding:'12px 16px', borderTop:i ? `1px solid ${color.line}` : 'none', display:'flex', alignItems:'center', gap:12 }}>
                  {pet.photo_url ? (
                    <img src={pet.photo_url} alt={pet.name}
                      style={{ width:52, height:52, borderRadius:radius.md, objectFit:'cover', flexShrink:0 }} />
                  ) : (
                    <div style={{ ...ui.iconTile, width:52, height:52 }}><Icon name="paw" size={24} /></div>
                  )}
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:15, fontWeight:600, color:color.ink }}>{pet.name}</div>
                    <div style={{ fontSize:font.sm, color:color.muted, marginTop:2 }}>
                      {[pet.breed, pet.age_years ? pet.age_years + ' ' + tr('profile_yearsUnit') : null, pet.weight_kg ? pet.weight_kg + ' ' + tr('profile_weightUnit') : null].filter(Boolean).join(' · ')}
                    </div>
                    {(pet.vaccinated === 'yes' || pet.gender) && (
                      <div style={{ display:'flex', gap:6, marginTop:6, flexWrap:'wrap' }}>
                        {pet.vaccinated === 'yes' && <span style={ui.badge('success')}>{tr('profile_vaccinatedBadge')}</span>}
                        {pet.gender && <span style={{ ...ui.badge(), background:color.navySoft, color:color.navy }}>{pet.gender === 'male' ? tr('profile_genderMale') : pet.gender === 'female' ? tr('profile_genderFemale') : pet.gender}</span>}
                      </div>
                    )}
                  </div>
                  <button type="button" aria-label={tr('profile_editPetAria', { name: pet.name })} onClick={() => onEditPet && onEditPet(pet)}
                    style={{ width:44, height:44, borderRadius:radius.md, border:`1px solid ${color.line}`, padding:0, background:color.surface, color:color.navy, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', flexShrink:0 }}>
                    <Icon name="edit" size={18} />
                  </button>
                </div>
              ))}
            </div>
            <button onClick={onAddPet} style={{ ...ui.secondaryButton, width:'100%', color:color.navy }}>
              <Icon name="plus" size={18} />{tr('profile_addAnotherPet')}
            </button>
          </div>
        )}

        <h2 style={ui.sectionTitle}>{tr('profile_accountSection')}</h2>

        <div style={listCard}>
          {[
            { icon:'heart', label:tr('profile_favouriteSittersLabel'), sub:tr('profile_favouriteSittersSub'), action:'favourites' },
            { icon:'star', label:tr('profile_myReviewsLabel'), sub:tr('profile_myReviewsSub'), action:'reviews' },
            { icon:'bell', label:tr('profile_notificationsLabel'), sub:tr('profile_notificationsSub'), action:'notifications' },
          ].map((item, i) => (
            <button type="button" key={i} onClick={() => alert(item.label + tr('profile_comingSoonSuffix'))} style={rowBtn(i)}>
              <div style={tile()}><Icon name={item.icon} size={20} /></div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={rowLabel}>{item.label}</div>
                <div style={rowSub}>{item.sub}</div>
              </div>
              <Icon name="chevronRight" size={18} color={color.faint} />
            </button>
          ))}
          {whatsapp && (
            <button type="button" onClick={() => openWhatsAppSupport(whatsapp, tr('profile_whatsappMessage'))} style={rowBtn(1)}>
              <div style={tile('success')}><Icon name="message" size={20} /></div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={rowLabel}>{tr('profile_whatsappChatTitle')}</div>
                <div style={rowSub}>{tr('profile_whatsappChatSub')}</div>
              </div>
              <Icon name="chevronRight" size={18} color={color.faint} />
            </button>
          )}
          <button type="button" onClick={handleSignOut} style={rowBtn(1)}>
            <div style={tile('danger')}><Icon name="logout" size={20} /></div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ ...rowLabel, color:color.danger }}>{tr('profile_signOut')}</div>
              <div style={{ ...rowSub, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{user?.email}</div>
            </div>
          </button>
        </div>

        <div style={{ textAlign:'center', padding:'4px 0 8px', fontSize:font.sm, color:color.faint, lineHeight:1.6 }}>
          {tr('profile_footerTagline')}
        </div>
      </div>
    </div>
  );
}
