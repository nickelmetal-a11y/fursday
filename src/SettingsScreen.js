import React, { useState, useEffect } from 'react';
import { supabase } from './supabase';
import { ChevronRight, LogOut } from 'lucide-react';

const THEMES = {
  Gurgaon: { primary: '#FF6B35', light: '#FFF0EB' },
  Pune:    { primary: '#6C5CE7', light: '#F0EEFF' },
};

export default function SettingsScreen({ onBack, city, userName }) {
  const [user, setUser] = useState(null);
  const [userEmail, setUserEmail] = useState('');
  const [userPhone, setUserPhone] = useState('');
  const [darkMode, setDarkMode] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [smsNotifications, setSmsNotifications] = useState(true);
  const [loading, setLoading] = useState(true);

  const theme = THEMES[city] || THEMES.Gurgaon;

  useEffect(() => {
    const fetchUserData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      setUserEmail(user?.email || '');

      if (user) {
        const { data } = await supabase.from('users').select('phone').eq('id', user.id).single();
        if (data) {
          setUserPhone(data.phone || '');
        }
      }
      setLoading(false);
    };
    fetchUserData();
  }, []);

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
      <div style={{ background:'white', padding:'16px', display:'flex', alignItems:'center', gap:12, borderBottom:'0.5px solid #E8E8E8' }}>
        <button onClick={onBack} style={{ background:'none', border:'none', fontSize:20, cursor:'pointer' }}>‹</button>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:18, fontWeight:700, color:'#1a1a1a' }}>Settings</div>
          <div style={{ fontSize:12, color:'#888' }}>Manage your account</div>
        </div>
        <span style={{ fontSize:24 }}>⚙️</span>
      </div>

      {/* Content */}
      <div style={{ padding:'16px' }}>

        {/* Profile Section */}
        <div style={{ background:'white', borderRadius:12, overflow:'hidden', marginBottom:12, border:'0.5px solid #E8E8E8' }}>
          <div style={{ padding:'16px', borderBottom:'0.5px solid #F0F0F0' }}>
            <div style={{ fontSize:12, fontWeight:700, color:'#888', marginBottom:12, textTransform:'uppercase' }}>Profile</div>

            <div style={{ marginBottom:14 }}>
              <div style={{ fontSize:12, color:'#666', marginBottom:4 }}>Name</div>
              <div style={{ fontSize:14, fontWeight:600, color:'#1a1a1a' }}>{userName || 'Guest'}</div>
            </div>

            <div style={{ marginBottom:14 }}>
              <div style={{ fontSize:12, color:'#666', marginBottom:4 }}>Email</div>
              <div style={{ fontSize:13, color:'#1a1a1a' }}>{userEmail}</div>
            </div>

            <div>
              <div style={{ fontSize:12, color:'#666', marginBottom:4 }}>Phone</div>
              <div style={{ fontSize:13, color:'#1a1a1a' }}>{userPhone || 'Not added'}</div>
            </div>
          </div>

          <button style={{ width:'100%', padding:'12px', background:'white', border:'none', borderTop:'0.5px solid #F0F0F0', color:theme.primary, fontWeight:600, cursor:'pointer', fontSize:13, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            Edit profile
            <ChevronRight size={16} />
          </button>
        </div>

        {/* Notifications Section */}
        <div style={{ background:'white', borderRadius:12, overflow:'hidden', marginBottom:12, border:'0.5px solid #E8E8E8' }}>
          <div style={{ padding:'16px', borderBottom:'0.5px solid #F0F0F0' }}>
            <div style={{ fontSize:12, fontWeight:700, color:'#888', marginBottom:12, textTransform:'uppercase' }}>Notifications</div>

            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
              <div>
                <div style={{ fontSize:13, fontWeight:600, color:'#1a1a1a', marginBottom:2 }}>Push notifications</div>
                <div style={{ fontSize:11, color:'#888' }}>Get alerts in the app</div>
              </div>
              <input type="checkbox" checked={notificationsEnabled} onChange={e => setNotificationsEnabled(e.target.checked)}
                style={{ width:20, height:20, cursor:'pointer', accentColor:theme.primary }} />
            </div>

            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
              <div>
                <div style={{ fontSize:13, fontWeight:600, color:'#1a1a1a', marginBottom:2 }}>Email notifications</div>
                <div style={{ fontSize:11, color:'#888' }}>Updates via email</div>
              </div>
              <input type="checkbox" checked={emailNotifications} onChange={e => setEmailNotifications(e.target.checked)}
                style={{ width:20, height:20, cursor:'pointer', accentColor:theme.primary }} />
            </div>

            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <div>
                <div style={{ fontSize:13, fontWeight:600, color:'#1a1a1a', marginBottom:2 }}>SMS notifications</div>
                <div style={{ fontSize:11, color:'#888' }}>Text message updates</div>
              </div>
              <input type="checkbox" checked={smsNotifications} onChange={e => setSmsNotifications(e.target.checked)}
                style={{ width:20, height:20, cursor:'pointer', accentColor:theme.primary }} />
            </div>
          </div>
        </div>

        {/* Preferences Section */}
        <div style={{ background:'white', borderRadius:12, overflow:'hidden', marginBottom:12, border:'0.5px solid #E8E8E8' }}>
          <div style={{ padding:'16px', borderBottom:'0.5px solid #F0F0F0' }}>
            <div style={{ fontSize:12, fontWeight:700, color:'#888', marginBottom:12, textTransform:'uppercase' }}>Preferences</div>

            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
              <div>
                <div style={{ fontSize:13, fontWeight:600, color:'#1a1a1a', marginBottom:2 }}>Dark mode</div>
                <div style={{ fontSize:11, color:'#888' }}>Coming soon</div>
              </div>
              <input type="checkbox" disabled checked={darkMode} style={{ width:20, height:20, cursor:'not-allowed' }} />
            </div>

            <div>
              <div style={{ fontSize:13, fontWeight:600, color:'#1a1a1a', marginBottom:2 }}>Language</div>
              <select style={{ width:'100%', padding:'8px', borderRadius:6, border:'0.5px solid #DDD', fontSize:12, color:'#1a1a1a' }}>
                <option>English</option>
                <option>Hindi</option>
                <option>Marathi</option>
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

        {/* Version */}
        <div style={{ textAlign:'center', marginTop:24, paddingBottom:40 }}>
          <div style={{ fontSize:11, color:'#999' }}>Fursday v1.0.0</div>
          <div style={{ fontSize:10, color:'#CCC', marginTop:4 }}>© 2026 Fursday. All rights reserved.</div>
        </div>

      </div>
    </div>
  );
}
