import React, { useState, useEffect } from 'react';
import { ArrowLeft, ChevronRight, LogOut, Heart, Star, Settings, Edit2 } from 'lucide-react';
import { supabase } from './supabase';
import { useSupportContact, openWhatsAppSupport } from './supportContact';
import { useLanguage } from './i18n';

const THEMES = {
  Gurgaon: { primary: '#FF6B35', light: '#FFF0EB', grad: 'linear-gradient(135deg,#FF6B35,#FF8C5A)' },
  Pune: { primary: '#6C5CE7', light: '#F0EEFF', grad: 'linear-gradient(135deg,#6C5CE7,#8E7CF3)' },
};

export default function UserProfile({ onBack, city, onAddPet, onEditPet, onSignOut, onNav }) {
  const t = THEMES[city] || THEMES.Gurgaon;
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

  if (loading) return (
    <div style={{ maxWidth:390, margin:'0 auto', minHeight:'100vh', background:'#F8F8F8', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'sans-serif' }}>
      <div style={{ textAlign:'center' }}>
        <div style={{ fontSize:32, marginBottom:12 }}>🐾</div>
        <div style={{ fontSize:14, color:'#888' }}>{tr('profile_loadingProfile')}</div>
      </div>
    </div>
  );

  const initials = user?.email ? user.email[0].toUpperCase() : 'U';
  const displayName = user?.user_metadata?.name || user?.email?.split('@')[0] || tr('profile_defaultDisplayName');

  return (
    <div style={{ maxWidth:390, margin:'0 auto', minHeight:'100vh', background:'#F8F8F8', fontFamily:'-apple-system,sans-serif', paddingBottom:100 }}>
      
      {/* Header */}
      <div style={{ background:t.grad, padding:'48px 20px 30px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:20 }}>
          <div onClick={onBack} style={{ width:36, height:36, borderRadius:12, background:'rgba(255,255,255,0.2)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}>
            <ArrowLeft size={18} color="white" />
          </div>
          <div style={{ color:'white', fontSize:17, fontWeight:700 }}>{tr('profile_headerTitle')}</div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:16 }}>
          <div style={{ width:72, height:72, borderRadius:22, background:'rgba(255,255,255,0.25)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:28, fontWeight:700, color:'white', flexShrink:0 }}>
            {initials}
          </div>
          <div>
            <div style={{ color:'white', fontSize:18, fontWeight:700, marginBottom:4 }}>{displayName}</div>
            <div style={{ color:'rgba(255,255,255,0.75)', fontSize:13 }}>{user?.email}</div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, padding:'16px 16px 0' }}>
        {[
          { val: pets.length, label: tr('profile_statsPets') },
          { val: bookingCount, label: tr('profile_statsBookings') },
        ].map((s, i) => (
          <div key={i} style={{ background:'white', borderRadius:16, padding:'16px', textAlign:'center', boxShadow:'0 2px 12px rgba(0,0,0,0.06)' }}>
            <div style={{ fontSize:28, fontWeight:700, color:t.primary }}>{s.val}</div>
            <div style={{ fontSize:13, color:'#888', marginTop:4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ padding:'16px 16px 0' }}>
        
        {/* My Pets */}
        <div style={{ fontSize:12, fontWeight:600, color:'#AAA', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:10 }}>{tr('nav_myPets')}</div>

        {pets.length === 0 ? (
          <div style={{ background:'white', borderRadius:16, padding:'24px 20px', textAlign:'center', boxShadow:'0 2px 12px rgba(0,0,0,0.06)', marginBottom:14 }}>
            <div style={{ fontSize:40, marginBottom:10 }}>🐕</div>
            <div style={{ fontSize:15, fontWeight:600, color:'#1a1a1a', marginBottom:6 }}>{tr('profile_noPetsTitle')}</div>
            <div style={{ fontSize:13, color:'#888', marginBottom:16 }}>{tr('profile_noPetsSubtitle')}</div>
            <button onClick={onAddPet}
              style={{ padding:'10px 24px', borderRadius:100, border:'none', background:t.primary, color:'white', fontSize:14, fontWeight:600, cursor:'pointer' }}>
              {tr('profile_addPetButton')}
            </button>
          </div>
        ) : (
          <div style={{ marginBottom:14 }}>
            {pets.map((pet, i) => (
              <div key={pet.id || i} style={{ background:'white', borderRadius:16, padding:'14px 16px', marginBottom:8, boxShadow:'0 2px 12px rgba(0,0,0,0.06)', display:'flex', alignItems:'center', gap:12 }}>
                {pet.photo_url ? (
                  <img src={pet.photo_url} alt={pet.name}
                    style={{ width:52, height:52, borderRadius:14, objectFit:'cover', flexShrink:0 }} />
                ) : (
                  <div style={{ width:52, height:52, borderRadius:14, background:t.light, display:'flex', alignItems:'center', justifyContent:'center', fontSize:24, flexShrink:0 }}>🐕</div>
                )}
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:15, fontWeight:700, color:'#1a1a1a' }}>{pet.name}</div>
                  <div style={{ fontSize:12, color:'#888', marginTop:2 }}>
                    {[pet.breed, pet.age_years ? pet.age_years + ' ' + tr('profile_yearsUnit') : null, pet.weight_kg ? pet.weight_kg + ' ' + tr('profile_weightUnit') : null].filter(Boolean).join(' · ')}
                  </div>
                  <div style={{ display:'flex', gap:6, marginTop:6, flexWrap:'wrap' }}>
                    {pet.is_vaccinated && <span style={{ fontSize:10, padding:'2px 8px', borderRadius:20, background:'#E8F5E9', color:'#2E7D32', fontWeight:600 }}>{tr('profile_vaccinatedBadge')}</span>}
                    {pet.gender && <span style={{ fontSize:10, padding:'2px 8px', borderRadius:20, background:t.light, color:t.primary, fontWeight:600 }}>{pet.gender}</span>}
                  </div>
                </div>
                <div onClick={() => onEditPet && onEditPet(pet)}
                  style={{ width:34, height:34, borderRadius:10, background:t.light, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', flexShrink:0 }}>
                  <Edit2 size={15} color={t.primary} />
                </div>
              </div>
            ))}
            <button onClick={onAddPet}
              style={{ width:'100%', padding:'12px 0', borderRadius:14, border:'1.5px dashed '+t.primary, background:t.light, color:t.primary, fontSize:14, fontWeight:600, cursor:'pointer', marginBottom:14 }}>
              + {tr('profile_addAnotherPet')}
            </button>
          </div>
        )}

        {/* Account Settings */}
        <div style={{ fontSize:12, fontWeight:600, color:'#AAA', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:10 }}>{tr('profile_accountSection')}</div>

        {[
          { icon:'❤️', label:tr('profile_favouriteSittersLabel'), sub:tr('profile_favouriteSittersSub'), action:'favourites' },
          { icon:'⭐', label:tr('profile_myReviewsLabel'), sub:tr('profile_myReviewsSub'), action:'reviews' },
          { icon:'🔔', label:tr('profile_notificationsLabel'), sub:tr('profile_notificationsSub'), action:'notifications' },
        ].map((item, i) => (
          <div key={i} onClick={() => alert(item.label + tr('profile_comingSoonSuffix'))} style={{ background:'white', borderRadius:16, padding:'14px 16px', marginBottom:8, boxShadow:'0 2px 12px rgba(0,0,0,0.06)', display:'flex', alignItems:'center', gap:12, cursor:'pointer' }}>
            <div style={{ width:40, height:40, borderRadius:12, background:t.light, display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, flexShrink:0 }}>
              {item.icon}
            </div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:14, fontWeight:600, color:'#1a1a1a' }}>{item.label}</div>
              <div style={{ fontSize:12, color:'#888', marginTop:1 }}>{item.sub}</div>
            </div>
            <ChevronRight size={16} color="#CCC" />
          </div>
        ))}

        {whatsapp && (
          <div onClick={() => openWhatsAppSupport(whatsapp, tr('profile_whatsappMessage'))}
            style={{ background:'#25D366', borderRadius:16, padding:'14px 16px', marginBottom:8, display:'flex', alignItems:'center', gap:12, cursor:'pointer' }}>
            <div style={{ width:40, height:40, borderRadius:12, background:'rgba(255,255,255,0.2)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, flexShrink:0 }}>💬</div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:14, fontWeight:600, color:'white' }}>{tr('profile_whatsappChatTitle')}</div>
              <div style={{ fontSize:12, color:'rgba(255,255,255,0.85)', marginTop:1 }}>{tr('profile_whatsappChatSub')}</div>
            </div>
          </div>
        )}
        <div onClick={handleSignOut}
          style={{ background:'white', borderRadius:16, padding:'14px 16px', marginBottom:8, boxShadow:'0 2px 12px rgba(0,0,0,0.06)', display:'flex', alignItems:'center', gap:12, cursor:'pointer' }}>
          <div style={{ width:40, height:40, borderRadius:12, background:'#FCEBEB', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, flexShrink:0 }}>
            🚪
          </div>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:14, fontWeight:600, color:'#A32D2D' }}>{tr('profile_signOut')}</div>
            <div style={{ fontSize:12, color:'#888', marginTop:1 }}>{user?.email}</div>
          </div>
        </div>

        <div style={{ textAlign:'center', padding:'20px 0', fontSize:12, color:'#CCC', lineHeight:1.6 }}>
          {tr('profile_footerTagline')}
        </div>
      </div>

      {/* Bottom Nav */}
      <div style={{ position:'fixed', bottom:0, left:'50%', transform:'translateX(-50%)', width:390, background:'white', borderTop:'1px solid #F0F0F0', display:'flex', justifyContent:'space-around', padding:'10px 0 16px', zIndex:100 }}>
        {[
          { id:'home', label:tr('nav_home'), emoji:'🏠' },
          { id:'book', label:tr('nav_bookings'), emoji:'📋' },
          { id:'explore', label:tr('nav_explore'), emoji:'🔍' },
          { id:'profile', label:tr('nav_myPets'), emoji:'\uD83D\uDC15' },
          { id:'settings', label:tr('nav_settings'), emoji:'\u2699\uFE0F' },
        ].map(n => (
          <div key={n.id} onClick={() => { if(n.id==='profile') return; if(onNav) onNav(n.id); else onBack(); }}
            style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:3, cursor:'pointer' }}>
            <span style={{ fontSize:20 }}>{n.emoji}</span>
            <span style={{ fontSize:10, fontWeight:n.id==='profile'?700:400, color:n.id==='profile'?t.primary:'#BBB' }}>{n.label}</span>
            {n.id==='profile' && <div style={{ width:4, height:4, borderRadius:2, background:t.primary }} />}
          </div>
        ))}
      </div>
    </div>
  );
}