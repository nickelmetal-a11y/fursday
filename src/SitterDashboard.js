import React, { useState, useEffect } from 'react';
import { supabase } from './supabase';
import PhotoUploadModal from './PhotoUploadModal';
import { useSupportContact, openWhatsAppSupport } from './supportContact';
import { useLanguage } from './i18n';
import SosSheet from './SosSheet';
import DisputeForm from './DisputeForm';
import { color, font, radius, ui, statusTone, navPadding } from './theme';
import Icon from './ui/Icon';
import { messagePreview } from './InboxScreen';
import LanguageToggle from './LanguageToggle';

const SERVICE_NAME_KEYS = {
  walk30: 'service_walk',
  boarding: 'service_boarding',
  daycare: 'service_daycare',
  dropin: 'service_dropin',
  housesit: 'service_housesit',
};

const SERVICE_ICONS = {
  walk30: 'walk',
  boarding: 'boarding',
  daycare: 'sun',
  dropin: 'bell',
  housesit: 'home',
};

const STATUS_LABEL_KEYS = {
  pending: 'sitter_statusNew',
  confirmed: 'bookings_statusConfirmed',
  active: 'bookings_statusActive',
  completed: 'bookings_statusCompleted',
  cancelled: 'bookings_statusCancelled',
};

const money = { fontVariantNumeric: 'tabular-nums' };

