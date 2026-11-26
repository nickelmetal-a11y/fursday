import React, { useState, useEffect } from 'react';
import { supabase } from './supabase';
import { useSupportContact, callSupport } from './supportContact';
import { useLanguage } from './i18n';
import { color, font, radius, shadow, ui, statusTone, navPadding } from './theme';
import Icon from './ui/Icon';
import ReviewModal from './ReviewModal';
import CancellationPolicyModal from './CancellationPolicyModal';
import ReceiptModal from './ReceiptModal';
import DisputeForm from './DisputeForm';

const SERVICE_NAME_KEYS = {
  walk30: 'service_walk',
  boarding: 'service_boarding',
  daycare: 'service_daycare',
  dropin: 'service_dropin',
  housesit: 'service_housesit',
};

const STATUS_LABEL_KEYS = {
  pending: 'bookings_statusPending',
  confirmed: 'bookings_statusConfirmed',
  active: 'bookings_statusActive',
  completed: 'bookings_statusCompleted',
  cancelled: 'bookings_statusCancelled',
};

const PAYMENT_STATUS_KEYS = {
  paid: 'bookings_paymentPaid',
  unpaid: 'bookings_paymentUnpaid',
  pending: 'bookings_paymentPending',
  refunded: 'bookings_paymentRefunded',
  failed: 'bookings_paymentFailed',
};

