import React, { useState, useEffect } from 'react';
import { CheckCircle, Clock, MapPin, Phone, Star, ChevronRight, Calendar } from 'lucide-react';
import { supabase } from './supabase';
import { useSupportContact, callSupport } from './supportContact';
import { useLanguage } from './i18n';
import ReviewModal from './ReviewModal';
import CancellationPolicyModal from './CancellationPolicyModal';
import ReceiptModal from './ReceiptModal';
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

const SC = {
  pending: { bg: '#FFF3E0', color: '#E65100', labelKey: 'bookings_statusPending' },
  confirmed: { bg: '#E3F2FD', color: '#1565C0', labelKey: 'bookings_statusConfirmed' },
  active: { bg: '#E8F5E9', color: '#2E7D32', labelKey: 'bookings_statusActive' },
  completed: { bg: '#F3E5F5', color: '#6A1B9A', labelKey: 'bookings_statusCompleted' },
  cancelled: { bg: '#FCEBEB', color: '#A32D2D', labelKey: 'bookings_statusCancelled' },
};

export default function BookingsDashboard({ onBack, city, onViewReport, onReview, onPayNow, onMessage, onNav }) {
  const c = city || 'Gurgaon';
  const t = THEMES[c] || THEMES.Gurgaon;
  const { t: tr } = useLanguage();
  const { phone: supportPhone } = useSupportContact();
  const [tab, setTab] = useState('upcoming');
  const [expanded, setExpanded] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  const [reportModal, setReportModal] = useState(null);
  const [reportReason, setReportReason] = useState('');
  const [reportSent, setReportSent] = useState(false);
  const [reviewingBooking, setReviewingBooking] = useState(null);
  const [photoCarousel, setPhotoCarousel] = useState(null);
  const [photoReport, setPhotoReport] = useState(null);
  const [confirmingPhotos, setConfirmingPhotos] = useState(false);
  const [cancellingBooking, setCancellingBooking] = useState(null);
  const [viewingReceipt, setViewingReceipt] = useState(null);
  const [receiptData, setReceiptData] = useState(null);
  const [filingDispute, setFilingDispute] = useState(null);

  const submitReport = async (bookingId, sitterName) => {
    if (!reportReason) return;
    const { error } = await supabase.from('sitter_reports').insert({
      booking_id: bookingId,
      reason: reportReason,
      reported_at: new Date().toISOString(),
    }).select();
    if (error) { alert(tr('bookings_reportErrorPrefix') + error.message); return; }
    setReportModal(null);
    setReportReason('');
    setReportSent(true);
    setTimeout(() => setReportSent(false), 3000);
  };

  const viewPhotoReport = async (booking) => {
    const { data } = await supabase.from('walk_photo_reports').select('*').eq('booking_id', booking.id).single();
    setPhotoReport(data);
    setPhotoCarousel(booking);
  };

  const confirmPhotoReport = async (booking) => {
    setConfirmingPhotos(true);
    const { error: e1 } = await supabase.from('walk_photo_reports').update({ parent_confirmed: true, confirmed_at: new Date().toISOString() }).eq('booking_id', booking.id);
    const { error: e2 } = await supabase.from('bookings').update({ parent_confirmed_photos: true }).eq('id', booking.id);
    setConfirmingPhotos(false);
    if (e1 || e2) { alert(tr('bookings_confirmPhotosErrorPrefix') + (e1 || e2).message); return; }
    setPhotoCarousel(null);
    loadBookings();
  };

  const viewReceipt = async (booking) => {
    const sitterData = booking.sitter_profiles;
    const { data: petData } = await supabase.from('pet_profiles').select('*').eq('id', booking.pet_id).single();
    setReceiptData({ booking, sitter: sitterData, pet: petData });
    setViewingReceipt(true);
  };

  const cancelBooking = async (bookingId) => {
    if (!window.confirm(tr('bookings_cancelConfirmDialog'))) return;
    const { error } = await supabase
      .from('bookings')
      .update({ status: 'cancelled' })
      .eq('id', bookingId);
    if (error) alert(tr('bookings_cancelErrorPrefix') + error.message);
    else { alert(tr('bookings_cancelSuccess')); loadBookings(); }
  };

  const loadBookings = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase
        .from('bookings')
        .select('*, sitter_profiles(id, user_id, users(name), rating, total_bookings)')
        .eq('pet_parent_id', user.id)
        .order('created_at', { ascending: false });
      const dataWithContact = await Promise.all((data || []).map(async (b) => {
        const sitterUserId = b.sitter_profiles?.user_id;
        if (!sitterUserId) return b;
        const { data: contact } = await supabase.rpc('get_user_contact', { target_id: sitterUserId });
        return { ...b, sitter_profiles: { ...b.sitter_profiles, users: { ...b.sitter_profiles.users, phone: contact?.[0]?.phone } } };
      }));
      setBookings(dataWithContact);

      // TIER 3: Check for no-shows (confirmed booking past scheduled time, still active)
      if (data) {
        for (const booking of data) {
          const bookingTime = new Date(`${booking.booking_date}T${booking.time_slot}`);
          const now = new Date();
          const isNoShow = booking.status === 'active' && bookingTime < now && (now - bookingTime) > 60 * 60 * 1000; // 1 hour late

          if (isNoShow) {
            try {
              const { notifyNoShow } = await import('./notificationService');
              await notifyNoShow(
                user.id,
                user.email,
                user.phone,
                booking.sitter_profiles?.users?.name || 'Sitter',
                booking.booking_ref
              );
              // Mark as alerted to avoid duplicate notifications
              await supabase.from('bookings').update({ no_show_alerted: true }).eq('id', booking.id);
            } catch(noShowErr) { console.error('No-show notification failed:', noShowErr); }
          }
        }
      }
    }
    setLoading(false);
  };

  const [endOtpEntry, setEndOtpEntry] = useState({});
  const [endOtpError, setEndOtpError] = useState({});
  const verifyEndOtp = async (booking) => {
    const entered = (endOtpEntry[booking.id] || '').trim();
    if (entered !== booking.end_otp) {
      setEndOtpError({ ...endOtpError, [booking.id]: tr('bookings_wrongOtpError') });
      return;
    }
    const { error } = await supabase.from('bookings').update({ status:'completed', end_verified_at:new Date().toISOString() }).eq('id', booking.id);
    if (error) {
      setEndOtpError({ ...endOtpError, [booking.id]: tr('bookings_confirmOtpErrorPrefix') + error.message });
      return;
    }
    setEndOtpError({ ...endOtpError, [booking.id]: null });
    loadBookings();
  };

  useEffect(() => { loadBookings(); }, []);

  const upcoming = bookings.filter(b => ['pending','confirmed'].includes(b.status));
  const active = bookings.filter(b => b.status === 'active');
  const past = bookings.filter(b => ['completed','cancelled'].includes(b.status));

  const tabBookings = tab === 'upcoming' ? upcoming : tab === 'active' ? active : past;

  return (
    <div style={{ maxWidth:390, margin:'0 auto', minHeight:'100vh', background:'#F8F8F8', fontFamily:'-apple-system,sans-serif', paddingBottom:100 }}>
      <div style={{ background:t.grad, padding:'48px 20px 20px' }}>
        <div style={{ color:'white', fontSize:20, fontWeight:700, marginBottom:2 }}>{tr('bookings_title')}</div>
        <div style={{ color:'rgba(255,255,255,0.75)', fontSize:13 }}>{tr('bookings_subtitle')}</div>
      </div>

      <div style={{ padding:'16px 16px 0' }}>
        <div style={{ background:'white', borderRadius:14, padding:4, display:'flex', gap:4, marginBottom:20, boxShadow:'0 2px 12px rgba(0,0,0,0.06)' }}>
          {[
            { id:'upcoming', label:tr('bookings_tabUpcoming'), count:upcoming.length },
            { id:'active', label:tr('bookings_tabActive'), count:active.length },
            { id:'past', label:tr('bookings_tabPast'), count:past.length },
          ].map(tb => (
            <button key={tb.id} onClick={() => setTab(tb.id)}
              style={{ flex:1, padding:'10px 0', borderRadius:10, border:'none', background:tab===tb.id?t.primary:'transparent', color:tab===tb.id?'white':'#888', fontSize:13, fontWeight:tab===tb.id?700:400, cursor:'pointer', position:'relative' }}>
              {tb.label}
              {tb.count > 0 && <span style={{ position:'absolute', top:6, right:10, width:16, height:16, borderRadius:8, background:tab===tb.id?'rgba(255,255,255,0.3)':t.primary, color:'white', fontSize:9, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center' }}>{tb.count}</span>}
            </button>
          ))}
        </div>

        {loading && (
          <div style={{ textAlign:'center', padding:'40px 20px' }}>
            <div style={{ fontSize:32, marginBottom:12 }}>🐾</div>
            <div style={{ fontSize:14, color:'#888' }}>{tr('bookings_loadingBookings')}</div>
          </div>
        )}

        {!loading && tabBookings.length === 0 && (
          <div style={{ textAlign:'center', padding:'60px 20px' }}>
            <div style={{ fontSize:48, marginBottom:16 }}>📋</div>
            <div style={{ fontSize:16, fontWeight:700, color:'#1a1a1a', marginBottom:8 }}>
              {tab==='upcoming'?tr('bookings_noUpcoming'):tab==='active'?tr('bookings_noActive'):tr('bookings_noPast')}
            </div>
            <div style={{ fontSize:13, color:'#888', lineHeight:1.6 }}>
              {tab==='upcoming'?tr('bookings_noUpcomingHint'):tr('bookings_historyHint')}
            </div>
          </div>
        )}

        {!loading && tabBookings.map(b => {
          const sc = SC[b.status] || SC.pending;
          const scLabel = tr(sc.labelKey);
          const isOpen = expanded === b.id;
          const sitterName = b.sitter_profiles && b.sitter_profiles.users ? b.sitter_profiles.users.name : tr('bookings_sitterFallback');
          const sitterPhone = b.sitter_profiles && b.sitter_profiles.users ? b.sitter_profiles.users.phone : '';
          const sitterRating = b.sitter_profiles ? b.sitter_profiles.rating : null;
          const needsPayment = b.status === 'confirmed' && b.payment_status !== 'paid';

          return (
            <div key={b.id} style={{ background:'white', borderRadius:20, marginBottom:12, boxShadow:'0 2px 12px rgba(0,0,0,0.06)', overflow:'hidden', border:b.status==='active'?'2px solid #2E7D32':needsPayment?'2px solid '+t.primary:'2px solid transparent' }}>
              <div onClick={() => setExpanded(isOpen ? null : b.id)} style={{ padding:'14px 16px', cursor:'pointer' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8 }}>
                  <div>
                    <div style={{ fontSize:15, fontWeight:700, color:'#1a1a1a', marginBottom:2 }}>{SERVICE_NAME_KEYS[b.service_type] ? tr(SERVICE_NAME_KEYS[b.service_type]) : b.service_type}</div>
                    <div style={{ fontSize:12, color:'#888' }}>{tr('bookings_withSitter', { name: sitterName })}</div>
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:4 }}>
                    <div style={{ fontSize:15, fontWeight:700, color:t.primary }}>Rs.{Math.round((b.gross_amount_paise||0)/100)}</div>
                    <div style={{ fontSize:11, padding:'2px 8px', borderRadius:20, background:sc.bg, color:sc.color, fontWeight:600 }}>{scLabel}</div>
                  </div>
                </div>
                <div style={{ display:'flex', gap:12, marginBottom:8 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                    <Calendar size={12} color={t.primary} />
                    <span style={{ fontSize:12, color:'#555' }}>{b.booking_date}</span>
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                    <Clock size={12} color={t.primary} />
                    <span style={{ fontSize:12, color:'#555' }}>{b.time_slot}</span>
                  </div>
                </div>
                {sitterRating > 0 && (
                  <div style={{ display:'flex', alignItems:'center', gap:4, marginBottom: needsPayment ? 8 : 0 }}>
                    <Star size={11} fill="#FFC107" color="#FFC107" />
                    <span style={{ fontSize:12, fontWeight:600, color:'#1a1a1a' }}>{sitterRating}</span>
                  </div>
                )}
                {b.status === 'pending' && (
                  <div style={{ marginTop:8, background:'#FFF3E0', borderRadius:10, padding:'8px 12px', display:'flex', alignItems:'center', gap:8 }}>
                    <div style={{ width:8, height:8, borderRadius:4, background:'#E65100' }} />
                    <span style={{ fontSize:12, color:'#E65100', fontWeight:600 }}>{tr('bookings_waitingForAccept', { name: sitterName })}</span>
                  </div>
                )}
                {['pending','confirmed'].includes(b.status) && (
                  <button onClick={(e) => { e.stopPropagation(); cancelBooking(b.id); }}
                    style={{ marginTop:8, width:'100%', padding:'10px 0', borderRadius:12, border:'1.5px solid #FFCDD2', background:'white', color:'#A32D2D', fontSize:13, fontWeight:600, cursor:'pointer' }}>
                    {tr('bookings_cancelBooking')}
                  </button>
                )}
                {needsPayment && (
                  <button onClick={(e) => { e.stopPropagation(); onPayNow && onPayNow(b); }}
                    style={{ marginTop:8, width:'100%', padding:'12px 0', borderRadius:12, border:'none', background:t.primary, color:'white', fontSize:14, fontWeight:700, cursor:'pointer' }}>
                    {tr('bookings_payNowCta', { name: sitterName, amount: Math.round((b.gross_amount_paise||0)/100) })}
                  </button>
                )}
                {b.status === 'confirmed' && b.payment_status === 'paid' && b.start_otp && (
                  <div onClick={(e) => e.stopPropagation()} style={{ marginTop:8, background:t.light, borderRadius:12, padding:'12px 14px' }}>
                    <div style={{ fontSize:12, fontWeight:600, color:'#1a1a1a', marginBottom:4 }}>
                      {['boarding','daycare'].includes(b.service_type) ? tr('bookings_dropOffCodeTitle') : tr('bookings_startCodeTitle')}
                    </div>
                    <div style={{ fontSize:11, color:'#888', marginBottom:8 }}>{['boarding','daycare'].includes(b.service_type)?tr('bookings_otpHintBoarding',{ name: sitterName }):tr('bookings_otpHintWalk',{ name: sitterName })}</div>
                    <div style={{ background:'white', borderRadius:10, padding:'12px', textAlign:'center', fontSize:30, fontWeight:800, letterSpacing:10, color:t.primary }}>{b.start_otp}</div>
                  </div>
                )}
                {b.status === 'active' && (
                  <div onClick={(e) => e.stopPropagation()} style={{ marginTop:8 }}>
                    <div style={{ background:'#E8F5E9', borderRadius:10, padding:'8px 12px', display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
                      <div style={{ width:8, height:8, borderRadius:4, background:'#2E7D32' }} />
                      <span style={{ fontSize:12, color:'#2E7D32', fontWeight:600 }}>{['boarding','daycare'].includes(b.service_type)?tr('bookings_dogWithSitter',{ name: sitterName }):tr('bookings_walkInProgress')}</span>
                    </div>
                    {sitterPhone && (
                      <a href={'tel:'+sitterPhone} style={{ width:'100%', padding:'12px 0', borderRadius:12, border:'2px solid #2E7D32', background:'white', color:'#2E7D32', fontSize:14, fontWeight:700, cursor:'pointer', textAlign:'center', textDecoration:'none', display:'flex', alignItems:'center', justifyContent:'center', gap:8, marginBottom:8 }}>
                        {tr('bookings_emergencyContactCta', { phone: sitterPhone })}
                      </a>
                    )}
                    {['boarding','daycare'].includes(b.service_type) && (
                      <div style={{ background:t.light, borderRadius:12, padding:'12px 14px' }}>
                        <div style={{ fontSize:12, fontWeight:600, color:'#1a1a1a', marginBottom:4 }}>{tr('bookings_confirmPickupTitle')}</div>
                        <div style={{ fontSize:11, color:'#888', marginBottom:8 }}>{tr('bookings_confirmPickupHint', { name: sitterName })}</div>
                        <div style={{ display:'flex', gap:8 }}>
                          <input value={endOtpEntry[b.id] || ''} onChange={e => setEndOtpEntry({ ...endOtpEntry, [b.id]: e.target.value.replace(/\D/g,'').slice(0,4) })}
                            placeholder="0000" inputMode="numeric" maxLength={4}
                            style={{ flex:1, padding:'10px 14px', borderRadius:10, border:'1.5px solid #E0E0E0', fontSize:18, letterSpacing:6, textAlign:'center', outline:'none', boxSizing:'border-box' }} />
                          <button onClick={() => verifyEndOtp(b)}
                            style={{ padding:'0 18px', borderRadius:10, border:'none', background:'#2E7D32', color:'white', fontSize:13, fontWeight:700, cursor:'pointer' }}>{tr('common_confirm')}</button>
                        </div>
                        {endOtpError[b.id] && <div style={{ fontSize:11, color:'#C62828', marginTop:6 }}>{endOtpError[b.id]}</div>}
                      </div>
                    )}
                  </div>
                )}
                <div style={{ display:'flex', gap:8, marginTop:10 }}>
                  <button onClick={(e) => { e.stopPropagation(); onMessage && onMessage(b, sitterName, sitterPhone, b.sitter_profiles?.user_id); }}
                    style={{ flex:1, padding:'10px 0', borderRadius:12, border:'none', background:t.light, color:t.primary, fontSize:13, fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
                    <span>💬</span> {tr('bookings_message')}
                  </button>
                  {sitterPhone && (
                    <a onClick={(e) => e.stopPropagation()} href={'tel:'+sitterPhone} style={{ flex:1, padding:'10px 0', borderRadius:12, border:'1.5px solid #E0E0E0', background:'white', color:'#1a1a1a', fontSize:13, fontWeight:600, cursor:'pointer', textAlign:'center', textDecoration:'none', display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
                      <Phone size={14} /> {tr('bookings_call')}
                    </a>
                  )}
                </div>
              </div>

              {isOpen && (
                <div style={{ padding:'0 16px 16px', borderTop:'1px solid #F5F5F5' }}>
                  <div style={{ fontSize:11, color:'#AAA', margin:'12px 0 8px', fontWeight:600, textTransform:'uppercase' }}>{tr('bookings_detailsHeading')}</div>
                  {[
                    { label:tr('bookings_labelRef'), val:b.booking_ref },
                    { label:tr('bookings_labelPayment'), val:b.payment_status },
                    { label:tr('bookings_labelNotes'), val:b.parent_notes || tr('bookings_none') },
                  ].filter(x => x.val).map((x,i) => (
                    <div key={i} style={{ display:'flex', justifyContent:'space-between', padding:'6px 0', borderBottom:'1px solid #F8F8F8' }}>
                      <span style={{ fontSize:12, color:'#888' }}>{x.label}</span>
                      <span style={{ fontSize:12, color:'#1a1a1a', fontWeight:500 }}>{x.val}</span>
                    </div>
                  ))}
                  {b.status === 'active' && (
                    <a onClick={(e) => { e.preventDefault(); callSupport(supportPhone); }} href="#"
                      style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8, marginTop:8, width:'100%', padding:'12px 0', borderRadius:12, border:'none', background:'#FCEBEB', color:'#A32D2D', fontSize:13, fontWeight:700, cursor:'pointer', textDecoration:'none' }}>
                      {tr('bookings_emergencySupportCta')}
                    </a>
                  )}
                  {(b.status === 'pending' || b.status === 'confirmed') && (
                    <button onClick={() => setCancellingBooking(b)}
                      style={{ marginTop:8, width:'100%', padding:'10px 0', borderRadius:12, border:'1.5px solid #E0E0E0', background:'white', color:'#A32D2D', fontSize:12, fontWeight:600, cursor:'pointer' }}>
                      {tr('bookings_cancelThisBooking')}
                    </button>
                  )}
                  {(b.status === 'completed' || b.status === 'active') && (
                    <button onClick={() => setReportModal({ id: b.id, name: sitterName })}
                      style={{ marginTop:8, width:'100%', padding:'8px 0', borderRadius:12, border:'1.5px solid #E0E0E0', background:'white', color:'#888', fontSize:12, cursor:'pointer' }}>
                      {tr('bookings_reportProblemSitter')}
                    </button>
                  )}
                  {b.status === 'completed' && b.sitter_uploaded_photos && (
                    <div style={{ marginTop:8, background:t.light, borderRadius:14, padding:'12px', marginBottom:8 }}>
                      <button onClick={() => viewPhotoReport(b)}
                        style={{ width:'100%', padding:'10px 0', borderRadius:12, border:'none', background:'white', color:t.primary, fontSize:13, fontWeight:600, cursor:'pointer' }}>
                        {tr('bookings_viewWalkProof')}
                      </button>
                    </div>
                  )}
                  {b.status === 'completed' && (
                    <div style={{ display:'flex', flexDirection:'column', gap:8, marginTop:8 }}>
                      <div style={{ display:'flex', gap:8 }}>
                        <button onClick={() => viewReceipt(b)}
                          style={{ flex:1, padding:'10px 0', borderRadius:12, border:'none', background:'#E8F5E9', color:'#2E7D32', fontSize:13, fontWeight:600, cursor:'pointer' }}>
                          {tr('bookings_receiptBtn')}
                        </button>
                        <button onClick={() => onViewReport && onViewReport(b)}
                          style={{ flex:1, padding:'10px 0', borderRadius:12, border:'none', background:t.light, color:t.primary, fontSize:13, fontWeight:600, cursor:'pointer' }}>
                          {tr('bookings_walkReportBtn')}
                        </button>
                        <button onClick={() => setReviewingBooking(b)}
                          style={{ flex:1, padding:'10px 0', borderRadius:12, border:'none', background:t.primary, color:'white', fontSize:13, fontWeight:600, cursor:'pointer' }}>
                          {tr('bookings_reviewBtn')}
                        </button>
                      </div>
                      <div style={{ display:'flex', gap:8 }}>
                        <button onClick={() => onNav && onNav('book', { repeatBooking: b })}
                          style={{ flex:1, padding:'10px 0', borderRadius:12, border:'1.5px solid '+t.primary, background:'white', color:t.primary, fontSize:13, fontWeight:600, cursor:'pointer' }}>
                          {tr('bookings_bookAgain')}
                        </button>
                        <button onClick={() => setFilingDispute(b)}
                          style={{ flex:1, padding:'10px 0', borderRadius:12, border:'1.5px solid #E0E0E0', background:'white', color:'#888', fontSize:13, fontWeight:600, cursor:'pointer' }}>
                          {tr('bookings_disputeBtn')}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {reportSent && (
        <div style={{ position:'fixed', top:16, left:'50%', transform:'translateX(-50%)', background:'#2E7D32', color:'white', borderRadius:12, padding:'10px 20px', fontSize:13, fontWeight:600, zIndex:2000 }}>
          {tr('bookings_reportSubmittedToast')}
        </div>
      )}
      {reportModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:1000, display:'flex', alignItems:'flex-end', justifyContent:'center' }}>
          <div style={{ background:'white', borderRadius:'24px 24px 0 0', padding:'24px 20px 40px', width:'100%', maxWidth:390 }}>
            <div style={{ fontSize:16, fontWeight:700, color:'#1a1a1a', marginBottom:6 }}>{tr('bookings_reportSitterTitle', { name: reportModal.name })}</div>
            <div style={{ fontSize:13, color:'#888', marginBottom:16 }}>{tr('bookings_reportIntro')}</div>
            {[
              { key:'bookings_reasonLate', text:'Sitter was late or no-show' },
              { key:'bookings_reasonCare', text:'Pet was not cared for properly' },
              { key:'bookings_reasonRude', text:'Sitter was rude or unprofessional' },
              { key:'bookings_reasonSafety', text:'Safety concern during walk' },
              { key:'bookings_reasonOtherIssue', text:'Other issue' },
            ].map(reason => (
              <div key={reason.text} onClick={() => setReportReason(reason.text)}
                style={{ padding:'12px 14px', borderRadius:12, border:reportReason===reason.text?'2px solid #FF6B35':'1.5px solid #E0E0E0', background:reportReason===reason.text?'#FFF0EB':'white', marginBottom:8, fontSize:13, cursor:'pointer', fontWeight:reportReason===reason.text?600:400, color:reportReason===reason.text?'#FF6B35':'#1a1a1a' }}>
                {tr(reason.key)}
              </div>
            ))}
            <div style={{ display:'flex', gap:8, marginTop:8 }}>
              <button onClick={() => { setReportModal(null); setReportReason(''); }}
                style={{ flex:1, padding:'12px 0', borderRadius:12, border:'1.5px solid #E0E0E0', background:'white', color:'#888', fontSize:14, cursor:'pointer' }}>
                {tr('common_cancel')}
              </button>
              <button onClick={() => submitReport(reportModal.id, reportModal.name)} disabled={!reportReason}
                style={{ flex:2, padding:'12px 0', borderRadius:12, border:'none', background:reportReason?'#A32D2D':'#E0E0E0', color:'white', fontSize:14, fontWeight:700, cursor:'pointer' }}>
                {tr('bookings_submitReport')}
              </button>
            </div>
          </div>
        </div>
      )}
      <div style={{ position:'fixed', bottom:0, left:'50%', transform:'translateX(-50%)', width:390, background:'white', borderTop:'1px solid #F0F0F0', display:'flex', justifyContent:'space-around', padding:'10px 0 16px', zIndex:100 }}>
        {[
          { id:'home', label:tr('nav_home'), emoji:'🏠' },
          { id:'book', label:tr('nav_bookings'), emoji:'📋' },
          { id:'explore', label:tr('nav_explore'), emoji:'🔍' },
          { id:'profile', label:tr('nav_myPets'), emoji:'\uD83D\uDC15' },
          { id:'settings', label:tr('nav_settings'), emoji:'\u2699\uFE0F' },
        ].map(n => (
          <div key={n.id} onClick={() => { if(n.id==='book') return; if(onNav) onNav(n.id); else onBack(); }}
            style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:3, cursor:'pointer' }}>
            <span style={{ fontSize:20 }}>{n.emoji}</span>
            <span style={{ fontSize:10, fontWeight:n.id==='book'?700:400, color:n.id==='book'?t.primary:'#BBB' }}>{n.label}</span>
            {n.id==='book' && <div style={{ width:4, height:4, borderRadius:2, background:t.primary }} />}
          </div>
        ))}
      </div>

      {reviewingBooking && (
        <ReviewModal
          booking={reviewingBooking}
          onClose={() => setReviewingBooking(null)}
          onSubmitted={() => { setReviewingBooking(null); window.location.reload(); }}
        />
      )}

      {cancellingBooking && (
        <CancellationPolicyModal
          booking={cancellingBooking}
          onClose={() => setCancellingBooking(null)}
          onCancelled={() => { setCancellingBooking(null); loadBookings(); }}
        />
      )}

      {viewingReceipt && receiptData && (
        <ReceiptModal
          booking={receiptData.booking}
          sitter={receiptData.sitter}
          pet={receiptData.pet}
          onClose={() => { setViewingReceipt(false); setReceiptData(null); }}
        />
      )}

      {filingDispute && (
        <DisputeForm
          booking={filingDispute}
          sitterName={filingDispute.sitter_profiles?.users?.name || tr('bookings_sitterFallback')}
          onClose={() => setFilingDispute(null)}
          onDisputeFiled={() => { setFilingDispute(null); loadBookings(); }}
        />
      )}

      {photoCarousel && photoReport && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 }}>
          <div style={{ background:'white', borderRadius:24, padding:24, maxWidth:360, width:'90%', maxHeight:'90vh', overflow:'auto' }}>
            <div style={{ fontSize:18, fontWeight:700, color:'#1a1a1a', marginBottom:16 }}>{tr('bookings_walkProofPhotosTitle')}</div>

            {photoReport.photo_urls && photoReport.photo_urls.length > 0 && (
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:16 }}>
                {photoReport.photo_urls.map((url, i) => (
                  <div key={i} style={{ position:'relative', width:'100%', paddingBottom:'100%', overflow:'hidden', borderRadius:14, background:'#F0F0F0' }}>
                    <img src={url} alt={tr('bookings_walkProofAlt', { n: i+1 })} style={{ position:'absolute', top:0, left:0, width:'100%', height:'100%', objectFit:'cover' }} />
                  </div>
                ))}
              </div>
            )}

            <div style={{ background:'#E8F5E9', borderRadius:12, padding:'12px 14px', marginBottom:16, fontSize:13 }}>
              <div style={{ color:'#2E7D32', fontWeight:600, marginBottom:4 }}>{tr('bookings_proofProvidedMsg')}</div>
              <div style={{ fontSize:12, color:'#555' }}>{tr('bookings_photosUploadedOn', { date: new Date(photoReport.created_at).toLocaleDateString() })}</div>
              {photoReport.parent_confirmed && <div style={{ fontSize:12, color:'#2E7D32', marginTop:6 }}>{tr('bookings_photosConfirmedMsg')}</div>}
            </div>

            <div style={{ display:'flex', gap:8 }}>
              <button onClick={() => setPhotoCarousel(null)}
                style={{ flex:1, padding:'12px 0', borderRadius:12, border:'1.5px solid #E0E0E0', background:'white', color:'#888', fontSize:14, fontWeight:600, cursor:'pointer' }}>
                {tr('common_close')}
              </button>
              {!photoReport.parent_confirmed && (
                <button onClick={() => confirmPhotoReport(photoCarousel)} disabled={confirmingPhotos}
                  style={{ flex:1, padding:'12px 0', borderRadius:12, border:'none', background:t.primary, color:'white', fontSize:14, fontWeight:600, cursor:confirmingPhotos?'not-allowed':'pointer', opacity:confirmingPhotos?0.7:1 }}>
                  {confirmingPhotos ? tr('bookings_confirmingPhotos') : tr('bookings_confirmPhotosBtn')}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}