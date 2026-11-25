import React, { useState, useEffect } from 'react';
import { supabase } from './supabase';
import { ChevronRight, LogOut, Save } from 'lucide-react';
import { useLanguage } from './i18n';
import { useSupportContact, openWhatsAppSupport, callSupport } from './supportContact';

const THEMES = {
  Gurgaon: { primary: '#FF6B35', light: '#FFF0EB' },
  Pune:    { primary: '#6C5CE7', light: '#F0EEFF' },
};

export default function SettingsScreen({ onBack, city, userName, onNav, activeNav }) {
  const [user, setUser] = useState(null);
  const [userEmail, setUserEmail] = useState('');
  const [userPhone, setUserPhone] = useState('');
  const [userNameEdit, setUserNameEdit] = useState('');
  const [darkMode, setDarkMode] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [smsNotifications, setSmsNotifications] = useState(true);
  const [notificationFrequency, setNotificationFrequency] = useState('immediate');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errors, setErrors] = useState({});
  const [bookingCount, setBookingCount] = useState(0);
  const [memberSince, setMemberSince] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [showTermsLocal, setShowTermsLocal] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const { t: tr } = useLanguage();
  const { whatsapp: supportWa, phone: supportPhone } = useSupportContact();

  const theme = THEMES[city] || THEMES.Gurgaon;

  useEffect(() => {
    let cancelled = false;
    const fetchUserData = async () => {
      setLoading(true);
      setLoadError(false);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (cancelled) return;
        setUser(user);
        setUserEmail(user?.email || '');
        setUserNameEdit(userName || '');

        if (user) {
          const { data } = await supabase.from('users').select('created_at').eq('id', user.id).single();
          if (data?.created_at) {
            setMemberSince(new Date(data.created_at).toLocaleDateString());
          }
          const { data: contact } = await supabase.rpc('get_user_contact', { target_id: user.id });
          setUserPhone(contact?.[0]?.phone || '');

          const { data: bookings } = await supabase.from('bookings').select('id').eq('pet_parent_id', user.id);
          setBookingCount(bookings?.length || 0);

          const { data: prefs } = await supabase.from('notification_preferences').select('*').eq('user_id', user.id).single();
          if (prefs) {
            setNotificationsEnabled(prefs.push_enabled);
            setEmailNotifications(prefs.email_enabled);
            setSmsNotifications(prefs.sms_enabled);
          }
        }
      } catch (e) {
        // A thrown (not just {error}-returning) failure here — e.g. a
        // network blip — used to leave `loading` stuck true forever with
        // no way out, since setLoading(false) below never ran. Settings
        // would just hang on "Loading settings..." permanently.
        if (!cancelled) setLoadError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchUserData();
    return () => { cancelled = true; };
  }, [userName, reloadKey]);

  const validatePhone = (phone) => {
    if (!phone) return true;
    const phoneRegex = /^[+]?[(]?[0-9]{3}[)]?[-\s.]?[0-9]{3}[-\s.]?[0-9]{4,6}$/;
    return phoneRegex.test(phone.replace(/\s/g, ''));
  };

  const validateName = (name) => {
    return name.trim().length >= 2 && name.trim().length <= 50;
  };

  const handleSaveProfile = async () => {
    const newErrors = {};

    if (!validateName(userNameEdit)) {
      newErrors.name = 'Name must be 2-50 characters';
    }
    if (userPhone && !validatePhone(userPhone)) {
      newErrors.phone = 'Please enter a valid phone number';
    }

    setErrors(newErrors);

    if (Object.keys(newErrors).length === 0) {
      try {
        if (user) {
          await supabase.from('users').update({
            name: userNameEdit.trim(),
            phone: userPhone.trim(),
          }).eq('id', user.id);

          setSaveSuccess(true);
          setEditingProfile(false);
          setTimeout(() => setSaveSuccess(false), 3000);
        }
      } catch (error) {
        setErrors({ save: 'Failed to save profile' });
      }
    }
  };

  const saveNotificationPrefs = async (overrides = {}) => {
    if (!user) return;
    const prefs = {
      user_id: user.id,
      push_enabled: notificationsEnabled,
      email_enabled: emailNotifications,
      sms_enabled: smsNotifications,
      ...overrides,
    };
    const { error } = await supabase.from('notification_preferences').upsert(prefs, { onConflict: 'user_id' });
    if (error) console.error('Could not save notification preferences:', error.message);
  };

  const handleSignOut = async () => {
    if (window.confirm('Are you sure you want to sign out?')) {
      await supabase.auth.signOut();
      window.location.href = '/';
    }
  };

  if (showTermsLocal) {
    const TermsAndConditions = require('./TermsAndConditions').default;
    return <TermsAndConditions onBack={() => setShowTermsLocal(false)} city={city} />;
  }

  if (loading) {
    return (
      <div style={{ maxWidth:390, margin:'0 auto', minHeight:'100vh', background:'#F5F5F5', display:'flex', alignItems:'center', justifyContent:'center' }}>
        <div style={{ textAlign:'center' }}>
          <div style={{ fontSize:32, marginBottom:12 }}>⚙️</div>
          <div style={{ color:'#888', fontSize:13 }}>{tr('settings_loading')}</div>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div style={{ maxWidth:390, margin:'0 auto', minHeight:'100vh', background:'#F5F5F5', display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:12, padding:'0 24px', textAlign:'center' }}>
        <div style={{ fontSize:32 }}>⚠️</div>
        <div style={{ color:'#666', fontSize:13 }}>{tr('common_error')}</div>
        <button onClick={() => setReloadKey(k => k + 1)} style={{ background:theme.primary, color:'white', border:'none', padding:'10px 20px', borderRadius:8, fontWeight:700, cursor:'pointer', fontSize:12 }}>{tr('common_retry')}</button>
        <button onClick={onBack} style={{ background:'none', border:'none', color:'#999', fontSize:13, cursor:'pointer' }}>{tr('common_back')}</button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth:390, margin:'0 auto', minHeight:'100vh', background:'#F5F5F5', fontFamily:'-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif', paddingBottom:20 }}>

      {/* Header */}
      <div style={{ background:'white', padding:'16px', display:'flex', alignItems:'center', gap:12, borderBottom:'0.5px solid #E8E8E8', position:'sticky', top:0, zIndex:100 }}>
        <button onClick={onBack} style={{ background:'none', border:'none', fontSize:20, cursor:'pointer', padding:0 }}>‹</button>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:18, fontWeight:700, color:'#1a1a1a' }}>Settings</div>
          <div style={{ fontSize:12, color:'#888' }}>Manage your account</div>
        </div>
        <span style={{ fontSize:24 }}>⚙️</span>
      </div>

      {/* Content */}
      <div style={{ padding:'16px' }}>

        {/* Success Message */}
        {saveSuccess && (
          <div style={{ background:'#C8E6C9', borderRadius:12, padding:12, marginBottom:12, border:'0.5px solid #81C784', display:'flex', gap:8, alignItems:'center' }}>
            <span>✅</span>
            <div style={{ fontSize:12, color:'#2E7D32', fontWeight:600 }}>Profile saved successfully</div>
          </div>
        )}

        {/* Profile Section */}
        <div style={{ background:'white', borderRadius:12, overflow:'hidden', marginBottom:12, border:'0.5px solid #E8E8E8' }}>
          <div style={{ padding:'16px', borderBottom:'0.5px solid #F0F0F0' }}>
            <div style={{ fontSize:12, fontWeight:700, color:'#888', marginBottom:12, textTransform:'uppercase' }}>Profile</div>

            {!editingProfile ? (
              <>
                <div style={{ marginBottom:12 }}>
                  <div style={{ fontSize:11, color:'#999', marginBottom:3 }}>Full Name</div>
                  <div style={{ fontSize:14, fontWeight:600, color:'#1a1a1a' }}>{userNameEdit || 'Not set'}</div>
                </div>

                <div style={{ marginBottom:12 }}>
                  <div style={{ fontSize:11, color:'#999', marginBottom:3 }}>Email</div>
                  <div style={{ fontSize:13, color:'#1a1a1a' }}>{userEmail}</div>
                </div>

                <div style={{ marginBottom:12 }}>
                  <div style={{ fontSize:11, color:'#999', marginBottom:3 }}>Phone</div>
                  <div style={{ fontSize:13, color:'#1a1a1a' }}>{userPhone || 'Not added'}</div>
                </div>

                <div style={{ marginBottom:12 }}>
                  <div style={{ fontSize:11, color:'#999', marginBottom:3 }}>Member Since</div>
                  <div style={{ fontSize:13, color:'#1a1a1a' }}>{memberSince}</div>
                </div>

                <div>
                  <div style={{ fontSize:11, color:'#999', marginBottom:3 }}>Total Bookings</div>
                  <div style={{ fontSize:13, fontWeight:600, color:theme.primary }}>{bookingCount} bookings</div>
                </div>
              </>
            ) : (
              <>
                <div style={{ marginBottom:14 }}>
                  <label style={{ fontSize:11, color:'#666', display:'block', marginBottom:6, fontWeight:600 }}>Full Name</label>
                  <input
                    type="text"
                    value={userNameEdit}
                    onChange={e => { setUserNameEdit(e.target.value); if (errors.name) { const ne = {...errors}; delete ne.name; setErrors(ne); } }}
                    style={{ width:'100%', padding:'10px', borderRadius:6, border:'0.5px solid '+(errors.name?'#E53935':'#DDD'), fontSize:13, boxSizing:'border-box', outline:'none' }}
                    maxLength={50}
                  />
                  {errors.name && <div style={{ fontSize:11, color:'#E53935', marginTop:4 }}>{errors.name}</div>}
                </div>

                <div style={{ marginBottom:14 }}>
                  <label style={{ fontSize:11, color:'#666', display:'block', marginBottom:6, fontWeight:600 }}>Phone Number</label>
                  <input
                    type="tel"
                    value={userPhone}
                    onChange={e => { setUserPhone(e.target.value); if (errors.phone) { const ne = {...errors}; delete ne.phone; setErrors(ne); } }}
                    placeholder="+91 9876543210"
                    style={{ width:'100%', padding:'10px', borderRadius:6, border:'0.5px solid '+(errors.phone?'#E53935':'#DDD'), fontSize:13, boxSizing:'border-box', outline:'none' }}
                  />
                  {errors.phone && <div style={{ fontSize:11, color:'#E53935', marginTop:4 }}>{errors.phone}</div>}
                </div>

                <div style={{ display:'flex', gap:8 }}>
                  <button
                    onClick={handleSaveProfile}
                    style={{ flex:1, padding:'10px', background:theme.primary, color:'white', border:'none', borderRadius:6, fontWeight:700, cursor:'pointer', fontSize:12, display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}
                  >
                    <Save size={14} /> Save
                  </button>
                  <button
                    onClick={() => { setEditingProfile(false); setUserNameEdit(userName); setErrors({}); }}
                    style={{ flex:1, padding:'10px', background:'#f5f5f5', color:'#666', border:'0.5px solid #ddd', borderRadius:6, fontWeight:700, cursor:'pointer', fontSize:12 }}
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}
          </div>

          {!editingProfile && (
            <button
              onClick={() => setEditingProfile(true)}
              style={{ width:'100%', padding:'12px', background:'white', border:'none', borderTop:'0.5px solid #F0F0F0', color:theme.primary, fontWeight:600, cursor:'pointer', fontSize:13, display:'flex', alignItems:'center', justifyContent:'space-between' }}
            >
              Edit profile
              <ChevronRight size={16} />
            </button>
          )}
        </div>

        {/* Notifications Section */}
        <div style={{ background:'white', borderRadius:12, overflow:'hidden', marginBottom:12, border:'0.5px solid #E8E8E8' }}>
          <div style={{ padding:'16px', borderBottom:'0.5px solid #F0F0F0' }}>
            <div style={{ fontSize:12, fontWeight:700, color:'#888', marginBottom:12, textTransform:'uppercase' }}>Notifications</div>

            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
              <div>
                <div style={{ fontSize:13, fontWeight:600, color:'#1a1a1a', marginBottom:2 }}>Push notifications</div>
                <div style={{ fontSize:11, color:'#888' }}>Get alerts in the app</div>
              </div>
              <input type="checkbox" checked={notificationsEnabled} onChange={e => { setNotificationsEnabled(e.target.checked); saveNotificationPrefs({ push_enabled: e.target.checked }); }}
                style={{ width:20, height:20, cursor:'pointer', accentColor:theme.primary }} />
            </div>

            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
              <div>
                <div style={{ fontSize:13, fontWeight:600, color:'#1a1a1a', marginBottom:2 }}>Email notifications</div>
                <div style={{ fontSize:11, color:'#888' }}>Updates via email</div>
              </div>
              <input type="checkbox" checked={emailNotifications} onChange={e => { setEmailNotifications(e.target.checked); saveNotificationPrefs({ email_enabled: e.target.checked }); }}
                style={{ width:20, height:20, cursor:'pointer', accentColor:theme.primary }} />
            </div>

            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
              <div>
                <div style={{ fontSize:13, fontWeight:600, color:'#1a1a1a', marginBottom:2 }}>SMS notifications</div>
                <div style={{ fontSize:11, color:'#888' }}>Text message updates</div>
              </div>
              <input type="checkbox" checked={smsNotifications} onChange={e => { setSmsNotifications(e.target.checked); saveNotificationPrefs({ sms_enabled: e.target.checked }); }}
                style={{ width:20, height:20, cursor:'pointer', accentColor:theme.primary }} />
            </div>

            <div>
              <div style={{ fontSize:13, fontWeight:600, color:'#1a1a1a', marginBottom:6 }}>Notification Frequency</div>
              <select
                value={notificationFrequency}
                onChange={e => setNotificationFrequency(e.target.value)}
                style={{ width:'100%', padding:'8px', borderRadius:6, border:'0.5px solid #DDD', fontSize:12, color:'#1a1a1a' }}>
                <option value="immediate">Immediate</option>
                <option value="hourly">Hourly digest</option>
                <option value="daily">Daily digest</option>
                <option value="weekly">Weekly digest</option>
              </select>
            </div>
          </div>
        </div>

        {/* Preferences Section */}
        <div style={{ background:'white', borderRadius:12, overflow:'hidden', marginBottom:12, border:'0.5px solid #E8E8E8' }}>
          <div style={{ padding:'16px', borderBottom:'0.5px solid #F0F0F0' }}>
            <div style={{ fontSize:12, fontWeight:700, color:'#888', marginBottom:12, textTransform:'uppercase' }}>Preferences</div>

            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
              <div>
                <div style={{ fontSize:13, fontWeight:600, color:'#1a1a1a', marginBottom:2 }}>Dark mode</div>
                <div style={{ fontSize:11, color:'#888' }}>Coming soon</div>
              </div>
              <input type="checkbox" disabled checked={darkMode} style={{ width:20, height:20, cursor:'not-allowed' }} />
            </div>

            <div>
              <div style={{ fontSize:13, fontWeight:600, color:'#1a1a1a', marginBottom:2 }}>Language</div>
              <div style={{ fontSize:11, color:'#888' }}>{tr('settings_languageNote')}</div>
            </div>
          </div>
        </div>

        {/* Help Section */}
        <div style={{ background:'white', borderRadius:12, overflow:'hidden', marginBottom:12, border:'0.5px solid #E8E8E8' }}>
          <button onClick={() => { if (supportWa) openWhatsAppSupport(supportWa, 'Hi, I need help with Fursday'); else if (supportPhone) callSupport(supportPhone); else window.open('mailto:support@fursday.in'); }}
            style={{ width:'100%', padding:'16px', background:'none', border:'none', display:'flex', alignItems:'center', justifyContent:'space-between', cursor:'pointer', fontSize:13, fontWeight:600, color:'#1a1a1a', borderBottom:'0.5px solid #F0F0F0' }}>
            <span>📖 Help & FAQ</span>
            <ChevronRight size={16} color="#888" />
          </button>
          <button onClick={() => { if (supportPhone) callSupport(supportPhone); else if (supportWa) openWhatsAppSupport(supportWa, 'SOS: I need help now'); else alert('Support contact is being set up. Please email support@fursday.in'); }}
            style={{ width:'100%', padding:'16px', background:'#FFEBEE', border:'none', display:'flex', alignItems:'center', justifyContent:'space-between', cursor:'pointer', fontSize:13, fontWeight:700, color:'#C62828', borderBottom:'0.5px solid #F0F0F0' }}>
            <span>🆘 {tr('sos').replace('🆘 ', '')}</span>
            <ChevronRight size={16} color="#C62828" />
          </button>
          <button onClick={() => setShowTermsLocal(true)}
            style={{ width:'100%', padding:'16px', background:'none', border:'none', display:'flex', alignItems:'center', justifyContent:'space-between', cursor:'pointer', fontSize:13, fontWeight:600, color:'#1a1a1a', borderBottom:'0.5px solid #F0F0F0' }}>
            <span>📋 Terms & Privacy</span>
            <ChevronRight size={16} color="#888" />
          </button>
          <button onClick={() => setShowAbout(a => !a)} style={{ width:'100%', padding:'16px', background:'none', border:'none', display:'flex', alignItems:'center', justifyContent:'space-between', cursor:'pointer', fontSize:13, fontWeight:600, color:'#1a1a1a' }}>
            <span>ℹ️ About Fursday</span>
            <ChevronRight size={16} color="#888" />
          </button>
          {showAbout && (
            <div style={{ padding:'0 16px 16px', fontSize:12, color:'#666', lineHeight:1.6 }}>
              Fursday connects pet parents with vetted sitters for walks, boarding and daycare. Version 1.0.0.
            </div>
          )}
        </div>

        {/* Danger Zone */}
        <div style={{ background:'white', borderRadius:12, overflow:'hidden', border:'0.5px solid #E8E8E8' }}>
          <button onClick={handleSignOut}
            style={{ width:'100%', padding:'16px', background:'none', border:'none', display:'flex', alignItems:'center', justifyContent:'space-between', cursor:'pointer', fontSize:13, fontWeight:600, color:'#E53935', borderBottom:'0.5px solid #F0F0F0' }}>
            <span style={{ display:'flex', alignItems:'center', gap:8 }}>
              <LogOut size={16} />
              Sign out
            </span>
            <ChevronRight size={16} />
          </button>
          <div style={{ padding:'12px 16px', background:'#FFEBEE', borderTop:'0.5px solid #F0F0F0' }}>
            <div style={{ fontSize:11, color:'#C62828' }}>Signed in as: {userEmail}</div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ textAlign:'center', marginTop:24, paddingBottom:70 }}>
          <div style={{ fontSize:11, color:'#999' }}>Fursday v1.0.0</div>
          <div style={{ fontSize:10, color:'#CCC', marginTop:4 }}>© 2026 Fursday. All rights reserved.</div>
        </div>

      </div>

      {/* BOTTOM NAV — was missing entirely, so there was no way back to
          Bookings/Explore/My Pets from Settings except the back arrow. */}
      <div style={{ position:'fixed', bottom:0, left:'50%', transform:'translateX(-50%)', width:390, background:'white', borderTop:'1px solid #F0F0F0', display:'flex', justifyContent:'space-around', padding:'10px 0 calc(16px + env(safe-area-inset-bottom))', zIndex:100 }}>
        {[
          { id:'home', label:'Home', emoji:'🏠' },
          { id:'book', label:'Bookings', emoji:'📋' },
          { id:'explore', label:'Explore', emoji:'🔍' },
          { id:'profile', label:'My Pets', emoji:'🐕' },
          { id:'settings', label:'Settings', emoji:'⚙️' },
        ].map(n => (
          <div key={n.id} onClick={() => { if(n.id==='settings') return; if(onNav) onNav(n.id); else onBack(); }}
            style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:3, cursor:'pointer' }}>
            <span style={{ fontSize:20 }}>{n.emoji}</span>
            <span style={{ fontSize:10, fontWeight:n.id==='settings'?700:400, color:n.id==='settings'?theme.primary:'#BBB' }}>{n.label}</span>
            {n.id==='settings' && <div style={{ width:4, height:4, borderRadius:2, background:theme.primary }} />}
          </div>
        ))}
      </div>
    </div>
  );
}
