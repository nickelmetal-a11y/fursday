import React, { useState, useEffect } from 'react';
import { CheckCircle, Clock, MapPin, Phone, Star, Calendar, Home, User, Search } from 'lucide-react';
import { supabase } from './supabase';
import PhotoUploadModal from './PhotoUploadModal';
import SitterEarningsDashboard from './SitterEarningsDashboard';
import { useSupportContact, openWhatsAppSupport } from './supportContact';
import { useLanguage } from './i18n';
import SosSheet from './SosSheet';
import DisputeForm from './DisputeForm';

const THEMES = {
  Gurgaon: { primary: '#FF6B35', light: '#FFF0EB', grad: 'linear-gradient(135deg,#FF6B35,#FF8C5A)' },
  Pune: { primary: '#6C5CE7', light: '#F0EEFF', grad: 'linear-gradient(135deg,#6C5CE7,#8E7CF3)' },
};

const SERVICE_NAME_KEYS = {
  walk30: 'service_walk',
  boarding: 'service_boarding',
  daycare: 'service_daycare',
  dropin: 'service_dropin',
  housesit: 'service_housesit',
};

const SERVICE_ICONS = {
  walk30: '🦮',
  boarding: '🏠',
  daycare: '☀️',
  dropin: '🔔',
  housesit: '🏡',
};

const STATUS_COLORS = {
  pending: { bg: '#FFF3E0', color: '#E65100', labelKey: 'sitter_statusNew' },
  confirmed: { bg: '#E3F2FD', color: '#1565C0', labelKey: 'bookings_statusConfirmed' },
  active: { bg: '#E8F5E9', color: '#2E7D32', labelKey: 'bookings_statusActive' },
  completed: { bg: '#F3E5F5', color: '#6A1B9A', labelKey: 'bookings_statusCompleted' },
  cancelled: { bg: '#FCEBEB', color: '#A32D2D', labelKey: 'bookings_statusCancelled' },
};

