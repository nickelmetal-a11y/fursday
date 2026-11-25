import React, { useState, useEffect } from 'react';
import { supabase } from './supabase';
import { CheckCircle, XCircle, Award, PauseCircle, PlayCircle } from 'lucide-react';
import AdminAuditLogs from './AdminAuditLogs';
import AdminDisputes from './AdminDisputes';
import AdminPromotions from './AdminPromotions';
import { logSitterApproved, logSitterRejected, logSitterSuspended, logTopSitterToggled, logPayoutMarkedPaid } from './auditService';

const ADMIN_PASSWORD = process.env.REACT_APP_ADMIN_PASSWORD || '';
const ORANGE = '#FF6B35';

const STATUS_COLORS = {
  draft: { bg: '#ECEFF1', color: '#546E7A' },
  pending: { bg: '#FFF3E0', color: '#E65100' },
  needs_changes: { bg: '#FFF3E0', color: '#E65100' },
  active: { bg: '#E8F5E9', color: '#2E7D32' },
  rejected: { bg: '#FCEBEB', color: '#A32D2D' },
  suspended: { bg: '#F3E5F5', color: '#6A1B9A' },
};

const BOOKING_COLORS = {
  pending: { bg: '#FFF3E0', color: '#E65100' },
  confirmed: { bg: '#E3F2FD', color: '#1565C0' },
  active: { bg: '#E8F5E9', color: '#2E7D32' },
  completed: { bg: '#F3E5F5', color: '#6A1B9A' },
  cancelled: { bg: '#FCEBEB', color: '#A32D2D' },
};

