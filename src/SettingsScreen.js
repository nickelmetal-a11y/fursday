import React, { useState, useEffect } from 'react';
import { supabase } from './supabase';
import { ChevronRight, LogOut, Save } from 'lucide-react';

const THEMES = {
  Gurgaon: { primary: '#FF6B35', light: '#FFF0EB' },
  Pune:    { primary: '#6C5CE7', light: '#F0EEFF' },
};

export default function SettingsScreen({ onBack, city, userName }) {
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
  const [editingProfile, setEditingProfile] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errors, setErrors] = useState({});
  const [bookingCount, setBookingCount] = useState(0);
  const [memberSince, setMemberSince] = useState('');

  const theme = THEMES[city] || THEMES.Gurgaon;

  useEffect(() => {
    const fetchUserData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      setUserEmail(user?.email || '');
      setUserNameEdit(userName || '');

      if (user) {
        const { data } = await supabase.from('users').select('phone, created_at').eq('id', user.id).single();
        if (data) {
          setUserPhone(data.phone || '');
          if (data.created_at) {
            setMemberSince(new Date(data.created_at).toLocaleDateString());
          }
        }

        const { data: bookings } = await supabase.from('bookings').select('id').eq('pet_parent_id', user.id);
        setBookingCount(bookings?.length || 0);
      }
      setLoading(false);
    };
    fetchUserData();
  }, [userName]);

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

  const handleSignOut = async () => {
    if (window.confirm('Are you sure you want to sign out?')) {
      await supabase.auth.signOut();
      window.location.href = '/';
    }
  };

  if (loading) {
    return (
      <div style={{ maxWidth:390, margin:'0 auto', minHeight:'100vh', background:'#F5F5F5', display:'flex', alignItems:'center', justifyContent:'center' }}>
        <div style={{ textAlign:'center' }}>
          <div style={{ fontSize:32, marginBottom:12 }}>⚙️</div>
          <div style={{ color:'#888', fontSize:13 }}>Loading settings...</div>
        </div>
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
              <input type="checkbox" checked={notificationsEnabled} onChange={e => setNotificationsEnabled(e.target.checked)}
                style={{ width:20, height:20, cursor:'pointer', accentColor:theme.primary }} />
            </div>

            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
              <div>
                <div style={{ fontSize:13, fontWeight:600, color:'#1a1a1a', marginBottom:2 }}>Email notifications</div>
                <div style={{ fontSize:11, color:'#888' }}>Updates via email</div>
              </div>
              <input type="checkbox" checked={emailNotifications} onChange={e => setEmailNotifications(e.target.checked)}
                style={{ width:20, height:20, cursor:'pointer', accentColor:theme.primary }} />
            </div>

            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
              <div>
                <div style={{ fontSize:13, fontWeight:600, color:'#1a1a1a', marginBottom:2 }}>SMS notifications</div>
                <div style={{ fontSize:11, color:'#888' }}>Text message updates</div>
              </div>
              <input type="checkbox" checked={smsNotifications} onChange={e => setSmsNotifications(e.target.checked)}
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
              <div style={{ fontSize:13, fontWeight:600, color:'#1a1a1a', marginBottom:6 }}>Language</div>
              <select style={{ width:'100%', padding:'8px', borderRadius:6, border:'0.5px solid #DDD', fontSize:12, color:'#1a1a1a' }}>
                <option>English</option>
                <option>हिन्दी (Hindi)</option>
                <option>मराठी (Marathi)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Help Section */}
        <div style={{ background:'white', borderRadius:12, overflow:'hidden', marginBottom:12, border:'0.5px solid #E8E8E8' }}>
          <button style={{ width:'100%', padding:'16px', background:'none', border:'none', display:'flex', alignItems:'center', justifyContent:'space-between', cursor:'pointer', fontSize:13, fontWeight:600, color:'#1a1a1a', borderBottom:'0.5px solid #F0F0F0' }}>
            <span>📖 Help & FAQ</span>
            <ChevronRight size={16} color="#888" />
          </button>
          <button style={{ width:'100%', padding:'16px', background:'none', border:'none', display:'flex', alignItems:'center', justifyContent:'space-between', cursor:'pointer', fontSize:13, fontWeight:600, color:'#1a1a1a', borderBottom:'0.5px solid #F0F0F0' }}>
            <span>📋 Terms & Privacy</span>
            <ChevronRight size={16} color="#888" />
          </button>
          <button style={{ width:'100%', padding:'16px', background:'none', border:'none', display:'flex', alignItems:'center', justifyContent:'space-between', cursor:'pointer', fontSize:13, fontWeight:600, color:'#1a1a1a' }}>
            <span>ℹ️ About Fursday</span>
            <ChevronRight size={16} color="#888" />
          </button>
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
        <div style={{ textAlign:'center', marginTop:24, paddingBottom:40 }}>
          <div style={{ fontSize:11, color:'#999' }}>Fursday v1.0.0</div>
          <div style={{ fontSize:10, color:'#CCC', marginTop:4 }}>© 2026 Fursday. All rights reserved.</div>
        </div>

      </div>
    </div>
  );
}
