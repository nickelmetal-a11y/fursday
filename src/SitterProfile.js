import React, { useState } from 'react';
import { MapPin, Star, Shield, ArrowLeft, Heart, Share2, CheckCircle } from 'lucide-react';
import { useLanguage } from './i18n';


const THEMES = {
  Gurgaon: { primary: '#FF6B35', light: '#FFF0EB' },
  Pune: { primary: '#6C5CE7', light: '#F0EEFF' },
};

export default function SitterProfile({ onBack, onBook, sitter, city }) {
  const t = THEMES[city] || THEMES.Gurgaon;
  const { t: tr } = useLanguage();
  const TAG_LABELS = { walk30: tr('sitterProfile_tagWalk30'), boarding: tr('sitterProfile_tagBoarding'), daycare: tr('sitterProfile_tagDaycare') };
  const [liked, setLiked] = useState(false);
  const s = sitter || {};
  const name = s.name || tr('sitterProfile_nameFallback');
  const rating = s.rating || 5.0;
  const reviewCount = s.reviews || 0;
  const price = s.price || 'Rs.299/walk';
  const tags = s.tags || [];
  const area = s.area || city || tr('sitterProfile_areaFallback');

  return (
    <div style={{ maxWidth: 390, margin: '0 auto', minHeight: '100vh', backgroundColor: '#FAFAFA', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', paddingBottom: 100 }}>

      <div style={{ position: 'relative', background: t.primary, height: 260, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: 20 }}>
        <div onClick={onBack} style={{ position: 'absolute', top: 48, left: 20, width: 36, height: 36, borderRadius: 12, background: 'rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <ArrowLeft size={18} color="white" />
        </div>
        <div onClick={() => setLiked(!liked)} style={{ position: 'absolute', top: 48, right: 60, width: 36, height: 36, borderRadius: 12, background: liked ? 'rgba(255,100,100,0.4)' : 'rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <Heart size={18} color="white" fill={liked ? 'white' : 'transparent'} />
        </div>
        <div style={{ position: 'absolute', top: 48, right: 16, width: 36, height: 36, borderRadius: 12, background: 'rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <Share2 size={18} color="white" />
        </div>
        <div style={{ width: 80, height: 80, borderRadius: 24, background: s.bg || '#FFE0B2', border: '3px solid white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, fontWeight: 700, marginBottom: 10, overflow: 'hidden' }}>
          {s.profilePhoto ? <img src={s.profilePhoto} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (s.emoji || name[0].toUpperCase())}
        </div>
        <div style={{ color: 'white', fontSize: 22, fontWeight: 700, marginBottom: 2, display: 'flex', alignItems: 'center', gap: 8 }}>
          {name}
          {s.isTopSitter && <span style={{ fontSize: 11, background: '#FFF9C4', color: '#E65100', borderRadius: 8, padding: '2px 8px', fontWeight: 700 }}>{tr('sitterProfile_topProBadge')}</span>}
        </div>
        <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}>
          <MapPin size={13} color="rgba(255,255,255,0.85)" />
          {area}
        </div>
      </div>

      <div style={{ padding: '0 20px' }}>

        <div style={{ background: 'white', borderRadius: 20, padding: '16px 10px', marginTop: 14, boxShadow: '0 2px 12px rgba(0,0,0,0.06)', display: 'flex', justifyContent: 'space-around' }}>
          {[
            { val: tr('sitterProfile_ratingValue', { rating: rating.toFixed(1) }), lbl: tr('sitterProfile_statRatingLabel') },
            { val: reviewCount, lbl: tr('sitterProfile_statWalksDoneLabel') },
            { val: price, lbl: tr('sitterProfile_statFromLabel') },
          ].map((st, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#1a1a1a' }}>{st.val}</div>
              <div style={{ fontSize: 11, color: '#888' }}>{st.lbl}</div>
            </div>
          ))}
        </div>

        {s.verified && (
          <div style={{ background: 'white', borderRadius: 20, padding: 16, marginTop: 14, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#1a1a1a', marginBottom: 12 }}>{tr('sitterProfile_verifiedTitle')}</div>
            {[
              { icon: <CheckCircle size={16} color="#2E7D32" />, text: tr('sitterProfile_aadhaarVerifiedText') },
              { icon: <Shield size={16} color="#2E7D32" />, text: tr('sitterProfile_backgroundCheckedText') },
            ].map((item, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: '#E8F5E9', borderRadius: 12, marginBottom: 8 }}>
                {item.icon}
                <span style={{ fontSize: 13, color: '#2E7D32', fontWeight: 500 }}>{item.text}</span>
              </div>
            ))}
          </div>
        )}

        {tags.length > 0 && (
          <div style={{ background: 'white', borderRadius: 20, padding: 16, marginTop: 14, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#1a1a1a', marginBottom: 12 }}>{tr('sitterProfile_servicesTitle')}</div>
            <div>
              {tags.map(tag => (
                <span key={tag} style={{ fontSize: 12, padding: '6px 12px', borderRadius: 20, background: t.light, color: t.primary, fontWeight: 500, display: 'inline-block', marginRight: 6, marginBottom: 6 }}>{TAG_LABELS[tag] || tag}</span>
              ))}
            </div>
          </div>
        )}

        <div style={{ background: 'white', borderRadius: 20, padding: 16, marginTop: 14, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#1a1a1a', marginBottom: 12 }}>{tr('sitterProfile_reviewsTitle')}</div>
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>&#128075;</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a', marginBottom: 4 }}>{tr('sitterProfile_noReviewsTitle')}</div>
            <div style={{ fontSize: 13, color: '#888' }}>{tr('sitterProfile_noReviewsSub', { name })}</div>
          </div>
        </div>

        <div style={{ height: 20 }} />
      </div>

      {/* Messaging isn't available pre-booking — every row in `messages`
          requires a real booking_id, and there's no booking yet at this
          browse stage. A "Message" button here used to render with no
          onClick at all (dead tap target); removed rather than fake it. */}
      <div style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: 390, background: 'white', borderTop: '1px solid #F0F0F0', padding: '12px 20px calc(24px + env(safe-area-inset-bottom))', display: 'flex', gap: 12 }}>
        <button onClick={onBook} style={{ flex: 1, padding: '14px 0', borderRadius: 16, border: 'none', background: t.primary, color: 'white', fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>
          {tr('sitterProfile_bookNowButton')}
        </button>
      </div>

    </div>
  );
}