export default function AdminPanel({ onBack }) {
  const [authed, setAuthed] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [adminChecked, setAdminChecked] = useState(false);
  const [isRealAdmin, setIsRealAdmin] = useState(false);
  const [tab, setTab] = useState('pending');
  const [sitters, setSitters] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [actionMsg, setActionMsg] = useState('');

  const login = () => {
    if (ADMIN_PASSWORD && password === ADMIN_PASSWORD) setAuthed(true);
    else setError(ADMIN_PASSWORD ? 'Wrong password' : 'Admin password not configured (REACT_APP_ADMIN_PASSWORD missing)');
  };

  const showMsg = (msg) => { setActionMsg(msg); setTimeout(() => setActionMsg(''), 2500); };

  const loadData = async () => {
    setLoading(true);
    const { data: s } = await supabase
      .from('sitter_profiles')
      .select('*, users(name), cities(name), sitter_services(service_type, price_paise)')
      .order('created_at', { ascending: false });
    const sittersWithContact = await Promise.all((s || []).map(async (sitter) => {
      if (!sitter.users) return sitter;
      const { data: contact } = await supabase.rpc('get_user_contact', { target_id: sitter.user_id });
      return { ...sitter, users: { ...sitter.users, phone: contact?.[0]?.phone, email: contact?.[0]?.email } };
    }));
    setSitters(sittersWithContact);
    const { data: b } = await supabase
      .from('bookings')
      .select('*, cities(name)')
      .order('created_at', { ascending: false })
      .limit(100);
    setBookings(b || []);
    setLoading(false);
  };

  // The password above is a client-side speed bump, not real auth (it's the
  // same shared anon key as the rest of the app). The actual security
  // boundary is RLS, which checks is_admin on whichever Supabase account is
  // really logged into this browser (see migration 021) — so an admin also
  // needs to be logged into the main app as an is_admin account, not just
  // past this password screen, before any of these tables are readable.
  useEffect(() => {
    if (!authed) return;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setIsRealAdmin(false); setAdminChecked(true); return; }
      const { data } = await supabase.from('users').select('is_admin').eq('id', user.id).single();
      setIsRealAdmin(!!data?.is_admin);
      setAdminChecked(true);
    })();
  }, [authed]);

  useEffect(() => { if (authed && isRealAdmin) loadData(); }, [authed, isRealAdmin]);

  const notifyAdminAction = async (sitterId, actionType, details) => {
    try {
      const { data: sitterData } = await supabase
        .from('sitter_profiles')
        .select('users(id)')
        .eq('id', sitterId)
        .single();

      if (sitterData?.users) {
        const { data: contact } = await supabase.rpc('get_user_contact', { target_id: sitterData.users.id });
        const { notifyAdminAction: notifyAction } = await import('./notificationService');
        await notifyAction(sitterData.users.id, contact?.[0]?.email, contact?.[0]?.phone, actionType, details);
      }
    } catch(err) { console.error('Admin action notification failed:', err); }
  };

  const approveSitter = async (id) => {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('sitter_profiles').update({ status: 'active' }).eq('id', id);
    if (user) await logSitterApproved(user.id, id);

    // TIER 2: Send sitter approval notification
    try {
      const { data: sitterData } = await supabase
        .from('sitter_profiles')
        .select('users(id, name)')
        .eq('id', id)
        .single();

      if (sitterData?.users) {
        const { createNotification } = await import('./notificationService');
        await createNotification(
          sitterData.users.id,
          'sitter_approved',
          '🎉 Account Approved!',
          'You are now live and can start accepting bookings'
        );
      }
    } catch(notifErr) { console.error('Approval notification failed:', notifErr); }

    showMsg('Sitter approved ✓');
    loadData();
  };

  const requestChanges = async (id) => {
    const notes = window.prompt('What does this sitter need to fix before re-review?');
    if (!notes) return;
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('sitter_profiles').update({ status: 'needs_changes', review_notes: notes }).eq('id', id);
    if (user) await notifyAdminAction(id, 'needs_changes', notes);

    try {
      const { data: sitterData } = await supabase.from('sitter_profiles').select('users(id)').eq('id', id).single();
      if (sitterData?.users) {
        const { createNotification } = await import('./notificationService');
        await createNotification(sitterData.users.id, 'sitter_needs_changes', '⚠️ Changes needed on your profile', notes);
      }
    } catch (notifErr) { console.error('Needs-changes notification failed:', notifErr); }

    showMsg('Sent back for changes');
    loadData();
  };

  const rejectSitter = async (id) => {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('sitter_profiles').update({ status: 'rejected' }).eq('id', id);
    if (user) await logSitterRejected(user.id, id);

    // TIER 2: Send rejection notification
    try {
      const { data: sitterData } = await supabase
        .from('sitter_profiles')
        .select('users(id)')
        .eq('id', id)
        .single();

      if (sitterData?.users) {
        const { data: contact } = await supabase.rpc('get_user_contact', { target_id: sitterData.users.id });
        const { notifySitterRejected } = await import('./notificationService');
        await notifySitterRejected(
          sitterData.users.id,
          contact?.[0]?.email,
          'Application did not meet our standards. Please reapply with improvements.'
        );
      }
    } catch(notifErr) { console.error('Rejection notification failed:', notifErr); }

    // TIER 3: Log admin action
    await notifyAdminAction(id, 'rejection', 'Application was rejected by admin');

    showMsg('Sitter rejected');
    loadData();
  };

  const suspendSitter = async (id, currentStatus) => {
    const { data: { user } } = await supabase.auth.getUser();
    const newStatus = currentStatus === 'suspended' ? 'active' : 'suspended';
    await supabase.from('sitter_profiles').update({ status: newStatus }).eq('id', id);
    if (user) await logSitterSuspended(user.id, id, newStatus === 'suspended');

    // TIER 2: Send suspension/reinstatement notification
    if (newStatus === 'suspended') {
      try {
        const { data: sitterData } = await supabase
          .from('sitter_profiles')
          .select('users(id)')
          .eq('id', id)
          .single();

        if (sitterData?.users) {
          const { data: contact } = await supabase.rpc('get_user_contact', { target_id: sitterData.users.id });
          const { notifySitterSuspended } = await import('./notificationService');
          await notifySitterSuspended(
            sitterData.users.id,
            contact?.[0]?.email,
            contact?.[0]?.phone,
            'Your account has been suspended. Please contact support for details.'
          );
        }
      } catch(notifErr) { console.error('Suspension notification failed:', notifErr); }
    }

    // TIER 3: Log admin action
    if (newStatus === 'suspended') {
      await notifyAdminAction(id, 'restriction', 'Your account has been temporarily suspended');
    }

    showMsg(newStatus === 'suspended' ? 'Sitter suspended' : 'Sitter reinstated ✓');
    loadData();
  };

  const toggleTopSitter = async (id, current) => {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('sitter_profiles').update({ is_top_sitter: !current }).eq('id', id);
    if (user) await logTopSitterToggled(user.id, id, !current);

    // TIER 2: Send badge award notification
    if (!current) {
      try {
        const { data: sitterData } = await supabase
          .from('sitter_profiles')
          .select('users(id)')
          .eq('id', id)
          .single();

        if (sitterData?.users) {
          const { data: contact } = await supabase.rpc('get_user_contact', { target_id: sitterData.users.id });
          const { notifyTopSitterAwarded } = await import('./notificationService');
          await notifyTopSitterAwarded(
            sitterData.users.id,
            contact?.[0]?.email,
            contact?.[0]?.phone
          );
        }
      } catch(notifErr) { console.error('Top Sitter notification failed:', notifErr); }
    }

    showMsg(current ? 'Top Sitter badge removed' : 'Top Sitter badge awarded ⭐');
    loadData();
  };

  const toggleFoundingSitter = async (id, current) => {
    const { error } = await supabase.from('sitter_profiles').update({ is_founding_sitter: !current }).eq('id', id);
    if (error) { alert('Could not update: ' + error.message); return; }
    showMsg(current ? 'Founding Sitter perk removed' : 'Founding Sitter perk granted — 0% commission 🎉');
    loadData();
  };

  const markPayoutPaid = async (id, amount) => {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('bookings').update({ payout_status: 'paid' }).eq('id', id);
    if (user) await logPayoutMarkedPaid(user.id, id, amount);

    // bookingData/sitterData are read again below (referral bonus check),
    // so they're declared here at function scope, not inside the try block.
    let bookingData, sitterData;

    // TIER 2: Send payout notification to sitter
    try {
      ({ data: bookingData } = await supabase
        .from('bookings')
        .select('sitter_id')
        .eq('id', id)
        .single());

      if (bookingData) {
        ({ data: sitterData } = await supabase
          .from('sitter_profiles')
          .select('user_id, users(name)')
          .eq('id', bookingData.sitter_id)
          .single());

        if (sitterData?.users) {
          const { data: contact } = await supabase.rpc('get_user_contact', { target_id: sitterData.user_id });
          const { notifyPayoutMarked } = await import('./notificationService');
          await notifyPayoutMarked(
            sitterData.user_id, // notifications.user_id is a real users.id FK, not sitter_profiles.id
            contact?.[0]?.email,
            contact?.[0]?.phone,
            amount * 100, // convert to paise
            1, // booking count
            new Date().toLocaleDateString('en-IN')
          );
        }
      }
    } catch(notifErr) { console.error('Payout notification failed:', notifErr); }

    // TIER 3: Check for referral bonuses and send notification
    try {
      const { data: referralBonus } = await supabase
        .from('referral_bonuses')
        .select('id, amount')
        .eq('user_id', sitterData?.user_id) // referral_bonuses.user_id is a real users.id FK, not sitter_profiles.id
        .eq('status', 'pending')
        .single();

      if (referralBonus) {
        const { data: contact } = sitterData?.user_id
          ? await supabase.rpc('get_user_contact', { target_id: sitterData.user_id })
          : { data: null };
        const { notifyReferralBonusPaid } = await import('./notificationService');
        await notifyReferralBonusPaid(
          sitterData?.user_id,
          contact?.[0]?.email,
          contact?.[0]?.phone,
          referralBonus.amount,
          'Someone'
        );
        await supabase.from('referral_bonuses').update({ status: 'paid' }).eq('id', referralBonus.id);
      }
    } catch(referralErr) { console.error('Referral bonus notification failed:', referralErr); }

    showMsg('Payout marked as paid ✓');
    loadData();
  };

  const awardPerformanceBadge = async (sitterId, badgeType) => {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase
      .from('sitter_profiles')
      .update({ performance_badges: [badgeType] })
      .eq('id', sitterId);

    // TIER 3: Send performance badge notification
    try {
      const { data: sitterData } = await supabase
        .from('sitter_profiles')
        .select('users(id)')
        .eq('id', sitterId)
        .single();

      if (sitterData?.users) {
        const { data: contact } = await supabase.rpc('get_user_contact', { target_id: sitterData.users.id });
        const { notifyPerformanceBadge } = await import('./notificationService');
        await notifyPerformanceBadge(
          sitterData.users.id,
          contact?.[0]?.email,
          contact?.[0]?.phone,
          badgeType
        );
      }
    } catch(badgeErr) { console.error('Performance badge notification failed:', badgeErr); }

    showMsg('Performance badge awarded! 🏆');
    loadData();
  };

  // Flat 15% commission for everyone (TermsAndConditions.js #7), except the
  // first 20 launch sitters an admin has marked "Founding Sitter" — they pay
  // 0% until an admin turns it back off (see migration 025).
  const sitterRate = (sitterId) => sitters.find(s => s.id === sitterId)?.is_founding_sitter ? 1 : 0.85;
  const foundingSitterCount = sitters.filter(s => s.is_founding_sitter).length;

  const pendingSitters = sitters.filter(s => s.status === 'pending');
  const activeSitters = sitters.filter(s => s.status === 'active');
  const completedBookings = bookings.filter(b => b.status === 'completed');
  const unpaidPayouts = completedBookings.filter(b => b.payout_status !== 'paid');
  const totalGMV = completedBookings.reduce((sum, b) => sum + (b.gross_amount_paise || 0) / 100, 0);
  const totalPayoutsDue = unpaidPayouts.reduce((sum, b) => sum + (b.gross_amount_paise || 0) / 100 * sitterRate(b.sitter_id), 0);

  if (!authed) return (
    <div style={{ maxWidth: 390, margin: '0 auto', minHeight: '100vh', background: '#0f0f1a', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 24px', fontFamily: 'sans-serif' }}>
      <div style={{ fontSize: 40, marginBottom: 16 }}>🐾</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: 'white', marginBottom: 8 }}>Fursday Admin</div>
      <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginBottom: 32 }}>Enter password to continue</div>
      {error && <div style={{ background: '#FCEBEB', borderRadius: 10, padding: '8px 14px', marginBottom: 12, fontSize: 13, color: '#A32D2D', width: '100%' }}>{error}</div>}
      <input value={password} onChange={e => setPassword(e.target.value)} type="password" placeholder="Admin password"
        onKeyDown={e => e.key === 'Enter' && login()}
        style={{ width: '100%', padding: '14px 16px', borderRadius: 14, border: '1.5px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.06)', fontSize: 15, color: 'white', outline: 'none', marginBottom: 12, boxSizing: 'border-box' }} />
      <button onClick={login}
        style={{ width: '100%', padding: 16, borderRadius: 14, border: 'none', background: ORANGE, color: 'white', fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>
        Sign in
      </button>
    </div>
  );

  if (!adminChecked) return (
    <div style={{ maxWidth: 390, margin: '0 auto', minHeight: '100vh', background: '#0f0f1a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.5)', fontFamily: 'sans-serif' }}>
      Checking admin access...
    </div>
  );

  if (!isRealAdmin) return (
    <div style={{ maxWidth: 390, margin: '0 auto', minHeight: '100vh', background: '#0f0f1a', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 24px', fontFamily: 'sans-serif', textAlign: 'center' }}>
      <div style={{ fontSize: 40, marginBottom: 16 }}>🔒</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: 'white', marginBottom: 8 }}>Not signed in as an admin</div>
      <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 24, lineHeight: 1.6 }}>
        The password got you past the gate, but the database only trusts a real Fursday login marked as admin. Log into the main app with an admin account in this browser, then reload this page.
      </div>
      <button onClick={() => window.location.reload()}
        style={{ padding: '12px 24px', borderRadius: 14, border: 'none', background: ORANGE, color: 'white', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
        Reload
      </button>
      {onBack && (
        <button onClick={onBack}
          style={{ marginTop: 12, padding: '10px 20px', borderRadius: 14, border: 'none', background: 'transparent', color: 'rgba(255,255,255,0.5)', fontSize: 13, cursor: 'pointer' }}>
          ← Back to app
        </button>
      )}
    </div>
  );

  const navItems = [
    { id: 'overview', icon: '📊', label: 'Overview' },
    { id: 'pending', icon: '⏳', label: 'Pending (' + pendingSitters.length + ')' },
    { id: 'sitters', icon: '🧑‍🤝‍🧑', label: 'Sitters (' + sitters.length + ')' },
    { id: 'bookings', icon: '📅', label: 'Bookings (' + bookings.length + ')' },
    { id: 'payouts', icon: '💰', label: 'Payouts (' + unpaidPayouts.length + ')' },
    { id: 'disputes', icon: '⚖️', label: 'Disputes' },
    { id: 'promotions', icon: '🎟️', label: 'Promotions' },
    { id: 'audit', icon: '📜', label: 'Audit' },
  ];
  const activeNavItem = navItems.find(n => n.id === tab);

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#F4F5F7', fontFamily: 'sans-serif' }}>
      {actionMsg && (
        <div style={{ position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', background: '#2E7D32', color: 'white', borderRadius: 12, padding: '10px 20px', fontSize: 13, fontWeight: 600, zIndex: 1000, boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
          {actionMsg}
        </div>
      )}

      {/* Sidebar */}
      <div style={{ width: 220, flexShrink: 0, background: '#13131F', display: 'flex', flexDirection: 'column', padding: '20px 12px', position: 'sticky', top: 0, height: '100vh' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 8px', marginBottom: 24 }}>
          <div style={{ width: 32, height: 32, borderRadius: 10, background: ORANGE, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>🐾</div>
          <span style={{ color: 'white', fontSize: 16, fontWeight: 700 }}>Fursday Admin</span>
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {navItems.map(n => (
            <button key={n.id} onClick={() => setTab(n.id)}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px', borderRadius: 8, border: 'none', marginBottom: 2, background: tab === n.id ? ORANGE : 'transparent', color: tab === n.id ? 'white' : 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: tab === n.id ? 700 : 500, cursor: 'pointer', textAlign: 'left' }}>
              <span>{n.icon}</span><span>{n.label}</span>
            </button>
          ))}
        </div>

        <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {onBack && (
            <button onClick={onBack} style={{ textAlign: 'left', background: 'transparent', border: 'none', borderRadius: 8, padding: '9px 10px', color: 'rgba(255,255,255,0.6)', fontSize: 13, cursor: 'pointer' }}>← Back to app</button>
          )}
          <button onClick={() => setAuthed(false)} style={{ textAlign: 'left', background: 'transparent', border: 'none', borderRadius: 8, padding: '9px 10px', color: 'rgba(255,255,255,0.6)', fontSize: 13, cursor: 'pointer' }}>Sign out</button>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, padding: '24px 28px', overflow: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#1a1a1a' }}>{activeNavItem?.label.replace(/\s*\(\d+\)$/, '')}</div>
          <button onClick={loadData} style={{ background: 'white', border: '1px solid #E8E8E8', borderRadius: 8, padding: '7px 14px', color: '#555', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>↻ Refresh</button>
        </div>

        {loading && <div style={{ textAlign: 'center', padding: 40, color: '#888' }}>Loading...</div>}

        {!loading && tab === 'overview' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14, marginBottom: 20 }}>
              {[
                { label: 'Pending', val: pendingSitters.length, color: '#E65100' },
                { label: 'Active sitters', val: activeSitters.length, color: '#2E7D32' },
                { label: 'Bookings', val: bookings.length, color: '#1565C0' },
                { label: 'GMV', val: 'Rs.' + totalGMV.toLocaleString('en-IN'), color: ORANGE },
                { label: 'Payouts due', val: 'Rs.' + Math.round(totalPayoutsDue).toLocaleString('en-IN'), color: '#C62828' },
              ].map((s, i) => (
                <div key={i} style={{ background: 'white', borderRadius: 12, padding: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                  <div style={{ fontSize: 11, color: '#888', marginBottom: 6 }}>{s.label}</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.val}</div>
                </div>
              ))}
            </div>

            <div style={{ background: 'white', borderRadius: 12, padding: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1a1a', marginBottom: 12 }}>Recent bookings</div>
              {bookings.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 24, color: '#888', fontSize: 13 }}>No bookings yet</div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ color: '#999', textAlign: 'left', borderBottom: '1px solid #F0F0F0' }}>
                      <th style={{ padding: '6px 8px 6px 0', fontWeight: 600 }}>Ref</th>
                      <th style={{ fontWeight: 600 }}>Sitter</th>
                      <th style={{ fontWeight: 600 }}>Service</th>
                      <th style={{ fontWeight: 600 }}>Amount</th>
                      <th style={{ fontWeight: 600 }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bookings.slice(0, 8).map(b => (
                      <tr key={b.id} style={{ borderBottom: '1px solid #F8F8F8' }}>
                        <td style={{ padding: '8px 8px 8px 0', color: '#1a1a1a' }}>{b.booking_ref}</td>
                        <td>{sitters.find(s => s.id === b.sitter_id)?.users?.name || '—'}</td>
                        <td>{b.service_type}</td>
                        <td style={{ fontWeight: 600 }}>Rs.{Math.round((b.gross_amount_paise || 0) / 100)}</td>
                        <td>
                          <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 20, background: BOOKING_COLORS[b.status]?.bg, color: BOOKING_COLORS[b.status]?.color }}>{b.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {!loading && tab === 'pending' && (
          <div>
            {pendingSitters.length === 0 && (
              <div style={{ textAlign: 'center', padding: 40 }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
                <div style={{ fontSize: 16, fontWeight: 600, color: '#1a1a1a' }}>No pending applications</div>
              </div>
            )}
            {pendingSitters.map(s => (
              <div key={s.id} style={{ background: 'white', borderRadius: 18, padding: 16, marginBottom: 12, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: '#1a1a1a' }}>{s.users?.name || 'Unknown'}</div>
                    <div style={{ fontSize: 13, color: '#888' }}>{s.users?.phone} · {s.cities?.name}</div>
                    {s.users?.email && <div style={{ fontSize: 12, color: '#AAA' }}>{s.users?.email}</div>}
                  </div>
                  <div style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: STATUS_COLORS[s.status]?.bg, color: STATUS_COLORS[s.status]?.color, fontWeight: 600 }}>{s.status}</div>
                </div>
                {s.aadhaar_number && <div style={{ fontSize: 12, color: '#1565C0', background: '#E3F2FD', borderRadius: 8, padding: '4px 10px', marginBottom: 8, display: 'inline-block' }}>🪪 Aadhaar: {s.aadhaar_number}</div>}
                {s.upi_id && <div style={{ fontSize: 12, color: '#2E7D32', background: '#E8F5E9', borderRadius: 8, padding: '4px 10px', marginBottom: 8, display: 'inline-block', marginLeft: 6 }}>💳 UPI: {s.upi_id}</div>}
                {s.bio && <div style={{ fontSize: 13, color: '#555', lineHeight: 1.6, marginBottom: 10, padding: '8px 12px', background: '#F8F8F8', borderRadius: 10 }}>{s.bio}</div>}
                {s.sitter_services && s.sitter_services.length > 0 && (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                    {s.sitter_services.map((sv, i) => (
                      <span key={i} style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: '#FFF0EB', color: ORANGE, fontWeight: 500 }}>
                        {sv.service_type} · Rs.{Math.round(sv.price_paise / 100)}
                      </span>
                    ))}
                  </div>
                )}
                <div style={{ fontSize: 11, color: '#AAA', marginBottom: 12 }}>Applied: {new Date(s.created_at).toLocaleDateString('en-IN')}</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => approveSitter(s.id)}
                    style={{ flex: 2, padding: '10px 0', borderRadius: 12, border: 'none', background: '#E8F5E9', color: '#2E7D32', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    <CheckCircle size={16} /> Approve
                  </button>
                  <button onClick={() => requestChanges(s.id)}
                    style={{ flex: 1, padding: '10px 0', borderRadius: 12, border: '1.5px solid #FFCC80', background: 'white', color: '#E65100', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                    Needs changes
                  </button>
                  <button onClick={() => rejectSitter(s.id)}
                    style={{ flex: 1, padding: '10px 0', borderRadius: 12, border: '1.5px solid #FFCDD2', background: 'white', color: '#C62828', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && tab === 'sitters' && (
          <div>
            <div style={{ background: foundingSitterCount >= 20 ? '#FCEBEB' : '#FFF0EB', borderRadius: 12, padding: '10px 14px', marginBottom: 12, fontSize: 12, fontWeight: 600, color: foundingSitterCount >= 20 ? '#A32D2D' : ORANGE }}>
              🎉 Founding Sitters (0% commission): {foundingSitterCount}/20{foundingSitterCount >= 20 ? ' — batch full' : ''}
            </div>
            {sitters.map(s => (
              <div key={s.id} style={{ background: 'white', borderRadius: 16, padding: 14, marginBottom: 10, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a' }}>{s.users?.name || 'Unknown'}</div>
                      {s.is_top_sitter && <span style={{ fontSize: 10, background: '#FFF9C4', color: '#E65100', borderRadius: 10, padding: '2px 8px', fontWeight: 700 }}>⭐ TOP</span>}
                      {s.is_founding_sitter && <span style={{ fontSize: 10, background: '#FFF0EB', color: ORANGE, borderRadius: 10, padding: '2px 8px', fontWeight: 700 }}>🎉 FOUNDING</span>}
                    </div>
                    <div style={{ fontSize: 12, color: '#888' }}>{s.users?.phone} · {s.cities?.name}</div>
                    <div style={{ fontSize: 11, color: '#AAA', marginTop: 2 }}>{s.total_bookings || 0} bookings · UPI: {s.upi_id || 'not set'}</div>
                  </div>
                  <div style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: STATUS_COLORS[s.status]?.bg, color: STATUS_COLORS[s.status]?.color, fontWeight: 600 }}>{s.status}</div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {(s.status === 'pending' || s.status === 'needs_changes') && (
                    <button onClick={() => approveSitter(s.id)}
                      style={{ padding: '5px 12px', borderRadius: 8, border: 'none', background: '#E8F5E9', color: '#2E7D32', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                      ✓ Approve
                    </button>
                  )}
                  {s.status === 'pending' && (
                    <button onClick={() => requestChanges(s.id)}
                      style={{ padding: '5px 12px', borderRadius: 8, border: 'none', background: '#FFF3E0', color: '#E65100', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                      ⚠ Needs changes
                    </button>
                  )}
                  {(s.status === 'active' || s.status === 'suspended') && (
                    <button onClick={() => suspendSitter(s.id, s.status)}
                      style={{ padding: '5px 12px', borderRadius: 8, border: 'none', background: s.status === 'suspended' ? '#E8F5E9' : '#FFF3E0', color: s.status === 'suspended' ? '#2E7D32' : '#E65100', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                      {s.status === 'suspended' ? <><PlayCircle size={12} /> Reinstate</> : <><PauseCircle size={12} /> Suspend</>}
                    </button>
                  )}
                  <button onClick={() => toggleFoundingSitter(s.id, s.is_founding_sitter)}
                    disabled={!s.is_founding_sitter && foundingSitterCount >= 20}
                    style={{ padding: '5px 12px', borderRadius: 8, border: 'none', background: s.is_founding_sitter ? '#FFE0CC' : '#F5F5F5', color: s.is_founding_sitter ? ORANGE : (!s.is_founding_sitter && foundingSitterCount >= 20) ? '#CCC' : '#888', fontSize: 12, fontWeight: 600, cursor: (!s.is_founding_sitter && foundingSitterCount >= 20) ? 'not-allowed' : 'pointer' }}>
                    {s.is_founding_sitter ? '🎉 Remove Founding (0% comm.)' : 'Make Founding Sitter'}
                  </button>
                  <button onClick={() => toggleTopSitter(s.id, s.is_top_sitter)}
                    style={{ padding: '5px 12px', borderRadius: 8, border: 'none', background: s.is_top_sitter ? '#FFF9C4' : '#F5F5F5', color: s.is_top_sitter ? '#E65100' : '#888', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Award size={12} /> {s.is_top_sitter ? 'Remove Top Badge' : 'Give Top Badge'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && tab === 'bookings' && (
          <div>
            {bookings.length === 0 && <div style={{ textAlign: 'center', padding: 40, color: '#888' }}>No bookings yet</div>}
            {bookings.map(b => (
              <div key={b.id} style={{ background: 'white', borderRadius: 16, padding: 14, marginBottom: 10, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a1a' }}>{b.booking_ref}</div>
                  <div style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: BOOKING_COLORS[b.status]?.bg, color: BOOKING_COLORS[b.status]?.color, fontWeight: 600 }}>{b.status}</div>
                </div>
                <div style={{ fontSize: 12, color: '#888' }}>{b.service_type} · {b.cities?.name} · Rs.{Math.round((b.gross_amount_paise || 0) / 100)}</div>
                <div style={{ fontSize: 11, color: '#AAA', marginTop: 4 }}>{new Date(b.created_at).toLocaleDateString('en-IN')} · Payment: {b.payment_status || 'unpaid'}</div>
              </div>
            ))}
          </div>
        )}

        {!loading && tab === 'payouts' && (
          <div>
            <div style={{ background: '#FFF3E0', borderRadius: 14, padding: '12px 16px', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#E65100' }}>{unpaidPayouts.length} payouts pending</div>
                <div style={{ fontSize: 12, color: '#888' }}>Total due to sitters</div>
              </div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#E65100' }}>Rs.{Math.round(totalPayoutsDue).toLocaleString('en-IN')}</div>
            </div>
            {unpaidPayouts.length === 0 && <div style={{ textAlign: 'center', padding: 40, color: '#888' }}>All payouts up to date ✓</div>}
            {unpaidPayouts.map(b => {
              const netAmount = Math.round((b.gross_amount_paise || 0) / 100 * sitterRate(b.sitter_id));
              const isFounding = sitters.find(s => s.id === b.sitter_id)?.is_founding_sitter;
              return (
              <div key={b.id} style={{ background: 'white', borderRadius: 16, padding: 14, marginBottom: 10, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a1a' }}>{b.booking_ref}</div>
                    <div style={{ fontSize: 12, color: '#888' }}>{b.service_type} · Rs.{Math.round((b.gross_amount_paise || 0) / 100)}</div>
                    <div style={{ fontSize: 11, color: '#2E7D32', fontWeight: 600 }}>Sitter gets: Rs.{netAmount}{isFounding ? ' (Founding — 0% commission)' : ''}</div>
                  </div>
                  <button onClick={() => markPayoutPaid(b.id, netAmount)}
                    style={{ padding: '8px 16px', borderRadius: 10, border: 'none', background: '#E8F5E9', color: '#2E7D32', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                    Mark paid
                  </button>
                </div>
                <div style={{ fontSize: 11, color: '#AAA' }}>{new Date(b.created_at).toLocaleDateString('en-IN')}</div>
              </div>
              );
            })}
          </div>
        )}

        {!loading && tab === 'disputes' && <AdminDisputes />}

        {!loading && tab === 'promotions' && <AdminPromotions />}

        {!loading && tab === 'audit' && <AdminAuditLogs />}
      </div>
    </div>
  );
}