export default function SitterDashboard({ onBack, city, onStartWalk, onMessage, onEditProfile, onOpenNotifications }) {
  const { whatsapp: supportWa, phone: supportPhone } = useSupportContact();
  const { t: tr, lang } = useLanguage();
  const [tab, setTab] = useState('new');
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sitterProfile, setSitterProfile] = useState(null);
  const [expanded, setExpanded] = useState(null);
  const [unreadMessages, setUnreadMessages] = useState([]);
  const [broadcastRequests, setBroadcastRequests] = useState([]);
  const [otpEntry, setOtpEntry] = useState({});
  const [otpError, setOtpError] = useState({});
  const [arrivalStatus, setArrivalStatus] = useState({});
  const [uploadingPhotosFor, setUploadingPhotosFor] = useState(null);
  const [sosFor, setSosFor] = useState(null);
  const [reportingBooking, setReportingBooking] = useState(null);

  const loadUnreadMessages = async () => {
    if (!sitterProfile || bookings.length === 0) { setUnreadMessages([]); return; }
    const { data } = await supabase
      .from('messages')
      .select('*, bookings(booking_ref, service_type)')
      .in('booking_id', bookings.map(b => b.id))
      .eq('sender_type', 'parent')
      .eq('read', false)
      .order('created_at', { ascending: false })
      .limit(5);
    setUnreadMessages(data || []);
  };

  const loadData = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from('sitter_profiles')
        .select('*, users(name)')
        .eq('user_id', user.id)
        .single();
      if (profile) {
        const { data: ownContact } = await supabase.rpc('get_user_contact', { target_id: user.id });
        profile.users = { ...profile.users, phone: ownContact?.[0]?.phone, email: ownContact?.[0]?.email };
      }
      setSitterProfile(profile);

      if (profile) {
        const { data: bkgs } = await supabase
          .from('bookings')
          .select('*, users(name)')
          .eq('sitter_id', profile.id)
          .order('created_at', { ascending: false });
        const bkgsWithContact = await Promise.all((bkgs || []).map(async (b) => {
          if (!b.pet_parent_id) return b;
          const { data: contact } = await supabase.rpc('get_user_contact', { target_id: b.pet_parent_id });
          return { ...b, users: { ...b.users, phone: contact?.[0]?.phone, email: contact?.[0]?.email } };
        }));
        setBookings(bkgsWithContact);

        if (profile.status !== 'active') { setBroadcastRequests([]); setLoading(false); return; }
        const { data: reqs } = await supabase
          .from('broadcast_requests')
          .select('*, users(name)')
          .eq('city_id', profile.city_id)
          .eq('status', 'open')
          .order('created_at', { ascending: false });
        setBroadcastRequests(reqs || []);
      }
    }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    if (sitterProfile) loadUnreadMessages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sitterProfile, bookings]);

  const markArrival = async (b, status) => {
    if (!b.pet_parent_id) return;
    try {
      const { notifySitterArriving } = await import('./notificationService');
      await notifySitterArriving(b.pet_parent_id, sitterProfile?.users?.name || 'Your sitter', status);
      setArrivalStatus(prev => ({ ...prev, [b.id]: status }));
    } catch (err) { alert(tr('sitter_errSendUpdate') + (err.message || err)); }
  };

  const notifyParent = async (b, type, title, body) => {
    try {
      const { createNotification } = await import('./notificationService');
      await createNotification(b.pet_parent_id, type, title, body);
    } catch (e) { console.error('Parent notification failed:', e); }
  };
  const sitterName = () => sitterProfile?.users?.name || tr('sitter_yourSitter');

  const acceptBooking = async (b) => {
    const { error } = await supabase.from('bookings').update({ status: 'confirmed' }).eq('id', b.id);
    if (error) { alert(tr('sitter_errAccept') + error.message); return; }
    await notifyParent(b, 'booking_accepted', '✅ ' + sitterName() + ' accepted your booking', 'Pay now to lock in ' + (b.booking_date || 'your date') + ' ' + (b.time_slot || '') + '.');
    loadData();
  };

  const declineBooking = async (b) => {
    const { error } = await supabase.from('bookings').update({ status: 'cancelled', cancellation_reason: 'Declined by sitter', cancelled_at: new Date().toISOString() }).eq('id', b.id);
    if (error) { alert(tr('sitter_errDecline') + error.message); return; }
    await notifyParent(b, 'booking_declined', sitterName() + ' could not take this booking', 'Try another sitter in Explore, or post a request to all sitters.');
    loadData();
  };

  // A sitter cancelling an accepted job always refunds the parent in full (Terms section 3).
  const sitterCancel = async (b) => {
    const reason = window.prompt(tr('sitter_cancelPrompt'));
    if (!reason) return;
    const paid = b.payment_status === 'paid';
    const { error } = await supabase.from('bookings').update({
      status: 'cancelled', cancellation_reason: 'Sitter: ' + reason, cancelled_at: new Date().toISOString(),
      refund_percentage: paid ? 100 : 0, refund_amount_paise: paid ? (b.gross_amount_paise || 0) : 0,
    }).eq('id', b.id);
    if (error) { alert(tr('sitter_errCancel') + error.message); return; }
    await notifyParent(b, 'booking_cancelled', sitterName() + ' cancelled the booking', reason + (paid ? ' You will get a full refund.' : ''));
    loadData();
  };

  const newBookings = bookings.filter(b => b.status === 'pending');
  const confirmedBookings = bookings.filter(b => b.status === 'confirmed');
  const activeBookings = bookings.filter(b => b.status === 'active');
  const pastBookings = bookings.filter(b => ['completed','cancelled'].includes(b.status));

  const tabBookings = tab === 'new' ? newBookings :
                      tab === 'upcoming' ? confirmedBookings :
                      tab === 'active' ? activeBookings : pastBookings;

  // Same net figure as the Earnings tab: after commission, this calendar month only.
  const commissionRate = sitterProfile?.is_founding_sitter ? 0 : 0.15;
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const totalEarnings = Math.round(bookings
    .filter(b => b.status === 'completed' && new Date(b.completed_at || b.booking_date || b.created_at) >= monthStart)
    .reduce((sum, b) => sum + (b.gross_amount_paise || 0) / 100 * (1 - commissionRate), 0));

  const verifyStartOtp = async (booking) => {
    const entered = (otpEntry[booking.id] || '').trim();
    if (entered !== booking.start_otp) {
      setOtpError({ ...otpError, [booking.id]: tr('sitter_wrongOtp') });
      return;
    }
    const { error: startError } = await supabase.from('bookings').update({ status:'active', start_verified_at:new Date().toISOString() }).eq('id', booking.id);
    if (startError) {
      setOtpError({ ...otpError, [booking.id]: tr('sitter_errStart') + startError.message });
      return;
    }
    setOtpError({ ...otpError, [booking.id]: null });
    setOtpEntry({ ...otpEntry, [booking.id]: '' });

    // TIER 2: Send walk started notification to both parties
    try {
      const { notifyWalkStarted } = await import('./notificationService');
      const { data: petData } = await supabase.from('pet_profiles').select('name').eq('id', booking.pet_id).single();
      const { data: parentContact } = await supabase.rpc('get_user_contact', { target_id: booking.pet_parent_id });
      const parentData = parentContact?.[0];

      await notifyWalkStarted(
        sitterProfile?.user_id,
        sitterProfile?.users?.phone,
        booking.pet_parent_id,
        parentData?.phone,
        petData?.name || 'Your pet',
        sitterProfile?.users?.name || 'Sitter'
      );
    } catch(notifErr) { console.error('Walk start notification failed:', notifErr); }

    loadData();
  };

  const completeWithOtp = async (booking) => {
    const { error: completeError } = await supabase.from('bookings').update({ status:'completed', end_verified_at:['boarding','daycare'].includes(booking.service_type)?null:new Date().toISOString() }).eq('id', booking.id);
    if (completeError) { alert(tr('sitter_errComplete') + completeError.message); return; }

    // TIER 2: Send walk completed notification to both parties
    try {
      const { notifyWalkCompleted } = await import('./notificationService');
      const { data: parentContact } = await supabase.rpc('get_user_contact', { target_id: booking.pet_parent_id });
      const parentData = parentContact?.[0];
      const { data: petData } = await supabase.from('pet_profiles').select('name').eq('id', booking.pet_id).single();

      await notifyWalkCompleted(
        sitterProfile?.user_id,
        sitterProfile?.users?.email,
        sitterProfile?.users?.phone,
        booking.pet_parent_id,
        parentData?.email,
        parentData?.phone,
        petData?.name || 'Your pet',
        sitterProfile?.users?.name || 'Sitter'
      );
    } catch(notifErr) { console.error('Walk complete notification failed:', notifErr); }

    loadData();
  };

  const acceptBroadcast = async (req) => {
    const { data: { user } } = await supabase.auth.getUser();
    const { data: profile } = await supabase.from('sitter_profiles').select('id, status').eq('user_id', user.id).single();
    if (!profile || profile.status !== 'active') { alert(tr('sitter_notApprovedYet')); return; }
    const { data: ownService } = await supabase.from('sitter_services').select('price_paise').eq('sitter_id', profile.id).eq('service_type', req.service_type).maybeSingle();
    const fallback = { walk30: 34900, boarding: 84900, daycare: 64900 };
    const { error } = await supabase.from('broadcast_responses').insert({
      request_id: req.id,
      sitter_id: profile.id,
      status: 'accepted',
      offered_price: ownService?.price_paise || fallback[req.service_type] || 34900,
    });
    if (error) { alert(tr('sitter_errRespond') + error.message); return; }
    setBroadcastRequests(prev => prev.filter(r => r.id !== req.id));
    alert(tr('sitter_responseSent'));
  };

  const serviceName = (type) => SERVICE_NAME_KEYS[type] ? tr(SERVICE_NAME_KEYS[type]) : type;
  const isDropOff = (b) => ['boarding','daycare'].includes(b.service_type);
  const fullWidth = { width: '100%', marginTop: 10 };
  const metaRow = { display: 'flex', alignItems: 'center', gap: 6, fontSize: font.sm, color: color.text };
  const notice = (tone) => ({ marginTop: 12, background: color[tone + 'Soft'], color: color[tone], borderRadius: radius.md, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8, fontSize: font.sm, fontWeight: 600, lineHeight: 1.4 });

  // Called as a plain function (not <BookingCard/>) so typing in the OTP box
  // doesn't remount the card and drop keyboard focus on every keystroke.
  const renderBookingCard = (b) => {
    const isOpen = expanded === b.id;
    const toggle = () => setExpanded(isOpen ? null : b.id);
    const borderColor = b.status === 'pending' ? color.navy : b.status === 'active' ? color.success : color.line;
    const arrival = arrivalStatus[b.id];
    const otpLabel = isDropOff(b) ? tr('enterOtpTitleDrop') : tr('enterOtpTitleWalk');
    return (
      <div key={b.id} style={{ background: color.surface, borderRadius: 20, marginBottom: 12, border: `1px solid ${borderColor}`, overflow: 'hidden' }}>
        <div role="button" tabIndex={0} aria-expanded={isOpen} aria-label={tr('sitter_toggleDetails')}
          onClick={toggle}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } }}
          style={{ padding: 16, cursor: 'pointer' }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <div style={{ ...ui.iconTile, width: 44, height: 44 }}><Icon name={SERVICE_ICONS[b.service_type] || 'paw'} size={22} /></div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: font.md, fontWeight: 700, color: color.ink, lineHeight: 1.3 }}>{serviceName(b.service_type)}</div>
              <div style={{ fontSize: font.sm, color: color.muted, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.users?.name || tr('sitter_petParent')}</div>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ ...money, fontSize: font.lg, fontWeight: 700, color: color.ink }}>Rs.{Math.round((b.gross_amount_paise || 0) / 100)}</div>
              <span style={{ ...ui.badge(statusTone[b.status] || 'warning'), marginTop: 4 }}>{tr(STATUS_LABEL_KEYS[b.status] || STATUS_LABEL_KEYS.pending)}</span>
            </div>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 16px', marginTop: 12, paddingLeft: 56 }}>
            <div style={metaRow}>
              <Icon name="calendar" size={15} color={color.muted} />
              <span>{b.booking_date || tr('sitter_tbd')}</span>
            </div>
            <div style={metaRow}>
              <Icon name="clock" size={15} color={color.muted} />
              <span>{b.time_slot || tr('sitter_tbd')}</span>
            </div>
          </div>
          {b.status === 'pending' && (
            <div style={notice('warning')}>
              <Icon name="clock" size={16} />
              <span>{tr('newBookingBanner')}</span>
            </div>
          )}
          {b.status === 'active' && (
            <div style={notice('success')}>
              <Icon name="walk" size={16} />
              <span>{tr('walkInProgress')}</span>
            </div>
          )}
        </div>
        <div style={{ padding: '0 16px 16px' }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={(e) => { e.stopPropagation(); onMessage && onMessage(b); }}
                style={{ ...ui.secondaryButton, flex: 1, minHeight: 44, fontSize: font.md }}>
                <Icon name="message" size={18} /> {tr('message')}
              </button>
              {b.users?.phone && (
                <a onClick={(e) => e.stopPropagation()} href={'tel:' + b.users.phone}
                  style={{ ...ui.secondaryButton, flex: 1, minHeight: 44, fontSize: font.md, textDecoration: 'none', boxSizing: 'border-box' }}>
                  <Icon name="phone" size={18} /> {tr('call')}
                </a>
              )}
            </div>
            {b.status === 'pending' && (
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <button onClick={() => acceptBooking(b)}
                  style={{ ...ui.primaryButton, flex: 2, minHeight: 44 }}>
                  {tr('accept')} ✓
                </button>
                <button onClick={() => declineBooking(b)}
                  style={{ ...ui.dangerButton, flex: 1 }}>
                  {tr('decline')}
                </button>
              </div>
            )}
            {b.status === 'confirmed' && (
              <div style={{ marginTop: 12, background: color.bg, border: `1px solid ${color.line}`, borderRadius: radius.md, padding: 14 }}>
                <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                  <button onClick={() => markArrival(b, 'on_way')} disabled={!!arrival}
                    style={{ ...ui.secondaryButton, flex: 1, minHeight: 44, padding: '0 8px', fontSize: font.sm, border: `1px solid ${arrival === 'on_way' ? color.navy : color.line}`, background: arrival === 'on_way' ? color.navy : color.surface, color: arrival === 'on_way' ? color.surface : color.navy, cursor: arrival ? 'default' : 'pointer' }}>
                    <Icon name="walk" size={16} />{tr('onMyWay')}
                  </button>
                  <button onClick={() => markArrival(b, 'arrived')} disabled={arrival === 'arrived'}
                    style={{ ...ui.secondaryButton, flex: 1, minHeight: 44, padding: '0 8px', fontSize: font.sm, border: `1px solid ${arrival === 'arrived' ? color.success : color.line}`, background: arrival === 'arrived' ? color.success : color.surface, color: arrival === 'arrived' ? color.surface : color.success, cursor: arrival === 'arrived' ? 'default' : 'pointer' }}>
                    <Icon name="pin" size={16} />{tr('arrived')}
                  </button>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: font.md, fontWeight: 600, color: color.ink, marginBottom: 4 }}>
                  <Icon name="key" size={16} color={color.navy} />
                  <span>{otpLabel}</span>
                </div>
                <div style={{ fontSize: font.sm, color: color.muted, marginBottom: 10, lineHeight: 1.5 }}>{tr('otpHint', { name: b.users?.name || tr('sitter_thePetParent') })}</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input value={otpEntry[b.id] || ''} onChange={e => setOtpEntry({ ...otpEntry, [b.id]: e.target.value.replace(/\D/g,'').slice(0,4) })}
                    placeholder="0000" inputMode="numeric" maxLength={4} aria-label={otpLabel}
                    style={{ ...ui.input, flex: 1, minWidth: 0, fontSize: font.xl, fontWeight: 600, letterSpacing: 8, textAlign: 'center', ...money }} />
                  <button onClick={() => verifyStartOtp(b)}
                    style={{ ...ui.primaryButton, minHeight: 48, padding: '0 22px', flexShrink: 0 }}>{tr('start')}</button>
                </div>
                {otpError[b.id] && <div role="alert" style={{ fontSize: font.sm, color: color.danger, marginTop: 8 }}>{otpError[b.id]}</div>}
                <button onClick={(e) => { e.stopPropagation(); sitterCancel(b); }}
                  style={{ ...ui.dangerButton, width: '100%', marginTop: 14 }}>
                  {tr('sitter_cancelJob')}
                </button>
              </div>
            )}
            {b.status === 'active' && (
              <div style={{ marginTop: 10 }}>
                {(supportPhone || supportWa) && (
                  <button onClick={(e) => { e.stopPropagation(); setSosFor(b); }}
                    style={{ ...ui.primaryButton, width: '100%', minHeight: 44, background: color.danger, fontSize: font.md, marginBottom: 10 }}>
                    {tr('sos')}
                  </button>
                )}
                {isDropOff(b) ? (
                  <div style={{ background: color.successSoft, borderRadius: radius.md, padding: 14 }}>
                    <div style={{ fontSize: font.md, fontWeight: 600, color: color.success, marginBottom: 4 }}>{tr('pickupOtpTitle')}</div>
                    <div style={{ fontSize: font.sm, color: color.text, marginBottom: 10, lineHeight: 1.5 }}>{tr('pickupOtpHint', { name: b.users?.name || tr('sitter_theParent') })}</div>
                    <div style={{ ...money, background: color.surface, borderRadius: radius.md, padding: 10, textAlign: 'center', fontSize: font.xxl, fontWeight: 700, letterSpacing: 8, color: color.success, marginBottom: 10 }}>{b.end_otp || '----'}</div>
                    <button onClick={() => completeWithOtp(b)}
                      style={{ ...ui.primaryButton, width: '100%', minHeight: 44 }}>
                      {tr('parentCollected')}
                    </button>
                  </div>
                ) : (
                  <button onClick={() => completeWithOtp(b)}
                    style={{ ...ui.primaryButton, width: '100%' }}>
                    {tr('completeWalk')}
                  </button>
                )}
              </div>
            )}
            {b.status === 'completed' && !b.sitter_uploaded_photos && (
              <button onClick={() => setUploadingPhotosFor(b)}
                style={{ ...ui.primaryButton, ...fullWidth }}>
                {tr('uploadPhotos')}
              </button>
            )}
            {b.status === 'completed' && b.sitter_uploaded_photos && (
              <div style={{ ...notice('success'), justifyContent: 'center', marginTop: 10 }}>
                <span>{tr('photosUploaded')}</span>
              </div>
            )}
            {['confirmed','active','completed'].includes(b.status) && (
              <button onClick={(e) => { e.stopPropagation(); setReportingBooking(b); }}
                style={{ ...fullWidth, minHeight: 44, borderRadius: radius.md, border: 'none', background: 'none', color: color.muted, fontSize: font.sm, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                {tr('sitter_reportProblem')}
              </button>
            )}
            {isOpen && (
              <div style={{ marginTop: 8, borderTop: `1px solid ${color.line}`, paddingTop: 10 }}>
                <div style={{ fontSize: font.xs, color: color.muted, marginBottom: 4, fontWeight: 600, letterSpacing: 0.4, textTransform: 'uppercase' }}>{tr('sitter_details')}</div>
                {[
                  { label: tr('sitter_detailRef'), val: b.booking_ref },
                  { label: tr('sitter_petParent'), val: b.users?.name },
                  { label: tr('sitter_detailNotes'), val: b.parent_notes || tr('sitter_detailNone') },
                  { label: tr('sitter_detailPayment'), val: b.payment_status === 'paid' ? tr('sitter_paid') : tr('sitter_unpaid') },
                ].filter(x => x.val).map((x, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '8px 0', borderTop: i ? `1px solid ${color.line}` : 'none' }}>
                    <span style={{ fontSize: font.sm, color: color.muted, flexShrink: 0 }}>{x.label}</span>
                    <span style={{ fontSize: font.sm, color: color.ink, fontWeight: 600, textAlign: 'right', wordBreak: 'break-word' }}>{x.val}</span>
                  </div>
                ))}
              </div>
            )}
        </div>
      </div>
    );
  };

  const completedCount = bookings.filter(b => b.status === 'completed').length;
  const tierLabel = (() => { const w = completedCount; if (w >= 300) return tr('sitter_tierElite'); if (w >= 150) return tr('sitter_tierPlatinum'); if (w >= 75) return tr('sitter_tierGold'); if (w >= 25) return tr('sitter_tierSilver'); return tr('sitter_tierBronze'); })();
  // Status badges only (Bronze/Silver/Gold/.../Elite Pro) — these are
  // recognition tiers, not commission tiers. Fursday charges a flat 15%
  // commission on every booking regardless of tier; see
  // TermsAndConditions.js #7. A commission reduction promise doesn't belong
  // here unless it's actually wired to payout math.
  const tiers = [{ max: 25, next: tr('sitter_nextSilver') }, { max: 75, next: tr('sitter_nextGold') }, { max: 150, next: tr('sitter_nextPlatinum') }, { max: 300, next: tr('sitter_nextElite') }];
  const tier = tiers.find(x => completedCount < x.max);
  const prevTier = tiers[tiers.indexOf(tier) - 1];
  const tierMin = prevTier ? prevTier.max : 0;
  const tierPct = tier ? Math.min(100, Math.round((completedCount - tierMin) / (tier.max - tierMin) * 100)) : 100;
  const isLive = sitterProfile?.status === 'active';

  const emptyIcon = tab === 'new' ? 'briefcase' : tab === 'upcoming' ? 'calendar' : tab === 'active' ? 'walk' : 'check';
  const emptyState = (icon, title, hint) => (
    <div style={{ ...ui.card, textAlign: 'center', padding: '28px 20px' }}>
      <div style={{ ...ui.iconTile, margin: '0 auto 12px' }}><Icon name={icon} /></div>
      <div style={{ fontSize: font.md, fontWeight: 600, color: color.ink, marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: font.sm, color: color.muted, lineHeight: 1.6 }}>{hint}</div>
    </div>
  );

  return (
    <div style={{ ...ui.page, paddingBottom: navPadding }}>
      {sosFor && <SosSheet onClose={() => setSosFor(null)} bookingRef={sosFor.booking_ref} userName={sitterProfile?.users?.name} />}
      {reportingBooking && (
        <DisputeForm booking={reportingBooking} reporterRole="sitter" otherName={reportingBooking.users?.name || tr('sitter_petParent')}
          onClose={() => setReportingBooking(null)} onDisputeFiled={() => setReportingBooking(null)} />
      )}

      <header style={{ background: color.navy, color: color.surface, padding: 'calc(16px + env(safe-area-inset-top)) 16px 18px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: font.xs, fontWeight: 600, letterSpacing: 0.5, textTransform: 'uppercase', color: color.faint }}>{tr('jobsNav')}</div>
            <div style={{ fontSize: font.xl, fontWeight: 700, marginTop: 2, lineHeight: 1.3 }}>{tr('greeting')}, {sitterProfile?.users?.name?.split(' ')[0] || tr('sitter_there')} 👋</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
              <span style={ui.badge(isLive ? 'success' : 'warning')}>{isLive ? tr('live') : tr('pendingApproval')}</span>
              <span style={{ ...ui.badge('warning'), background: color.saffronSoft }}>{tierLabel}</span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <LanguageToggle inline />
          {onOpenNotifications && (
            <button type="button" aria-label={tr('nav_notifications')} onClick={onOpenNotifications}
              style={{ width: 40, height: 40, borderRadius: radius.pill, border: 'none', background: color.navyHover, color: color.surface, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
              <Icon name="bell" size={19} />
            </button>
          )}
          </div>
        </div>

        <div style={{ marginTop: 18 }}>
          <div style={{ fontSize: font.sm, color: color.faint }}>{tr('thisMonth')}</div>
          <div style={{ ...money, fontSize: 28, fontWeight: 700, letterSpacing: -0.3, marginTop: 2 }}>Rs.{totalEarnings.toLocaleString('en-IN')}</div>
          <div style={{ fontSize: font.xs, color: color.faint, marginTop: 2 }}>{tr('payoutNote')}</div>
        </div>

        <div style={{ marginTop: 14 }}>
          <div style={{ background: color.navyHover, borderRadius: radius.pill, height: 6 }}>
            <div style={{ width: tierPct + '%', background: color.saffron, borderRadius: radius.pill, height: 6 }} />
          </div>
          <div style={{ fontSize: font.xs, color: color.faint, marginTop: 6 }}>
            {tier ? tr('sitter_moreWalksToNext', { n: tier.max - completedCount, next: tier.next }) : tr('sitter_topTier')}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 14 }}>
          {[
            { label: tr('newRequests'), val: newBookings.length },
            { label: tr('yourRating'), val: (sitterProfile?.rating || 5.0).toFixed(1), star: true },
            { label: tr('totalWalks'), val: completedCount },
          ].map((s, i) => (
            <div key={i} style={{ background: color.navyHover, borderRadius: radius.md, padding: '10px 8px', textAlign: 'center', minWidth: 0 }}>
              <div style={{ ...money, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, fontSize: font.lg, fontWeight: 700 }}>
                {s.val}{s.star && <Icon name="star" size={14} color={color.saffron} />}
              </div>
              <div style={{ fontSize: font.xs, color: color.faint, marginTop: 2, lineHeight: 1.3 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </header>

      <div style={{ padding: '16px 16px 0' }}>
        {broadcastRequests.length > 0 && (
          <button type="button" onClick={() => setTab('requests')}
            style={{ width: '100%', fontFamily: 'inherit', textAlign: 'left', background: color.saffronSoft, borderRadius: radius.lg, padding: 12, marginBottom: 14, display: 'flex', gap: 12, alignItems: 'center', cursor: 'pointer', border: `1px solid ${color.line}` }}>
            <span style={{ ...ui.iconTile, width: 40, height: 40, background: color.surface, color: color.warning }}><Icon name="megaphone" size={20} /></span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: font.md, fontWeight: 600, color: color.ink }}>{tr(broadcastRequests.length > 1 ? 'sitter_openRequestsMany' : 'sitter_openRequestsOne', { n: broadcastRequests.length })}</div>
              <div style={{ fontSize: font.sm, color: color.muted, marginTop: 2 }}>{tr('sitter_openRequestsHint')}</div>
            </div>
            <Icon name="chevronRight" size={18} color={color.muted} />
          </button>
        )}

        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', margin: '0 -16px 16px', padding: '0 16px 2px', scrollbarWidth: 'none' }}>
          {[
            { id: 'new', label: tr('tabNew') + ' (' + newBookings.length + ')' },
            { id: 'requests', label: <><Icon name="megaphone" size={15} style={{ marginRight: 6, verticalAlign: -3 }} />{broadcastRequests.length}</>, aria: tr('sitter_openRequestsTabAria', { n: broadcastRequests.length }) },
            { id: 'upcoming', label: tr('tabUpcoming') },
            { id: 'active', label: tr('tabActive') },
            { id: 'past', label: tr('tabPast') },
          ].map(tb => (
            <button key={tb.id} onClick={() => setTab(tb.id)} aria-label={tb.aria} aria-pressed={tab === tb.id}
              style={{ ...ui.chip(tab === tb.id), flexShrink: 0, whiteSpace: 'nowrap', minHeight: 40 }}>
              {tb.label}
            </button>
          ))}
        </div>

        {unreadMessages.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ ...ui.sectionTitle, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 8, height: 8, borderRadius: radius.pill, background: color.danger }} />
              {tr('sitter_newMessagesTitle')}
            </div>
            <div style={{ background: color.surface, borderRadius: radius.lg, border: `1px solid ${color.line}`, overflow: 'hidden' }}>
              {unreadMessages.map((msg, i) => (
                <div key={i} style={{ padding: '12px 14px', display: 'flex', gap: 12, alignItems: 'center', borderTop: i ? `1px solid ${color.line}` : 'none' }}>
                  <div style={{ ...ui.iconTile, width: 40, height: 40 }}><Icon name="message" size={19} /></div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: font.md, fontWeight: 600, color: color.ink }}>{msg.bookings?.booking_ref || tr('sitter_bookingFallback')}</div>
                    <div style={{ fontSize: font.sm, color: color.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{messagePreview(msg.message, tr)}</div>
                  </div>
                  <div style={{ fontSize: font.xs, color: color.faint, flexShrink: 0 }}>
                    {new Date(msg.created_at).toLocaleTimeString(lang === 'hi' ? 'hi-IN' : 'en-IN', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {loading && (
          <div role="status">
            {[0, 1].map(i => <div key={i} style={{ height: 120, borderRadius: radius.lg, background: color.tile, marginBottom: 12 }} />)}
            <div style={{ fontSize: font.sm, color: color.muted, textAlign: 'center' }}>{tr('loadingJobs')}</div>
          </div>
        )}

        {tab !== 'requests' && !loading && tabBookings.length === 0 && emptyState(
          emptyIcon,
          tab === 'new' ? tr('noNewRequests') : tab === 'upcoming' ? tr('noUpcomingJobs') : tab === 'active' ? tr('noActiveWalks') : tr('noPastJobs'),
          tab === 'new' ? tr('newRequestHint') : tr('confirmedHint'),
        )}

        {tab === 'requests' && (
          <div>
            <div style={{ fontSize: font.sm, color: color.muted, marginBottom: 12, lineHeight: 1.5 }}>
              {tr('openRequestsHint')}
            </div>
            {broadcastRequests.length === 0 && emptyState('megaphone', tr('noOpenRequests'), tr('openRequestsEmptyHint'))}
            {broadcastRequests.map(req => (
              <div key={req.id} style={{ ...ui.card, marginBottom: 12 }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 12 }}>
                  <div style={{ ...ui.iconTile, width: 44, height: 44 }}><Icon name={SERVICE_ICONS[req.service_type] || 'paw'} /></div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: font.md, fontWeight: 700, color: color.ink }}>{serviceName(req.service_type)}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: font.sm, color: color.muted, marginTop: 2 }}>
                      <Icon name="pin" size={14} />{req.area || tr('sitter_nearbyArea')}
                    </div>
                  </div>
                  <span style={ui.badge('info')}>{tr('sitter_openBadge')}</span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 16px', marginBottom: 12 }}>
                  <div style={metaRow}><Icon name="calendar" size={15} color={color.muted} /><span>{req.scheduled_date}</span></div>
                  <div style={metaRow}><Icon name="clock" size={15} color={color.muted} /><span>{req.scheduled_time}</span></div>
                </div>
                {req.notes && <div style={{ fontSize: font.sm, color: color.text, background: color.bg, borderRadius: radius.md, padding: '10px 12px', marginBottom: 12, lineHeight: 1.5 }}>{req.notes}</div>}
                <button onClick={() => acceptBroadcast(req)}
                  style={{ ...ui.primaryButton, width: '100%' }}>
                  {tr('acceptThisRequest')}
                </button>
              </div>
            ))}
          </div>
        )}
        {tab !== 'requests' && !loading && tabBookings.map(b => renderBookingCard(b))}
      </div>

      {supportWa && (
        <div style={{ padding: '4px 16px 16px' }}>
          <button type="button" onClick={() => openWhatsAppSupport(supportWa, 'Hi Fursday, I am a sitter and need help with')}
            style={{ width: '100%', fontFamily: 'inherit', textAlign: 'left', border: `1px solid ${color.line}`, minHeight: 44, background: color.surface, borderRadius: radius.lg, padding: 12, display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
            <span style={{ ...ui.iconTile, width: 40, height: 40 }}><Icon name="message" size={19} /></span>
            <div style={{ flex: 1, fontSize: font.md, fontWeight: 600, color: color.ink }}>{tr('needHelp')}</div>
            <Icon name="chevronRight" size={18} color={color.faint} />
          </button>
        </div>
      )}
      {uploadingPhotosFor && <PhotoUploadModal booking={uploadingPhotosFor} onClose={() => setUploadingPhotosFor(null)} onSubmitted={() => { setUploadingPhotosFor(null); loadData(); }} />}
    </div>
  );
}
