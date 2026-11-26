import React, { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from './supabase';
import { color, font, radius, ui } from './theme';
import Icon from './ui/Icon';
import AdminAuditLogs from './AdminAuditLogs';
import AdminDisputes from './AdminDisputes';
import AdminPromotions from './AdminPromotions';
import AdminSettings from './AdminSettings';
import AdminUsers from './AdminUsers';
import AdminReports from './AdminReports';
import AdminBookings from './AdminBookings';
import AdminBroadcast from './AdminBroadcast';
import AdminOverview from './AdminOverview';
import AdminPayouts from './AdminPayouts';
import AdminZones from './AdminZones';
import AdminReferrals from './AdminReferrals';
import SitterDirectory, { PendingQueue, makeSitterActions } from './AdminSitters';
import { unpaidPayouts } from './adminInsights';
import { AdminStyles, Skeleton, Toast, A } from './AdminUI';

const SUBTITLES = {
  overview: 'What needs you today, and how the last 7 days compare.',
  pending: 'Sitter applications waiting for review, oldest first.',
  sitters: 'Every sitter with a quality scorecard. Open one for documents, services and history.',
  bookings: 'Find any booking, then cancel, reassign or add notes.',
  payouts: 'Completed jobs not yet paid out, grouped by sitter.',
  disputes: 'Complaints raised by parents and sitters.',
  zones: 'Open or close areas, and see where people are waiting.',
  promotions: 'Promo codes and the home page offer banner.',
  referrals: 'Who referred whom, and the credits waiting to be applied.',
  messages: 'In-app announcements to sitters and parents.',
  users: 'Everyone on Fursday, test logins and account deletion requests.',
  reports: 'Revenue, refunds and weekly trends.',
  audit: 'Every admin action, newest first.',
  settings: 'Support contacts and referral amounts.',
};

// Sidebar colours on the navy background.
const onNavy = { text: 'rgba(255,255,255,0.72)', faint: 'rgba(255,255,255,0.45)', active: 'rgba(255,255,255,0.14)', rule: 'rgba(255,255,255,0.1)' };

function Gate({ children }) {
  return (
    <div className="adm-root" style={{ minHeight: '100vh', background: color.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, fontFamily: font.family, color: color.ink, boxSizing: 'border-box' }}>
      <AdminStyles />
      <div style={{ ...ui.card, width: '100%', maxWidth: 400, padding: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 10 }}>{children}</div>
    </div>
  );
}

export default function AdminPanel({ onSignOut }) {
  const [adminChecked, setAdminChecked] = useState(false);
  const [isRealAdmin, setIsRealAdmin] = useState(false);
  const [adminEmail, setAdminEmail] = useState('');
  const [tab, setTab] = useState('pending');
  const [focusBookingId, setFocusBookingId] = useState(null);
  const [sitters, setSitters] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState(null);
  const [narrow, setNarrow] = useState(typeof window !== 'undefined' && window.innerWidth < 760);
  const toastTimer = useRef(null);

  useEffect(() => {
    const onResize = () => setNarrow(window.innerWidth < 760);
    window.addEventListener('resize', onResize);
    return () => { window.removeEventListener('resize', onResize); clearTimeout(toastTimer.current); };
  }, []);

  const showMsg = useCallback((text, tone = 'success') => {
    setToast({ text, tone });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), tone === 'error' ? 5000 : 2500);
  }, []);

  // The first load shows skeletons; later refreshes keep the page (and any open
  // drawer or filters) in place and swap the data in when it arrives.
  const loadData = useCallback(async () => {
    setRefreshing(true);
    const { data: s } = await supabase
      .from('sitter_profiles')
      .select('*, users(name), cities(name), sitter_services(service_type, price_paise, is_active)')
      .order('created_at', { ascending: false });
    const withContact = await Promise.all((s || []).map(async (sitter) => {
      if (!sitter.users) return sitter;
      const { data: contact } = await supabase.rpc('get_user_contact', { target_id: sitter.user_id });
      return { ...sitter, users: { ...sitter.users, phone: contact?.[0]?.phone, email: contact?.[0]?.email } };
    }));
    const { data: pii } = await supabase.from('sitter_pii').select('sitter_id, aadhaar_number, upi_id');
    const piiBySitter = Object.fromEntries((pii || []).map(p => [p.sitter_id, p]));
    const { data: b } = await supabase
      .from('bookings')
      .select('*, cities(name), users(name)')
      .order('created_at', { ascending: false })
      .limit(500);
    setSitters(withContact.map(x => ({ ...x, aadhaar_number: piiBySitter[x.id]?.aadhaar_number || null, upi_id: piiBySitter[x.id]?.upi_id || null })));
    setBookings(b || []);
    setLoaded(true);
    setRefreshing(false);
  }, []);

  // Access is decided only by RLS on the logged-in Supabase account's
  // users.is_admin (migration 021). A client-side password was removed: any
  // REACT_APP_* value is baked into the public JS bundle, so it protected nothing.
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setIsRealAdmin(false); setAdminChecked(true); return; }
      setAdminEmail(user.email || '');
      const { data } = await supabase.rpc('is_admin_user');
      setIsRealAdmin(data === true);
      setAdminChecked(true);
    })();
  }, []);

  useEffect(() => { if (isRealAdmin) loadData(); }, [isRealAdmin, loadData]);

  const signOut = () => (onSignOut ? onSignOut() : supabase.auth.signOut());

  if (!adminChecked) return <Gate><Skeleton rows={2} label="Checking admin access..." /></Gate>;

  if (!isRealAdmin) return (
    <Gate>
      <div style={ui.iconTile}><Icon name="lock" /></div>
      <h1 style={{ margin: 0, fontSize: font.xl, fontWeight: 700 }}>Not signed in as an admin</h1>
      <p style={{ margin: '0 0 8px', fontSize: font.md, color: color.muted, lineHeight: 1.6 }}>This account doesn't have admin access. Sign in with an admin account instead.</p>
      {onSignOut && <button onClick={onSignOut} style={{ ...A.primary, width: '100%' }}>Use a different account</button>}
    </Gate>
  );

  const actions = makeSitterActions({ sitters, showMsg, reload: loadData });
  const pendingCount = sitters.filter(s => s.status === 'pending').length;
  const unpaidCount = unpaidPayouts(bookings).length;

  const groups = [
    { title: 'Operations', items: [
      { id: 'overview', icon: 'chart', label: 'Overview' },
      { id: 'pending', icon: 'clock', label: 'Pending (' + pendingCount + ')' },
      { id: 'sitters', icon: 'users', label: 'Sitters (' + sitters.length + ')' },
      { id: 'bookings', icon: 'calendar', label: 'Bookings (' + bookings.length + ')' },
      { id: 'payouts', icon: 'wallet', label: 'Payouts (' + unpaidCount + ')' },
      { id: 'disputes', icon: 'scale', label: 'Disputes' },
    ] },
    { title: 'Growth', items: [
      { id: 'zones', icon: 'map', label: 'Zones' },
      { id: 'promotions', icon: 'tag', label: 'Promotions' },
      { id: 'referrals', icon: 'gift', label: 'Referrals' },
      { id: 'messages', icon: 'megaphone', label: 'Messages' },
    ] },
    { title: 'Insights', items: [
      { id: 'users', icon: 'user', label: 'People' },
      { id: 'reports', icon: 'trendUp', label: 'Reports' },
      { id: 'audit', icon: 'history', label: 'Audit' },
    ] },
    { title: 'System', items: [{ id: 'settings', icon: 'settings', label: 'Settings' }] },
  ];
  const active = groups.flatMap(g => g.items).find(n => n.id === tab);
  const goTab = (id) => { setTab(id); setFocusBookingId(null); };
  const openBooking = (id) => { setFocusBookingId(id); setTab('bookings'); };

  const navButton = (n) => {
    const on = tab === n.id;
    return (
      <button key={n.id} className="adm-nav" onClick={() => goTab(n.id)} aria-current={on ? 'page' : undefined}
        style={{ width: narrow ? 'auto' : '100%', flexShrink: 0, whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 10, minHeight: 40, padding: narrow ? '0 12px' : '0 12px', borderRadius: radius.sm, border: 'none', marginBottom: narrow ? 0 : 2, background: on ? onNavy.active : 'transparent', color: on ? color.surface : onNavy.text, fontSize: font.md, fontWeight: on ? 600 : 400, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', boxShadow: on && !narrow ? `inset 3px 0 0 ${color.saffron}` : 'none' }}>
        <Icon name={n.icon} size={18} /><span>{n.label}</span>
      </button>
    );
  };

  const brand = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 8px' }}>
      <div style={{ width: 32, height: 32, borderRadius: radius.sm, background: color.saffron, color: color.surface, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Icon name="paw" size={18} /></div>
      <span style={{ color: color.surface, fontSize: font.lg, fontWeight: 700 }}>Fursday Admin</span>
    </div>
  );

  return (
    <div className="adm-root" style={{ display: 'flex', flexDirection: narrow ? 'column' : 'row', minHeight: '100vh', background: color.bg, fontFamily: font.family, color: color.ink }}>
      <AdminStyles />
      {toast && <Toast message={toast.text} tone={toast.tone} />}

      <nav aria-label="Admin sections" style={narrow
        ? { background: color.navy, padding: '12px 12px 8px', position: 'sticky', top: 0, zIndex: 50 }
        : { width: 232, flexShrink: 0, background: color.navy, display: 'flex', flexDirection: 'column', padding: '20px 12px', position: 'sticky', top: 0, height: '100vh', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: narrow ? 10 : 20 }}>
          {brand}
          {narrow && <button onClick={signOut} aria-label="Sign out" style={{ background: 'transparent', border: 'none', color: onNavy.text, minWidth: 40, minHeight: 40, cursor: 'pointer' }}><Icon name="logout" size={20} /></button>}
        </div>
        <div style={narrow ? { display: 'flex', gap: 4, overflowX: 'auto', paddingBottom: 4 } : { flex: 1, overflowY: 'auto' }}>
          {narrow ? groups.flatMap(g => g.items).map(navButton) : groups.map(g => (
            <div key={g.title} style={{ marginBottom: 14 }}>
              <div style={{ fontSize: font.xs, fontWeight: 600, letterSpacing: 0.6, textTransform: 'uppercase', color: onNavy.faint, padding: '0 12px', marginBottom: 6 }}>{g.title}</div>
              {g.items.map(navButton)}
            </div>
          ))}
        </div>
        {!narrow && (
          <div style={{ borderTop: `1px solid ${onNavy.rule}`, paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {adminEmail && <div style={{ fontSize: font.xs, color: onNavy.faint, padding: '0 12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={adminEmail}>{adminEmail}</div>}
            <button className="adm-nav" onClick={signOut} style={{ display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left', background: 'transparent', border: 'none', borderRadius: radius.sm, minHeight: 40, padding: '0 12px', color: onNavy.text, fontSize: font.md, cursor: 'pointer', fontFamily: 'inherit' }}>
              <Icon name="logout" size={18} />Sign out
            </button>
          </div>
        )}
      </nav>

      <main style={{ flex: 1, minWidth: 0, padding: narrow ? 16 : '24px 32px' }}>
        <div style={{ maxWidth: 1240, margin: '0 auto' }}>
          <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
            <div style={{ minWidth: 0 }}>
              <h1 style={{ margin: 0, fontSize: font.xxl, fontWeight: 700, color: color.ink }}>{active?.label.replace(/\s*\(\d+\)$/, '')}</h1>
              <div style={{ fontSize: font.md, color: color.muted, marginTop: 4 }}>{SUBTITLES[tab]}</div>
            </div>
            <button onClick={loadData} disabled={refreshing} style={{ ...A.secondary, ...(refreshing ? { opacity: 0.6 } : null) }}>
              <Icon name="refresh" size={18} />{refreshing ? 'Refreshing…' : 'Refresh'}
            </button>
          </header>

          {!loaded ? <Skeleton rows={6} /> : (
            <>
              {tab === 'overview' && <AdminOverview bookings={bookings} sitters={sitters} onOpenBooking={openBooking} onGoTab={goTab} />}
              {tab === 'pending' && <PendingQueue sitters={sitters} actions={actions} />}
              {tab === 'sitters' && <SitterDirectory sitters={sitters} bookings={bookings} actions={actions} />}
              {tab === 'bookings' && <AdminBookings bookings={bookings} sitters={sitters} focusId={focusBookingId} onChanged={loadData} />}
              {tab === 'payouts' && <AdminPayouts bookings={bookings} sitters={sitters} showMsg={showMsg} onChanged={loadData} />}
              {tab === 'disputes' && <AdminDisputes />}
              {tab === 'zones' && <AdminZones />}
              {tab === 'promotions' && <AdminPromotions />}
              {tab === 'referrals' && <AdminReferrals onGoTab={goTab} />}
              {tab === 'messages' && <AdminBroadcast />}
              {tab === 'users' && <AdminUsers />}
              {tab === 'reports' && <AdminReports />}
              {tab === 'audit' && <AdminAuditLogs />}
              {tab === 'settings' && <AdminSettings />}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
