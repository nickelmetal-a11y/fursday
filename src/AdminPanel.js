import React, { useState, useEffect } from 'react';
import { supabase } from './supabase';
import { CheckCircle, XCircle, Award, PauseCircle, PlayCircle } from 'lucide-react';
import AdminAuditLogs from './AdminAuditLogs';
import AdminDisputes from './AdminDisputes';
import { logSitterApproved, logSitterRejected, logSitterSuspended, logTopSitterToggled, logPayoutMarkedPaid } from './auditService';

const ADMIN_PASSWORD = process.env.REACT_APP_ADMIN_PASSWORD || '';
const ORANGE = '#FF6B35';

const STATUS_COLORS = {
  pending: { bg: '#FFF3E0', color: '#E65100' },
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

export default function AdminPanel() {
  const [authed, setAuthed] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
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
      .select('*, users(name, phone, email), cities(name), sitter_services(service_type, price_paise)')
      .order('created_at', { ascending: false });
    setSitters(s || []);
    const { data: b } = await supabase
      .from('bookings')
      .select('*, cities(name)')
      .order('created_at', { ascending: false })
      .limit(100);
    setBookings(b || []);
    setLoading(false);
  };

  useEffect(() => { if (authed) loadData(); }, [authed]);

  const notifyAdminAction = async (sitterId, actionType, details) => {
    try {
      const { data: sitterData } = await supabase
        .from('sitter_profiles')
        .select('users(id, email, phone)')
        .eq('id', sitterId)
        .single();

      if (sitterData?.users) {
        const { notifyAdminAction: notifyAction } = await import('./notificationService');
        await notifyAction(sitterData.users.id, sitterData.users.email, sitterData.users.phone, actionType, details);
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
        .select('users(id, email, phone, name)')
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

  const rejectSitter = async (id) => {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('sitter_profiles').update({ status: 'rejected' }).eq('id', id);
    if (user) await logSitterRejected(user.id, id);

    // TIER 2: Send rejection notification
    try {
      const { data: sitterData } = await supabase
        .from('sitter_profiles')
        .select('users(id, email)')
        .eq('id', id)
        .single();

      if (sitterData?.users) {
        const { notifySitterRejected } = await import('./notificationService');
        await notifySitterRejected(
          sitterData.users.id,
          sitterData.users.email,
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
          .select('users(id, email, phone)')
          .eq('id', id)
          .single();

        if (sitterData?.users) {
          const { notifySitterSuspended } = await import('./notificationService');
          await notifySitterSuspended(
            sitterData.users.id,
            sitterData.users.email,
            sitterData.users.phone,
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
          .select('users(id, email, phone)')
          .eq('id', id)
          .single();

        if (sitterData?.users) {
          const { notifyTopSitterAwarded } = await import('./notificationService');
          await notifyTopSitterAwarded(
            sitterData.users.id,
            sitterData.users.email,
            sitterData.users.phone
          );
        }
      } catch(notifErr) { console.error('Top Sitter notification failed:', notifErr); }
    }

    showMsg(current ? 'Top Sitter badge removed' : 'Top Sitter badge awarded ⭐');
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
          .select('users(email, phone, name)')
          .eq('id', bookingData.sitter_id)
          .single());

        if (sitterData?.users) {
          const { notifyPayoutMarked } = await import('./notificationService');
          await notifyPayoutMarked(
            bookingData.sitter_id,
            sitterData.users.email,
            sitterData.users.phone,
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
        .eq('user_id', bookingData.sitter_id)
        .eq('status', 'pending')
        .single();

      if (referralBonus) {
        const { notifyReferralBonusPaid } = await import('./notificationService');
        await notifyReferralBonusPaid(
          bookingData.sitter_id,
          sitterData?.users?.email,
          sitterData?.users?.phone,
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
        .select('users(id, email, phone)')
        .eq('id', sitterId)
        .single();

      if (sitterData?.users) {
        const { notifyPerformanceBadge } = await import('./notificationService');
        await notifyPerformanceBadge(
          sitterData.users.id,
          sitterData.users.email,
          sitterData.users.phone,
          badgeType
        );
      }
    } catch(badgeErr) { console.error('Performance badge notification failed:', badgeErr); }

    showMsg('Performance badge awarded! 🏆');
    loadData();
  };

  const pendingSitters = sitters.filter(s => s.status === 'pending');
  const activeSitters = sitters.filter(s => s.status === 'active');
  const completedBookings = bookings.filter(b => b.status === 'completed');
  const unpaidPayouts = completedBookings.filter(b => b.payout_status !== 'paid');
  const totalGMV = completedBookings.reduce((sum, b) => sum + (b.gross_amount_paise || 0) / 100, 0);
  const totalPayoutsDue = unpaidPayouts.reduce((sum, b) => sum + (b.gross_amount_paise || 0) / 100 * 0.85, 0);

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

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', minHeight: '100vh', background: '#F8F8F8', fontFamily: 'sans-serif' }}>
      {actionMsg && (
        <div style={{ position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', background: '#2E7D32', color: 'white', borderRadius: 12, padding: '10px 20px', fontSize: 13, fontWeight: 600, zIndex: 1000, boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
          {actionMsg}
        </div>
      )}

      <div style={{ background: '#0f0f1a', padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 10, background: ORANGE, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🐾</div>
          <span style={{ color: 'white', fontSize: 18, fontWeight: 700 }}>Fursday Admin</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={loadData} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 8, padding: '6px 14px', color: 'white', fontSize: 13, cursor: 'pointer' }}>Refresh</button>
          <button onClick={() => setAuthed(false)} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 8, padding: '6px 14px', color: 'white', fontSize: 13, cursor: 'pointer' }}>Sign out</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, padding: '20px 20px 0' }}>
        {[
          { label: 'Pending', val: pendingSitters.length, color: '#E65100' },
          { label: 'Active sitters', val: activeSitters.length, color: '#2E7D32' },
          { label: 'Bookings', val: bookings.length, color: '#1565C0' },
          { label: 'GMV', val: 'Rs.' + totalGMV.toLocaleString('en-IN'), color: ORANGE },
          { label: 'Payouts due', val: 'Rs.' + Math.round(totalPayoutsDue).toLocaleString('en-IN'), color: '#C62828' },
        ].map((s, i) => (
          <div key={i} style={{ background: 'white', borderRadius: 14, padding: '14px 12px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', textAlign: 'center' }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: s.color }}>{s.val}</div>
            <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ padding: '16px 20px 0' }}>
        <div style={{ display: 'flex', gap: 4, background: 'white', borderRadius: 12, padding: 4, marginBottom: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', overflowX: 'auto' }}>
          {[
            { id: 'pending', label: 'Pending (' + pendingSitters.length + ')' },
            { id: 'sitters', label: 'Sitters (' + sitters.length + ')' },
            { id: 'bookings', label: 'Bookings (' + bookings.length + ')' },
            { id: 'payouts', label: 'Payouts (' + unpaidPayouts.length + ')' },
            { id: 'disputes', label: 'Disputes' },
            { id: 'audit', label: 'Audit' },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{ padding: '8px 12px', borderRadius: 9, border: 'none', background: tab === t.id ? ORANGE : 'transparent', color: tab === t.id ? 'white' : '#888', fontSize: 11, fontWeight: tab === t.id ? 700 : 400, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
              {t.label}
            </button>
          ))}
        </div>

        {loading && <div style={{ textAlign: 'center', padding: 40, color: '#888' }}>Loading...</div>}

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
            {sitters.map(s => (
              <div key={s.id} style={{ background: 'white', borderRadius: 16, padding: 14, marginBottom: 10, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a' }}>{s.users?.name || 'Unknown'}</div>
                      {s.is_top_sitter && <span style={{ fontSize: 10, background: '#FFF9C4', color: '#E65100', borderRadius: 10, padding: '2px 8px', fontWeight: 700 }}>⭐ TOP</span>}
                    </div>
                    <div style={{ fontSize: 12, color: '#888' }}>{s.users?.phone} · {s.cities?.name}</div>
                    <div style={{ fontSize: 11, color: '#AAA', marginTop: 2 }}>{s.total_bookings || 0} bookings · UPI: {s.upi_id || 'not set'}</div>
                  </div>
                  <div style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: STATUS_COLORS[s.status]?.bg, color: STATUS_COLORS[s.status]?.color, fontWeight: 600 }}>{s.status}</div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {s.status === 'pending' && (
                    <button onClick={() => approveSitter(s.id)}
                      style={{ padding: '5px 12px', borderRadius: 8, border: 'none', background: '#E8F5E9', color: '#2E7D32', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                      ✓ Approve
                    </button>
                  )}
                  {(s.status === 'active' || s.status === 'suspended') && (
                    <button onClick={() => suspendSitter(s.id, s.status)}
                      style={{ padding: '5px 12px', borderRadius: 8, border: 'none', background: s.status === 'suspended' ? '#E8F5E9' : '#FFF3E0', color: s.status === 'suspended' ? '#2E7D32' : '#E65100', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                      {s.status === 'suspended' ? <><PlayCircle size={12} /> Reinstate</> : <><PauseCircle size={12} /> Suspend</>}
                    </button>
                  )}
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
                <div style={{ fontSize: 12, color: '#888' }}>Total due to sitters (85%)</div>
              </div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#E65100' }}>Rs.{Math.round(totalPayoutsDue).toLocaleString('en-IN')}</div>
            </div>
            {unpaidPayouts.length === 0 && <div style={{ textAlign: 'center', padding: 40, color: '#888' }}>All payouts up to date ✓</div>}
            {unpaidPayouts.map(b => (
              <div key={b.id} style={{ background: 'white', borderRadius: 16, padding: 14, marginBottom: 10, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a1a' }}>{b.booking_ref}</div>
                    <div style={{ fontSize: 12, color: '#888' }}>{b.service_type} · Rs.{Math.round((b.gross_amount_paise || 0) / 100)}</div>
                    <div style={{ fontSize: 11, color: '#2E7D32', fontWeight: 600 }}>Sitter gets: Rs.{Math.round((b.gross_amount_paise || 0) / 100 * 0.85)}</div>
                  </div>
                  <button onClick={() => markPayoutPaid(b.id, Math.round((b.gross_amount_paise || 0) / 100))}
                    style={{ padding: '8px 16px', borderRadius: 10, border: 'none', background: '#E8F5E9', color: '#2E7D32', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                    Mark paid
                  </button>
                </div>
                <div style={{ fontSize: 11, color: '#AAA' }}>{new Date(b.created_at).toLocaleDateString('en-IN')}</div>
              </div>
            ))}
          </div>
        )}

        {!loading && tab === 'disputes' && <AdminDisputes />}

        {!loading && tab === 'audit' && <AdminAuditLogs />}
      </div>
    </div>
  );
}