export default function SitterDashboard({ onBack, city, onStartWalk, onMessage, onEditProfile }) {
  const t = THEMES[city] || THEMES.Gurgaon;
  const { whatsapp: supportWa, phone: supportPhone } = useSupportContact();
  const { t: tr } = useLanguage();
  const [tab, setTab] = useState('new');
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sitterProfile, setSitterProfile] = useState(null);
  const [expanded, setExpanded] = useState(null);
  const [activeNav, setActiveNav] = useState('jobs');
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
    } catch (err) { alert('Could not send update: ' + (err.message || err)); }
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

  const completeBooking = async (id) => {
    const { error } = await supabase.from('bookings').update({ status: 'completed', end_verified_at: new Date().toISOString() }).eq('id', id);
    if (error) { alert('Could not complete booking: ' + error.message); return; }
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
    if (completeError) { alert('Could not complete booking: ' + completeError.message); return; }

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

  const BookingCard = ({ b }) => {
    const sc = STATUS_COLORS[b.status] || STATUS_COLORS.pending;
    const isOpen = expanded === b.id;
    return (
      <div style={{ background: 'white', borderRadius: 20, marginBottom: 12, boxShadow: '0 2px 12px rgba(0,0,0,0.06)', overflow: 'hidden', border: b.status === 'pending' ? '2px solid ' + t.primary : b.status === 'active' ? '2px solid #2E7D32' : '2px solid transparent' }}>
        <div onClick={() => setExpanded(isOpen ? null : b.id)} style={{ padding: '14px 16px', cursor: 'pointer' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <span style={{ fontSize: 24 }}>{SERVICE_ICONS[b.service_type] || '🐾'}</span>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#1a1a1a' }}>{SERVICE_NAME_KEYS[b.service_type] ? tr(SERVICE_NAME_KEYS[b.service_type]) : b.service_type}</div>
                <div style={{ fontSize: 12, color: '#888' }}>{b.users?.name || tr('sitter_petParent')}</div>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: t.primary }}>Rs.{Math.round((b.gross_amount_paise || 0) / 100)}</div>
              <div style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: sc.bg, color: sc.color, fontWeight: 600 }}>{tr(sc.labelKey)}</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Calendar size={12} color={t.primary} />
              <span style={{ fontSize: 12, color: '#555' }}>{b.booking_date || 'TBD'}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Clock size={12} color={t.primary} />
              <span style={{ fontSize: 12, color: '#555' }}>{b.time_slot || 'TBD'}</span>
            </div>
          </div>
          {b.status === 'pending' && (
            <div style={{ marginTop: 8, background: t.light, borderRadius: 10, padding: '6px 10px', display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: 4, background: t.primary }} />
              <span style={{ fontSize: 12, color: t.primary, fontWeight: 600 }}>{tr('newBookingBanner')}</span>
            </div>
          )}
          {b.status === 'active' && (
            <div style={{ marginTop: 8, background: '#E8F5E9', borderRadius: 10, padding: '6px 10px', display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: 4, background: '#2E7D32' }} />
              <span style={{ fontSize: 12, color: '#2E7D32', fontWeight: 600 }}>{tr('walkInProgress')}</span>
            </div>
          )}
        </div>
        <div style={{ padding: '0 16px 16px' }}>
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <button onClick={(e) => { e.stopPropagation(); onMessage && onMessage(b); }}
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px 0', borderRadius: 12, border: 'none', background: t.light, color: t.primary, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                <span>💬</span> {tr('message')}
              </button>
              {b.users?.phone && (
                <a onClick={(e) => e.stopPropagation()} href={'tel:' + b.users.phone}
                  style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px 0', borderRadius: 12, border: '1.5px solid #E0E0E0', background: 'white', color: '#1a1a1a', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
                  <Phone size={14} /> {tr('call')}
                </a>
              )}
            </div>
            {b.status === 'pending' && (
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <button onClick={() => acceptBooking(b)}
                  style={{ flex: 2, padding: '12px 0', borderRadius: 12, border: 'none', background: '#E8F5E9', color: '#2E7D32', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                  {tr('accept')} ✓
                </button>
                <button onClick={() => declineBooking(b)}
                  style={{ flex: 1, padding: '12px 0', borderRadius: 12, border: '1.5px solid #FFCDD2', background: 'white', color: '#C62828', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                  {tr('decline')}
                </button>
              </div>
            )}
            {b.status === 'confirmed' && (
              <div style={{ marginTop:10, background:t.light, borderRadius:12, padding:'12px 14px' }}>
                <div style={{ display:'flex', gap:8, marginBottom:12 }}>
                  <button onClick={() => markArrival(b, 'on_way')} disabled={!!arrivalStatus[b.id]}
                    style={{ flex:1, padding:'8px 0', borderRadius:10, border:'1.5px solid '+t.primary, background:arrivalStatus[b.id]==='on_way'?t.primary:'white', color:arrivalStatus[b.id]==='on_way'?'white':t.primary, fontSize:12, fontWeight:700, cursor:arrivalStatus[b.id]?'default':'pointer' }}>
                    🚶 {tr('onMyWay')}
                  </button>
                  <button onClick={() => markArrival(b, 'arrived')} disabled={arrivalStatus[b.id]==='arrived'}
                    style={{ flex:1, padding:'8px 0', borderRadius:10, border:'1.5px solid #2E7D32', background:arrivalStatus[b.id]==='arrived'?'#2E7D32':'white', color:arrivalStatus[b.id]==='arrived'?'white':'#2E7D32', fontSize:12, fontWeight:700, cursor:arrivalStatus[b.id]==='arrived'?'default':'pointer' }}>
                    📍 {tr('arrived')}
                  </button>
                </div>
                <div style={{ fontSize:12, fontWeight:600, color:'#1a1a1a', marginBottom:8 }}>
                  {['boarding','daycare'].includes(b.service_type) ? tr('enterOtpTitleDrop') : tr('enterOtpTitleWalk')}
                </div>
                <div style={{ fontSize:11, color:'#888', marginBottom:8 }}>{tr('otpHint', { name: b.users?.name || 'the pet parent' })}</div>
                <div style={{ display:'flex', gap:8 }}>
                  <input value={otpEntry[b.id] || ''} onChange={e => setOtpEntry({ ...otpEntry, [b.id]: e.target.value.replace(/\D/g,'').slice(0,4) })}
                    placeholder="0000" inputMode="numeric" maxLength={4}
                    style={{ flex:1, padding:'10px 14px', borderRadius:10, border:'1.5px solid #E0E0E0', fontSize:18, letterSpacing:6, textAlign:'center', outline:'none', boxSizing:'border-box' }} />
                  <button onClick={() => verifyStartOtp(b)}
                    style={{ padding:'0 20px', borderRadius:10, border:'none', background:t.primary, color:'white', fontSize:14, fontWeight:700, cursor:'pointer' }}>{tr('start')}</button>
                </div>
                {otpError[b.id] && <div style={{ fontSize:11, color:'#C62828', marginTop:6 }}>{otpError[b.id]}</div>}
                <button onClick={(e) => { e.stopPropagation(); sitterCancel(b); }}
                  style={{ width:'100%', marginTop:12, minHeight:44, borderRadius:10, border:'1.5px solid #FFCDD2', background:'white', color:'#C62828', fontSize:13, fontWeight:600, cursor:'pointer' }}>
                  {tr('sitter_cancelJob')}
                </button>
              </div>
            )}
            {b.status === 'active' && (
              <div style={{ marginTop:10 }}>
                {(supportPhone || supportWa) && (
                  <button onClick={(e) => { e.stopPropagation(); setSosFor(b); }}
                    style={{ width:'100%', padding:'10px 0', borderRadius:12, border:'none', background:'#C62828', color:'white', fontSize:13, fontWeight:700, cursor:'pointer', marginBottom:8, display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
                    {tr('sos')}
                  </button>
                )}
                {['boarding','daycare'].includes(b.service_type) ? (
                  <div style={{ background:'#E8F5E9', borderRadius:12, padding:'12px 14px' }}>
                    <div style={{ fontSize:12, fontWeight:600, color:'#1B5E20', marginBottom:6 }}>{tr('pickupOtpTitle')}</div>
                    <div style={{ fontSize:11, color:'#388E3C', marginBottom:8 }}>{tr('pickupOtpHint', { name: b.users?.name || 'the parent' })}</div>
                    <div style={{ background:'white', borderRadius:10, padding:'10px', textAlign:'center', fontSize:26, fontWeight:800, letterSpacing:8, color:'#2E7D32', marginBottom:8 }}>{b.end_otp || '----'}</div>
                    <button onClick={() => completeWithOtp(b)}
                      style={{ width:'100%', padding:'10px 0', borderRadius:10, border:'none', background:'#2E7D32', color:'white', fontSize:13, fontWeight:700, cursor:'pointer' }}>
                      {tr('parentCollected')}
                    </button>
                  </div>
                ) : (
                  <button onClick={() => completeWithOtp(b)}
                    style={{ width:'100%', padding:'12px 0', borderRadius:12, border:'none', background:'#2E7D32', color:'white', fontSize:14, fontWeight:700, cursor:'pointer' }}>
                    {tr('completeWalk')}
                  </button>
                )}
              </div>
            )}
            {b.status === 'completed' && !b.sitter_uploaded_photos && (
              <div style={{ marginTop:10 }}>
                <button onClick={() => setUploadingPhotosFor(b)}
                  style={{ width:'100%', padding:'12px 0', borderRadius:12, border:'none', background:'#2196F3', color:'white', fontSize:14, fontWeight:700, cursor:'pointer' }}>
                  {tr('uploadPhotos')}
                </button>
              </div>
            )}
            {b.status === 'completed' && b.sitter_uploaded_photos && (
              <div style={{ marginTop:10, background:'#E8F5E9', borderRadius:12, padding:'10px 14px', textAlign:'center' }}>
                <span style={{ fontSize:13, fontWeight:600, color:'#2E7D32' }}>{tr('photosUploaded')}</span>
              </div>
            )}
            {['confirmed','active','completed'].includes(b.status) && (
              <button onClick={(e) => { e.stopPropagation(); setReportingBooking(b); }}
                style={{ width:'100%', marginTop:10, minHeight:44, borderRadius:12, border:'1.5px solid #E0E0E0', background:'white', color:'#666', fontSize:13, fontWeight:600, cursor:'pointer' }}>
                {tr('sitter_reportProblem')}
              </button>
            )}
            {isOpen && (
              <div style={{ marginTop: 12, borderTop: '1px solid #F5F5F5', paddingTop: 10 }}>
                <div style={{ fontSize: 11, color: '#AAA', marginBottom: 8, fontWeight: 600, textTransform: 'uppercase' }}>{tr('sitter_details')}</div>
                {[
                  { label: tr('sitter_detailRef'), val: b.booking_ref },
                  { label: tr('sitter_petParent'), val: b.users?.name },
                  { label: tr('sitter_detailNotes'), val: b.parent_notes || tr('sitter_detailNone') },
                  { label: tr('sitter_detailPayment'), val: b.payment_status === 'paid' ? tr('sitter_paid') : tr('sitter_unpaid') },
                ].filter(x => x.val).map((x, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #F8F8F8' }}>
                    <span style={{ fontSize: 12, color: '#888' }}>{x.label}</span>
                    <span style={{ fontSize: 12, color: '#1a1a1a', fontWeight: 500 }}>{x.val}</span>
                  </div>
                ))}
              </div>
            )}
        </div>
      </div>
    );
  };

  // Show earnings dashboard when earnings tab is selected
  if (activeNav === 'earnings') {
    return <SitterEarningsDashboard city={city} onBack={() => setActiveNav('jobs')} />;
  }

  return (
    <div style={{ maxWidth: 390, margin: '0 auto', minHeight: '100vh', background: '#F8F8F8', fontFamily: '-apple-system,sans-serif', paddingBottom: 100 }}>
      {sosFor && <SosSheet onClose={() => setSosFor(null)} bookingRef={sosFor.booking_ref} userName={sitterProfile?.users?.name} />}
      {reportingBooking && (
        <DisputeForm booking={reportingBooking} reporterRole="sitter" otherName={reportingBooking.users?.name || tr('sitter_petParent')}
          onClose={() => setReportingBooking(null)} onDisputeFiled={() => setReportingBooking(null)} />
      )}
      <div style={{ background:'#0f0f1a', padding:'48px 16px 16px' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:14 }}>
          <div>
            <div style={{ color:'white', fontSize:18, fontWeight:700 }}>{tr('greeting')}, {sitterProfile?.users?.name?.split(' ')[0] || 'there'} 👋</div>
            <div style={{ color:sitterProfile?.status==='active'?'#4CAF50':'#FFC107', fontSize:11, fontWeight:500, marginTop:2 }}>
              {sitterProfile?.status==='active'?tr('live'):tr('pendingApproval')}
            </div>
          </div>
          <div style={{ background:'#FF6B35', borderRadius:20, padding:'4px 12px', fontSize:11, color:'white', fontWeight:700 }}>
            {(() => { const w=bookings.filter(b=>b.status==='completed').length; if(w>=300)return'🏆 Elite Pro'; if(w>=150)return'🥇 Platinum Pro'; if(w>=75)return'🥈 Gold Pro'; if(w>=25)return'🥈 Silver Pro'; return'🥉 Bronze Pro'; })()}
          </div>
        </div>
        <div style={{ textAlign:'center', marginBottom:12 }}>
          <div style={{ fontSize:11, color:'rgba(255,255,255,0.5)', marginBottom:3 }}>{tr('thisMonth')}</div>
          <div style={{ fontSize:32, fontWeight:800, color:'#FF6B35' }}>Rs.{totalEarnings.toLocaleString('en-IN')}</div>
          <div style={{ fontSize:11, color:'rgba(255,255,255,0.4)', marginTop:2 }}>{tr('payoutNote')}</div>
        </div>
        {/* Status badges only (Bronze/Silver/Gold/.../Elite Pro) — these are
            recognition tiers, not commission tiers. Fursday charges a flat
            15% commission on every booking regardless of tier; see
            TermsAndConditions.js #7. A commission reduction promise doesn't
            belong here unless it's actually wired to payout math. */}
        {(() => { const w=bookings.filter(b=>b.status==='completed').length; const tiers=[{max:25,next:'Silver Pro 🥈'},{max:75,next:'Gold Pro 🥇'},{max:150,next:'Platinum Pro 🥈'},{max:300,next:'Elite Pro 🏆'}]; const tier=tiers.find(t=>w<t.max); const prev=tiers[tiers.indexOf(tier)-1]; const pMin=prev?prev.max:0; const pct=tier?Math.min(100,Math.round((w-pMin)/(tier.max-pMin)*100)):100; return (<div style={{ marginBottom:14 }}><div style={{ background:'rgba(255,255,255,0.1)', borderRadius:4, height:6, marginBottom:5 }}><div style={{ width:pct+'%', background:'#FF6B35', borderRadius:4, height:6 }} /></div>{tier?<div style={{ fontSize:10, color:'rgba(255,255,255,0.4)', textAlign:'right' }}>{tier.max-w} more walks → {tier.next}</div>:<div style={{ fontSize:10, color:'#FF6B35', textAlign:'center', fontWeight:600 }}>Elite Pro — top tier 🎉</div>}</div>); })()}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8 }}>
          {[{label:tr('newRequests'),val:newBookings.length},{label:tr('yourRating'),val:(sitterProfile?.rating||5.0).toFixed(1)+' ⭐'},{label:tr('totalWalks'),val:bookings.filter(b=>b.status==='completed').length}].map((s,i) => (
            <div key={i} style={{ background:'rgba(255,255,255,0.07)', borderRadius:10, padding:'8px 6px', textAlign:'center' }}>
              <div style={{ fontSize:16, fontWeight:700, color:'white' }}>{s.val}</div>
              <div style={{ fontSize:9, color:'rgba(255,255,255,0.4)', marginTop:2, lineHeight:1.3 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding: '16px 16px 0' }}>
        {broadcastRequests.length > 0 && (
          <div onClick={() => setTab('requests')} style={{ background:'#FFF3E0', borderRadius:12, padding:'10px 14px', marginBottom:10, display:'flex', gap:8, alignItems:'center', cursor:'pointer', border:'1px solid #FFB085' }}>
            <span style={{ fontSize:18 }}>📢</span>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:13, fontWeight:700, color:'#E65100' }}>{broadcastRequests.length} open request{broadcastRequests.length>1?'s':''} near you</div>
              <div style={{ fontSize:11, color:'#BF6000' }}>Pet parents looking for help — tap to respond</div>
            </div>
            <span style={{ color:'#FF6B35', fontSize:16 }}>›</span>
          </div>
        )}
        <div style={{ background: 'white', borderRadius: 14, padding: 4, display: 'flex', gap: 4, marginBottom: 16, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
          {[
            { id: 'new', label: tr('tabNew') + ' (' + newBookings.length + ')' },
            { id: 'requests', label: '📢 ' + broadcastRequests.length },
            { id: 'upcoming', label: tr('tabUpcoming') },
            { id: 'active', label: tr('tabActive') },
            { id: 'past', label: tr('tabPast') },
          ].map(tb => (
            <button key={tb.id} onClick={() => setTab(tb.id)}
              style={{ flex: 1, padding: '8px 0', borderRadius: 10, border: 'none', background: tab === tb.id ? t.primary : 'transparent', color: tab === tb.id ? 'white' : '#888', fontSize: 12, fontWeight: tab === tb.id ? 700 : 400, cursor: 'pointer' }}>
              {tb.label}
            </button>
          ))}
        </div>

        {unreadMessages.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1a1a', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: 4, background: '#E24B4A' }} />
              New messages from pet parents
            </div>
            {unreadMessages.map((msg, i) => (
              <div key={i} style={{ background: 'white', borderRadius: 16, padding: '12px 14px', marginBottom: 8, boxShadow: '0 2px 12px rgba(0,0,0,0.06)', border: '1.5px solid #FFCDD2', display: 'flex', gap: 10, alignItems: 'center' }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: t.light, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>💬</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a1a' }}>{msg.bookings?.booking_ref || 'Booking'}</div>
                  <div style={{ fontSize: 12, color: '#666', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{msg.message}</div>
                </div>
                <div style={{ fontSize: 10, color: '#AAA', flexShrink: 0 }}>
                  {new Date(msg.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            ))}
          </div>
        )}
        {loading && (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <div style={{ fontSize: 32 }}>🐾</div>
            <div style={{ fontSize: 14, color: '#888', marginTop: 8 }}>{tr('loadingJobs')}</div>
          </div>
        )}

        {!loading && tabBookings.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>
              {tab === 'new' ? '📋' : tab === 'upcoming' ? '📅' : tab === 'active' ? '🦮' : '✅'}
            </div>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#1a1a1a', marginBottom: 6 }}>
              {tab === 'new' ? tr('noNewRequests') : tab === 'upcoming' ? tr('noUpcomingJobs') : tab === 'active' ? tr('noActiveWalks') : tr('noPastJobs')}
            </div>
            <div style={{ fontSize: 13, color: '#888', lineHeight: 1.6 }}>
              {tab === 'new' ? tr('newRequestHint') : tr('confirmedHint')}
            </div>
          </div>
        )}

        {tab === 'requests' && (
          <div>
            <div style={{ fontSize:13, color:'#888', marginBottom:12, lineHeight:1.5 }}>
              {tr('openRequestsHint')}
            </div>
            {broadcastRequests.length === 0 && (
              <div style={{ textAlign:'center', padding:'40px 20px' }}>
                <div style={{ fontSize:48, marginBottom:12 }}>📢</div>
                <div style={{ fontSize:15, fontWeight:600, color:'#1a1a1a', marginBottom:6 }}>{tr('noOpenRequests')}</div>
                <div style={{ fontSize:13, color:'#888' }}>{tr('openRequestsEmptyHint')}</div>
              </div>
            )}
            {broadcastRequests.map(req => (
              <div key={req.id} style={{ background:'white', borderRadius:20, padding:16, marginBottom:12, boxShadow:'0 2px 12px rgba(0,0,0,0.06)', border:'2px solid ' + t.primary }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10 }}>
                  <div>
                    <div style={{ fontSize:15, fontWeight:700, color:'#1a1a1a' }}>{SERVICE_NAMES[req.service_type] || req.service_type}</div>
                    <div style={{ fontSize:12, color:'#888' }}>{req.area || 'Nearby area'}</div>
                  </div>
                  <div style={{ fontSize:11, background:t.light, color:t.primary, borderRadius:10, padding:'3px 10px', fontWeight:600 }}>Open</div>
                </div>
                <div style={{ display:'flex', gap:12, marginBottom:10 }}>
                  <div style={{ fontSize:12, color:'#555' }}>📅 {req.scheduled_date}</div>
                  <div style={{ fontSize:12, color:'#555' }}>🕐 {req.scheduled_time}</div>
                </div>
                {req.notes && <div style={{ fontSize:12, color:'#666', background:'#F8F8F8', borderRadius:10, padding:'8px 12px', marginBottom:10 }}>{req.notes}</div>}
                <button onClick={() => acceptBroadcast(req)}
                  style={{ width:'100%', padding:'12px 0', borderRadius:12, border:'none', background:t.primary, color:'white', fontSize:14, fontWeight:700, cursor:'pointer' }}>
                  {tr('acceptThisRequest')}
                </button>
              </div>
            ))}
          </div>
        )}
        {tab !== 'requests' && !loading && tabBookings.map(b => <BookingCard key={b.id} b={b} />)}
      </div>

      {supportWa && (
        <div style={{ padding:'0 16px 16px' }}>
          <div onClick={() => openWhatsAppSupport(supportWa, 'Hi Fursday, I am a sitter and need help with')}
            style={{ background:'#25D366', borderRadius:14, padding:'12px 14px', display:'flex', alignItems:'center', gap:10, cursor:'pointer' }}>
            <span style={{ fontSize:18 }}>💬</span>
            <div style={{ fontSize:13, fontWeight:600, color:'white' }}>{tr('needHelp')}</div>
          </div>
        </div>
      )}
      <div style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: 390, background: 'white', borderTop: '1px solid #E0E0E0', display: 'flex', justifyContent: 'space-around', padding: '10px 0 calc(16px + env(safe-area-inset-bottom))', zIndex: 100 }}>
        {[
          { id: 'home', label: tr('homeNav'), emoji: '🏠' },
          { id: 'jobs', label: tr('jobsNav'), emoji: '📋' },
          { id: 'earnings', label: tr('earningsNav'), emoji: '💰' },
          { id: 'profile', label: tr('editProfileNav'), emoji: '\u270F\uFE0F' },
        ].map(n => (
          <div key={n.id} onClick={() => { if(n.id === 'home') onBack(); else if(n.id === 'profile') { if(onEditProfile) onEditProfile(); } else setActiveNav(n.id); }}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, cursor: 'pointer' }}>
            <span style={{ fontSize: 20 }}>{n.emoji}</span>
            <span style={{ fontSize: 10, fontWeight: n.id === activeNav ? 700 : 400, color: n.id === activeNav ? t.primary : '#BBB' }}>{n.label}</span>
            {n.id === activeNav && <div style={{ width: 4, height: 4, borderRadius: 2, background: t.primary }} />}
          </div>
        ))}
      </div>
      {uploadingPhotosFor && <PhotoUploadModal booking={uploadingPhotosFor} onClose={() => setUploadingPhotosFor(null)} onSubmitted={() => { setUploadingPhotosFor(null); loadData(); }} />}
    </div>
  );
}