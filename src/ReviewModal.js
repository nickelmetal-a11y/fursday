import React, { useState } from 'react';
import { Star, X } from 'lucide-react';
import { supabase } from './supabase';

export default function ReviewModal({ booking, onClose, onSubmitted }) {
  const [rating, setRating] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const submitReview = async () => {
    if (rating === 0) { setError('Please select a rating'); return; }
    if (reviewText.trim().length < 10) { setError('Review must be at least 10 characters'); return; }

    setSubmitting(true);
    try {
      const { error: err } = await supabase.from('reviews').insert({
        booking_id: booking.id,
        sitter_id: booking.sitter_id,
        pet_parent_id: booking.pet_parent_id,
        rating,
        review_text: reviewText.trim(),
      });
      if (err) throw err;

      // TIER 1: Send review notification to sitter
      try {
        const { data: sitterData } = await supabase
          .from('sitter_profiles')
          .select('users(name, email, phone)')
          .eq('id', booking.sitter_id)
          .single();

        const { data: { user } } = await supabase.auth.getUser();

        if (sitterData && user) {
          const { notifyReviewReceived } = await import('./notificationService');
          await notifyReviewReceived(
            booking.sitter_id,
            sitterData.users?.email,
            rating,
            user.user_metadata?.name || 'A pet parent',
            booking.pet_name,
            reviewText.trim()
          );
        }
      } catch(notifErr) { console.error('Review notification failed:', notifErr); }

      onSubmitted && onSubmitted();
    } catch (e) {
      setError(e.message || 'Failed to submit review');
    }
    setSubmitting(false);
  };

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'flex-end', zIndex:1000 }}>
      <div style={{ width:'100%', maxWidth:390, background:'white', borderRadius:'24px 24px 0 0', padding:'24px', boxSizing:'border-box' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
          <div style={{ fontSize:18, fontWeight:700, color:'#1a1a1a' }}>Rate your experience</div>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', padding:0 }}>
            <X size={20} />
          </button>
        </div>

        {/* Sitter info */}
        <div style={{ background:'#F5F5F5', borderRadius:14, padding:14, marginBottom:20 }}>
          <div style={{ fontSize:14, fontWeight:600, color:'#1a1a1a' }}>How was your experience with {booking.sitter_name}?</div>
        </div>

        {/* Rating stars */}
        <div style={{ display:'flex', gap:12, marginBottom:20, justifyContent:'center' }}>
          {[1, 2, 3, 4, 5].map(r => (
            <button key={r} onClick={() => setRating(r)} style={{ background:'none', border:'none', cursor:'pointer', padding:0 }}>
              <Star size={40} fill={r <= rating ? '#FFC107' : 'transparent'} color={r <= rating ? '#FFC107' : '#DDD'} />
            </button>
          ))}
        </div>

        {rating > 0 && (
          <div style={{ textAlign:'center', fontSize:13, color:'#888', marginBottom:14 }}>
            {['Poor', 'Needs improvement', 'Good', 'Very good', 'Excellent'][rating - 1]}
          </div>
        )}

        {/* Review text */}
        <textarea value={reviewText} onChange={e => setReviewText(e.target.value)} placeholder="Tell other pet parents about your experience... (optional)"
          style={{ width:'100%', padding:'12px 14px', borderRadius:12, border:'1.5px solid #E0E0E0', fontSize:13, resize:'none', minHeight:80, fontFamily:'inherit', boxSizing:'border-box', marginBottom:12, outline:'none' }} />
        <div style={{ fontSize:11, color:'#AAA', marginBottom:16 }}>{reviewText.length}/500</div>

        {/* Error */}
        {error && (
          <div style={{ background:'#FCEBEB', borderRadius:10, padding:'10px 12px', marginBottom:14, fontSize:12, color:'#A32D2D' }}>
            {error}
          </div>
        )}

        {/* Buttons */}
        <div style={{ display:'flex', gap:10 }}>
          <button onClick={onClose} style={{ flex:1, padding:'12px 0', borderRadius:12, border:'1.5px solid #E0E0E0', background:'white', fontSize:14, fontWeight:600, cursor:'pointer', color:'#555' }}>
            Skip
          </button>
          <button onClick={submitReview} disabled={submitting || rating === 0} style={{ flex:1, padding:'12px 0', borderRadius:12, border:'none', background:rating === 0 ? '#E0E0E0' : '#FFC107', fontSize:14, fontWeight:600, cursor:rating === 0 ? 'not-allowed' : 'pointer', color:rating === 0 ? '#AAA' : '#1a1a1a' }}>
            {submitting ? 'Submitting...' : 'Submit review'}
          </button>
        </div>
      </div>
    </div>
  );
}