export default function BookingsDashboard({ onBack, city, onViewReport, onReview, onPayNow, onMessage, onNav }) {
  const { t: tr, lang } = useLanguage();
  const { phone: supportPhone } = useSupportContact();
  const [tab, setTab] = useState('upcoming');
  const [expanded, setExpanded] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  const [reportModal, setReportModal] = useState(null);
  const [reportReason, setReportReason] = useState('');
  const [reportSent, setReportSent] = useState(false);
  const [reviewingBooking, setReviewingBooking] = useState(null);
  const [reviewedIds, setReviewedIds] = useState(new Set());
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
      const { data: myReviews } = await supabase.from('reviews').select('booking_id').eq('reviewer_id', user.id);
      setReviewedIds(new Set((myReviews || []).map(r => r.booking_id)));

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

  const smallButton = { minHeight:44, padding:'0 12px', fontSize:13 };
  const rowButton = { ...ui.secondaryButton, ...smallButton, flex:1 };
  const sheetBackdrop = { position:'fixed', inset:0, background:'rgba(21,25,42,0.5)', zIndex:1000, display:'flex', alignItems:'flex-end', justifyContent:'center' };
  const sheet = { background:color.surface, borderRadius:'20px 20px 0 0', padding:'20px 20px calc(20px + env(safe-area-inset-bottom))', width:'100%', maxWidth:480, boxSizing:'border-box', maxHeight:'90vh', overflowY:'auto' };
  const closeButton = (onClick) => (
    <button type="button" onClick={onClick} aria-label={tr('common_close')}
      style={{ width:36, height:36, borderRadius:radius.pill, border:'none', background:color.tile, color:color.text, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', flexShrink:0 }}>
      <Icon name="plus" size={20} style={{ transform:'rotate(45deg)' }} />
    </button>
  );

  return (
    <div style={{ ...ui.page, paddingBottom: navPadding }}>
      <div style={ui.header}>
        <div style={{ minWidth:0 }}>
          <h1 style={ui.headerTitle}>{tr('bookings_title')}</h1>
          <div style={{ color:color.muted, fontSize:font.sm }}>{tr('bookings_subtitle')}</div>
        </div>
      </div>

      <div style={{ padding:'16px 16px 0' }}>
        <div style={{ background:color.tile, borderRadius:radius.md, padding:4, display:'flex', gap:4, marginBottom:16 }}>
          {[
            { id:'upcoming', label:tr('bookings_tabUpcoming'), count:upcoming.length },
            { id:'active', label:tr('bookings_tabActive'), count:active.length },
            { id:'past', label:tr('bookings_tabPast'), count:past.length },
          ].map(tb => {
            const on = tab === tb.id;
            return (
              <button key={tb.id} type="button" aria-pressed={on} onClick={() => setTab(tb.id)}
                style={{ flex:1, minHeight:40, padding:'0 6px', borderRadius:radius.sm, border:'none', background:on ? color.surface : 'transparent', boxShadow:on ? shadow.card : 'none', color:on ? color.ink : color.muted, fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:font.family, display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
                {tb.label}
                {tb.count > 0 && <span style={{ minWidth:18, height:18, padding:'0 5px', boxSizing:'border-box', borderRadius:radius.pill, background:on ? color.navy : color.line, color:on ? 'white' : color.text, fontSize:font.xs, fontWeight:700, display:'inline-flex', alignItems:'center', justifyContent:'center', fontVariantNumeric:'tabular-nums' }}>{tb.count}</span>}
              </button>
            );
          })}
        </div>

        {loading && (
          <div aria-busy="true">
            <span style={{ position:'absolute', width:1, height:1, overflow:'hidden', clip:'rect(0 0 0 0)', whiteSpace:'nowrap' }}>{tr('bookings_loadingBookings')}</span>
            {[0, 1, 2].map(i => (
              <div key={i} style={{ ...ui.card, marginBottom:12 }}>
                <div style={{ height:14, width:'45%', borderRadius:6, background:color.tile, marginBottom:8 }} />
                <div style={{ height:12, width:'30%', borderRadius:6, background:color.tile, marginBottom:14 }} />
                <div style={{ height:44, borderRadius:radius.md, background:color.tile }} />
              </div>
            ))}
          </div>
        )}

        {!loading && tabBookings.length === 0 && (
          <div style={{ ...ui.card, textAlign:'center', padding:28 }}>
            <div style={{ ...ui.iconTile, margin:'0 auto 12px' }}><Icon name="calendar" /></div>
            <div style={{ fontSize:font.lg, fontWeight:600, color:color.ink, marginBottom:4 }}>
              {tab==='upcoming'?tr('bookings_noUpcoming'):tab==='active'?tr('bookings_noActive'):tr('bookings_noPast')}
            </div>
            <div style={{ fontSize:font.md, color:color.muted, lineHeight:1.6 }}>
              {tab==='upcoming'?tr('bookings_noUpcomingHint'):tr('bookings_historyHint')}
            </div>
          </div>
        )}

        {!loading && tabBookings.map(b => {
          const scLabel = tr(STATUS_LABEL_KEYS[b.status] || STATUS_LABEL_KEYS.pending);
          const tone = statusTone[b.status] || 'warning';
          const isOpen = expanded === b.id;
          const sitterName = b.sitter_profiles && b.sitter_profiles.users ? b.sitter_profiles.users.name : tr('bookings_sitterFallback');
          const sitterPhone = b.sitter_profiles && b.sitter_profiles.users ? b.sitter_profiles.users.phone : '';
          const sitterRating = b.sitter_profiles ? b.sitter_profiles.rating : null;
          const needsPayment = b.status === 'confirmed' && b.payment_status !== 'paid';
          const accent = b.status === 'active' ? color.success : needsPayment ? color.navy : null;

          return (
            // The 20px radius + 12px gap identify a booking card in the scenario tests.
            <div key={b.id} style={{ background:color.surface, borderRadius:20, marginBottom:12, overflow:'hidden', border:`1px solid ${accent || color.line}`, boxShadow:accent ? `inset 0 0 0 1px ${accent}` : 'none' }}>
              <div onClick={() => setExpanded(isOpen ? null : b.id)} tabIndex={0} aria-expanded={isOpen}
                onKeyDown={(e) => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); setExpanded(isOpen ? null : b.id); } }}
                style={{ padding:16, cursor:'pointer' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:12, marginBottom:8 }}>
                  <div style={{ minWidth:0 }}>
                    <div style={{ fontSize:15, fontWeight:700, color:color.ink, marginBottom:2 }}>{SERVICE_NAME_KEYS[b.service_type] ? tr(SERVICE_NAME_KEYS[b.service_type]) : b.service_type}</div>
                    <div style={{ fontSize:font.sm, color:color.muted }}>{tr('bookings_withSitter', { name: sitterName })}</div>
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:6, flexShrink:0 }}>
                    <div style={{ fontSize:15, fontWeight:700, color:color.ink, fontVariantNumeric:'tabular-nums' }}>Rs.{Math.round((b.gross_amount_paise||0)/100)}</div>
                    <span style={ui.badge(tone)}>{scLabel}</span>
                  </div>
                </div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:14, alignItems:'center' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                    <Icon name="calendar" size={14} color={color.muted} />
                    <span style={{ fontSize:font.sm, color:color.text }}>{b.booking_date}</span>
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                    <Icon name="clock" size={14} color={color.muted} />
                    <span style={{ fontSize:font.sm, color:color.text }}>{b.time_slot}</span>
                  </div>
                  {sitterRating > 0 && (
                    <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                      <Icon name="starFilled" size={13} color={color.saffron} />
                      <span style={{ fontSize:font.sm, fontWeight:600, color:color.ink }}>{sitterRating}</span>
                    </div>
                  )}
                </div>
                {b.status === 'pending' && (
                  <div style={{ marginTop:12, background:color.warningSoft, borderRadius:radius.md, padding:'9px 12px', display:'flex', alignItems:'center', gap:8 }}>
                    <Icon name="clock" size={15} color={color.warning} />
                    <span style={{ fontSize:font.sm, color:color.warning, fontWeight:600 }}>{tr('bookings_waitingForAccept', { name: sitterName })}</span>
                  </div>
                )}
                {['pending','confirmed'].includes(b.status) && (
                  <button type="button" onClick={(e) => { e.stopPropagation(); setCancellingBooking(b); }}
                    style={{ ...ui.dangerButton, marginTop:10, width:'100%', border:`1px solid ${color.line}` }}>
                    {tr('bookings_cancelBooking')}
                  </button>
                )}
                {needsPayment && (
                  <button type="button" onClick={(e) => { e.stopPropagation(); onPayNow && onPayNow(b); }}
                    style={{ ...ui.primaryButton, marginTop:8, width:'100%', fontSize:14 }}>
                    {tr('bookings_payNowCta', { name: sitterName, amount: Math.round((b.gross_amount_paise||0)/100) })}
                  </button>
                )}
                {b.status === 'confirmed' && b.payment_status === 'paid' && b.start_otp && (
                  <div onClick={(e) => e.stopPropagation()} style={{ marginTop:12, background:color.navySoft, borderRadius:radius.md, padding:'12px 14px' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:13, fontWeight:600, color:color.ink, marginBottom:4 }}>
                      <Icon name="key" size={16} color={color.navy} />
                      {['boarding','daycare'].includes(b.service_type) ? tr('bookings_dropOffCodeTitle') : tr('bookings_startCodeTitle')}
                    </div>
                    <div style={{ fontSize:font.sm, color:color.muted, marginBottom:10, lineHeight:1.5 }}>{['boarding','daycare'].includes(b.service_type)?tr('bookings_otpHintBoarding',{ name: sitterName }):tr('bookings_otpHintWalk',{ name: sitterName })}</div>
                    <div style={{ background:color.surface, borderRadius:radius.sm, padding:'10px 12px', textAlign:'center', fontSize:28, fontWeight:700, letterSpacing:10, color:color.navy, fontVariantNumeric:'tabular-nums' }}>{b.start_otp}</div>
                  </div>
                )}
                {b.status === 'active' && (
                  <div onClick={(e) => e.stopPropagation()} style={{ marginTop:12 }}>
                    <div style={{ background:color.successSoft, borderRadius:radius.md, padding:'9px 12px', display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
                      <span style={{ width:8, height:8, borderRadius:radius.pill, background:color.success, flexShrink:0 }} />
                      <span style={{ fontSize:font.sm, color:color.success, fontWeight:600 }}>{['boarding','daycare'].includes(b.service_type)?tr('bookings_dogWithSitter',{ name: sitterName }):tr('bookings_walkInProgress')}</span>
                    </div>
                    {sitterPhone && (
                      <a href={'tel:'+sitterPhone} style={{ ...ui.dangerButton, width:'100%', boxSizing:'border-box', textDecoration:'none', display:'flex', alignItems:'center', justifyContent:'center', gap:8, marginBottom:8, border:`1px solid ${color.danger}` }}>
                        {tr('bookings_emergencyContactCta', { phone: sitterPhone })}
                      </a>
                    )}
                    {['boarding','daycare'].includes(b.service_type) && (
                      <div style={{ background:color.tile, borderRadius:radius.md, padding:'12px 14px' }}>
                        <div style={{ fontSize:13, fontWeight:600, color:color.ink, marginBottom:4 }}>{tr('bookings_confirmPickupTitle')}</div>
                        <div style={{ fontSize:font.sm, color:color.muted, marginBottom:10, lineHeight:1.5 }}>{tr('bookings_confirmPickupHint', { name: sitterName })}</div>
                        <div style={{ display:'flex', gap:8 }}>
                          <input value={endOtpEntry[b.id] || ''} onChange={e => setEndOtpEntry({ ...endOtpEntry, [b.id]: e.target.value.replace(/\D/g,'').slice(0,4) })}
                            placeholder="0000" inputMode="numeric" maxLength={4}
                            style={{ ...ui.input, flex:1, minWidth:0, fontSize:18, letterSpacing:6, textAlign:'center', padding:'8px 12px' }} />
                          <button type="button" onClick={() => verifyEndOtp(b)} style={{ ...ui.primaryButton, minHeight:44, fontSize:14, flexShrink:0 }}>{tr('common_confirm')}</button>
                        </div>
                        {endOtpError[b.id] && <div style={{ fontSize:font.sm, color:color.danger, marginTop:6 }}>{endOtpError[b.id]}</div>}
                      </div>
                    )}
                  </div>
                )}
                <div style={{ display:'flex', gap:8, marginTop:10 }}>
                  <button type="button" onClick={(e) => { e.stopPropagation(); onMessage && onMessage(b, sitterName, sitterPhone, b.sitter_profiles?.user_id); }}
                    style={{ ...rowButton, color:color.navy }}>
                    <Icon name="message" size={16} /> {tr('bookings_message')}
                  </button>
                  {sitterPhone && (
                    <a onClick={(e) => e.stopPropagation()} href={'tel:'+sitterPhone} style={{ ...rowButton, boxSizing:'border-box', textDecoration:'none' }}>
                      <Icon name="phone" size={16} /> {tr('bookings_call')}
                    </a>
                  )}
                </div>
              </div>

              {isOpen && (
                <div style={{ padding:'0 16px 16px', borderTop:`1px solid ${color.line}` }}>
                  <div style={{ fontSize:font.xs, color:color.muted, margin:'14px 0 6px', fontWeight:600, textTransform:'uppercase', letterSpacing:0.5 }}>{tr('bookings_detailsHeading')}</div>
                  {[
                    { label:tr('bookings_labelRef'), val:b.booking_ref },
                    { label:tr('bookings_labelPayment'), val:PAYMENT_STATUS_KEYS[b.payment_status] ? tr(PAYMENT_STATUS_KEYS[b.payment_status]) : b.payment_status },
                    { label:tr('bookings_labelNotes'), val:b.parent_notes || tr('bookings_none') },
                  ].filter(x => x.val).map((x,i) => (
                    <div key={i} style={{ display:'flex', justifyContent:'space-between', gap:12, padding:'8px 0', borderTop:i ? `1px solid ${color.line}` : 'none' }}>
                      <span style={{ fontSize:font.sm, color:color.muted, flexShrink:0 }}>{x.label}</span>
                      <span style={{ fontSize:font.sm, color:color.ink, fontWeight:500, textAlign:'right' }}>{x.val}</span>
                    </div>
                  ))}
                  <div style={{ display:'flex', flexDirection:'column', gap:8, marginTop:10 }}>
                    {b.status === 'active' && (
                      <button type="button" onClick={() => callSupport(supportPhone)}
                        style={{ ...ui.dangerButton, width:'100%', background:color.dangerSoft, border:'none', display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
                        {tr('bookings_emergencySupportCta')}
                      </button>
                    )}
                    {(b.status === 'pending' || b.status === 'confirmed') && (
                      <button type="button" onClick={() => setCancellingBooking(b)} style={{ ...ui.dangerButton, width:'100%', border:`1px solid ${color.line}` }}>
                        {tr('bookings_cancelThisBooking')}
                      </button>
                    )}
                    {b.status === 'completed' && b.sitter_uploaded_photos && (
                      <button type="button" onClick={() => viewPhotoReport(b)} style={{ ...ui.secondaryButton, ...smallButton, width:'100%', color:color.navy }}>
                        {tr('bookings_viewWalkProof')}
                      </button>
                    )}
                    {b.status === 'completed' && (
                      <>
                        <div style={{ display:'flex', gap:8 }}>
                          <button type="button" onClick={() => viewReceipt(b)} style={rowButton}>
                            {tr('bookings_receiptBtn')}
                          </button>
                          <button type="button" onClick={() => onViewReport && onViewReport(b)} style={rowButton}>
                            {tr('bookings_walkReportBtn')}
                          </button>
                          {reviewedIds.has(b.id) ? (
                            <div style={{ flex:1, minHeight:44, borderRadius:radius.md, background:color.successSoft, color:color.success, fontSize:13, fontWeight:600, display:'flex', alignItems:'center', justifyContent:'center' }}>
                              {tr('bookings_reviewedLabel')}
                            </div>
                          ) : (
                            <button type="button" onClick={() => setReviewingBooking(b)} style={{ ...ui.primaryButton, ...smallButton, flex:1 }}>
                              {tr('bookings_reviewBtn')}
                            </button>
                          )}
                        </div>
                        <div style={{ display:'flex', gap:8 }}>
                          <button type="button" onClick={() => onNav && onNav('book', { repeatBooking: b })} style={{ ...rowButton, color:color.navy, borderColor:color.navy }}>
                            {tr('bookings_bookAgain')}
                          </button>
                          <button type="button" onClick={() => setFilingDispute(b)} style={{ ...rowButton, color:color.muted }}>
                            {tr('bookings_disputeBtn')}
                          </button>
                        </div>
                      </>
                    )}
                    {(b.status === 'completed' || b.status === 'active') && (
                      <button type="button" onClick={() => setReportModal({ id: b.id, name: sitterName })}
                        style={{ minHeight:40, background:'none', border:'none', color:color.muted, fontSize:font.sm, fontWeight:600, cursor:'pointer', fontFamily:font.family }}>
                        {tr('bookings_reportProblemSitter')}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {reportSent && (
        <div role="status" style={{ position:'fixed', top:'calc(12px + env(safe-area-inset-top))', left:16, right:16, maxWidth:448, margin:'0 auto', background:color.success, color:'white', borderRadius:radius.md, padding:'12px 16px', fontSize:13, fontWeight:600, zIndex:2000 }}>
          {tr('bookings_reportSubmittedToast')}
        </div>
      )}
      {reportModal && (
        <div style={sheetBackdrop}>
          <div role="dialog" aria-modal="true" style={sheet}>
            <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:12, marginBottom:4 }}>
              <div style={{ fontSize:font.lg, fontWeight:700, color:color.ink, paddingTop:6 }}>{tr('bookings_reportSitterTitle', { name: reportModal.name })}</div>
              {closeButton(() => { setReportModal(null); setReportReason(''); })}
            </div>
            <div style={{ fontSize:13, color:color.muted, marginBottom:16 }}>{tr('bookings_reportIntro')}</div>
            {[
              { key:'bookings_reasonLate', text:'Sitter was late or no-show' },
              { key:'bookings_reasonCare', text:'Pet was not cared for properly' },
              { key:'bookings_reasonRude', text:'Sitter was rude or unprofessional' },
              { key:'bookings_reasonSafety', text:'Safety concern during walk' },
              { key:'bookings_reasonOtherIssue', text:'Other issue' },
            ].map(reason => {
              const on = reportReason === reason.text;
              return (
                <button type="button" key={reason.text} onClick={() => setReportReason(reason.text)} aria-pressed={on}
                  style={{ display:'flex', alignItems:'center', width:'100%', minHeight:48, textAlign:'left', fontFamily:'inherit', padding:'0 14px', borderRadius:radius.md, border:`1px solid ${on ? color.navy : color.line}`, background:on ? color.navySoft : color.surface, marginBottom:8, fontSize:14, cursor:'pointer', fontWeight:on ? 600 : 400, color:on ? color.navy : color.ink }}>
                  {tr(reason.key)}
                </button>
              );
            })}
            <div style={{ display:'flex', gap:8, marginTop:8 }}>
              <button type="button" onClick={() => { setReportModal(null); setReportReason(''); }} style={{ ...ui.secondaryButton, flex:1, color:color.muted }}>
                {tr('common_cancel')}
              </button>
              <button type="button" onClick={() => submitReport(reportModal.id, reportModal.name)} disabled={!reportReason}
                style={{ ...ui.primaryButton, flex:2, background:reportReason ? color.danger : color.line, color:reportReason ? 'white' : color.faint, cursor:reportReason ? 'pointer' : 'not-allowed' }}>
                {tr('bookings_submitReport')}
              </button>
            </div>
          </div>
        </div>
      )}

      {reviewingBooking && (
        <ReviewModal
          booking={{ ...reviewingBooking, sitter_name: reviewingBooking.sitter_profiles?.users?.name || tr('bookings_sitterFallback') }}
          onClose={() => setReviewingBooking(null)}
          onSubmitted={() => { setReviewedIds(prev => new Set([...prev, reviewingBooking.id])); setReviewingBooking(null); loadBookings(); }}
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
        <div style={sheetBackdrop}>
          <div role="dialog" aria-modal="true" style={sheet}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, marginBottom:16 }}>
              <div style={{ fontSize:font.lg, fontWeight:700, color:color.ink }}>{tr('bookings_walkProofPhotosTitle')}</div>
            </div>

            {photoReport.photo_urls && photoReport.photo_urls.length > 0 && (
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:16 }}>
                {photoReport.photo_urls.map((url, i) => (
                  <div key={i} style={{ position:'relative', width:'100%', paddingBottom:'100%', overflow:'hidden', borderRadius:radius.md, background:color.tile }}>
                    <img src={url} alt={tr('bookings_walkProofAlt', { n: i+1 })} style={{ position:'absolute', top:0, left:0, width:'100%', height:'100%', objectFit:'cover' }} />
                  </div>
                ))}
              </div>
            )}

            <div style={{ background:color.successSoft, borderRadius:radius.md, padding:'12px 14px', marginBottom:16, fontSize:13 }}>
              <div style={{ color:color.success, fontWeight:600, marginBottom:4 }}>{tr('bookings_proofProvidedMsg')}</div>
              <div style={{ fontSize:font.sm, color:color.text }}>{tr('bookings_photosUploadedOn', { date: new Date(photoReport.created_at).toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-IN') })}</div>
              {photoReport.parent_confirmed && <div style={{ fontSize:font.sm, color:color.success, marginTop:6 }}>{tr('bookings_photosConfirmedMsg')}</div>}
            </div>

            <div style={{ display:'flex', gap:8 }}>
              <button type="button" onClick={() => setPhotoCarousel(null)} style={{ ...ui.secondaryButton, flex:1 }}>
                {tr('common_close')}
              </button>
              {!photoReport.parent_confirmed && (
                <button type="button" onClick={() => confirmPhotoReport(photoCarousel)} disabled={confirmingPhotos}
                  style={{ ...ui.primaryButton, flex:1, cursor:confirmingPhotos?'not-allowed':'pointer', opacity:confirmingPhotos?0.7:1 }}>
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
