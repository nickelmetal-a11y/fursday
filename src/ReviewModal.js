import React, { useState } from 'react';
import { supabase } from './supabase';
import { useLanguage } from './i18n';
import { color, font, radius, ui } from './theme';
import Icon from './ui/Icon';

export default function ReviewModal({ booking, onClose, onSubmitted }) {
  const { t: tr } = useLanguage();
  const [rating, setRating] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const ratingLabels = [
    tr('review_ratingPoor'),
    tr('review_ratingNeedsImprovement'),
    tr('review_ratingGood'),
    tr('review_ratingVeryGood'),
    tr('review_ratingExcellent'),
  ];

  const submitReview = async () => {
    if (rating === 0) { setError(tr('review_selectRatingError')); return; }
    if (reviewText.trim().length < 10) { setError(tr('review_minLengthError')); return; }

    setSubmitting(true);
    try {
      const { error: err } = await supabase.from('reviews').insert({
        booking_id: booking.id,
        sitter_id: booking.sitter_id,
        reviewer_id: booking.pet_parent_id,
        rating,
        review_text: reviewText.trim(),
      });
      if (err) throw err;

      // TIER 1: Send review notification to sitter
      try {
        const { data: sitterData } = await supabase
          .from('sitter_profiles')
          .select('user_id, users(name), rating')
          .eq('id', booking.sitter_id)
          .single();

        const { data: { user } } = await supabase.auth.getUser();

        if (sitterData && user) {
          const { data: sitterContact } = sitterData.user_id
            ? await supabase.rpc('get_user_contact', { target_id: sitterData.user_id })
            : { data: null };
          const { notifyReviewReceived, notifyRatingUpdate } = await import('./notificationService');

          // Send review notification
          await notifyReviewReceived(
            sitterData.user_id, // notifications.user_id is a real users.id FK, not sitter_profiles.id
            sitterContact?.[0]?.email,
            rating,
            user.user_metadata?.name || 'A pet parent',
            booking.pet_name,
            reviewText.trim()
          );

          // TIER 3: Send rating update notification with old vs new rating
          const oldRating = sitterData.rating || 5.0;
          await notifyRatingUpdate(
            sitterData.user_id,
            sitterContact?.[0]?.phone,
            oldRating,
            rating
          );
        }
      } catch(notifErr) { console.error('Review notification failed:', notifErr); }

      onSubmitted && onSubmitted();
    } catch (e) {
      setError(e.message || tr('review_submitFailedFallback'));
    }
    setSubmitting(false);
  };

  // Markup order matters to the scenario tests: close button first, then the
  // five star buttons, and the textarea sits directly inside the sheet.
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(21,25,42,0.5)', display:'flex', alignItems:'flex-end', justifyContent:'center', zIndex:1000, fontFamily:font.family }}>
      <div role="dialog" aria-modal="true" style={{ width:'100%', maxWidth:480, background:color.surface, borderRadius:'20px 20px 0 0', padding:'20px 20px calc(20px + env(safe-area-inset-bottom))', boxSizing:'border-box', maxHeight:'90vh', overflowY:'auto' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:12, marginBottom:16 }}>
          <div style={{ fontSize:font.lg + 2, fontWeight:700, color:color.ink }}>{tr('review_title')}</div>
          <button type="button" onClick={onClose} aria-label={tr('common_close')}
            style={{ width:36, height:36, borderRadius:radius.pill, border:'none', background:color.tile, color:color.text, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', padding:0, flexShrink:0 }}>
            <Icon name="plus" size={20} style={{ transform:'rotate(45deg)' }} />
          </button>
        </div>

        {/* Sitter info */}
        <div style={{ fontSize:font.md, color:color.text, marginBottom:16, textAlign:'center' }}>
          {tr('review_howWasExperience', { name: booking.sitter_name })}
        </div>

        {/* Rating stars */}
        <div style={{ display:'flex', gap:6, marginBottom:8, justifyContent:'center' }}>
          {[1, 2, 3, 4, 5].map(r => (
            <button type="button" key={r} onClick={() => setRating(r)} aria-label={tr('review_rateStarsAria', { n: r })} aria-pressed={r === rating}
              style={{ width:52, height:52, background:'none', border:'none', cursor:'pointer', padding:0, display:'flex', alignItems:'center', justifyContent:'center', color:r <= rating ? color.saffron : color.line }}>
              <Icon name={r <= rating ? 'starFilled' : 'star'} size={38} strokeWidth={1.5} />
            </button>
          ))}
        </div>

        <div style={{ textAlign:'center', fontSize:13, fontWeight:600, color:color.text, minHeight:20, marginBottom:14 }}>
          {rating > 0 ? ratingLabels[rating - 1] : ''}
        </div>

        {/* Review text */}
        <textarea value={reviewText} onChange={e => setReviewText(e.target.value)} placeholder={tr('review_textareaPlaceholder')} aria-label={tr('review_textareaAria')}
          style={{ ...ui.input, fontSize:14, resize:'none', minHeight:96, lineHeight:1.5, marginBottom:6 }} />
        <div style={{ fontSize:font.xs, color:color.faint, marginBottom:14, textAlign:'right', fontVariantNumeric:'tabular-nums' }}>{tr('review_charCount', { count: reviewText.length })}</div>

        {/* Error */}
        {error && (
          <div role="alert" style={{ background:color.dangerSoft, borderRadius:radius.md, padding:'10px 12px', marginBottom:14, fontSize:13, color:color.danger }}>
            {error}
          </div>
        )}

        {/* Buttons */}
        <div style={{ display:'flex', gap:10 }}>
          <button type="button" onClick={onClose} style={{ ...ui.secondaryButton, flex:1, color:color.muted }}>
            {tr('review_skip')}
          </button>
          <button type="button" onClick={submitReview} disabled={submitting || rating === 0}
            style={{ ...ui.primaryButton, flex:2, background:rating === 0 ? color.line : color.navy, color:rating === 0 ? color.faint : 'white', cursor:rating === 0 ? 'not-allowed' : 'pointer' }}>
            {submitting ? tr('review_submittingButton') : tr('review_submitButton')}
          </button>
        </div>
      </div>
    </div>
  );
}
