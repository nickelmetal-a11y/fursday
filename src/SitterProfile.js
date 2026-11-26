import React, { useState } from 'react';
import { useLanguage } from './i18n';
import { color, font, radius, ui } from './theme';
import Icon from './ui/Icon';

export default function SitterProfile({ onBack, onBook, sitter, city }) {
  const { t: tr } = useLanguage();
  const TAG_LABELS = { walk30: tr('sitterProfile_tagWalk30'), boarding: tr('sitterProfile_tagBoarding'), daycare: tr('sitterProfile_tagDaycare') };
  const [liked, setLiked] = useState(false);
  const s = sitter || {};
  const name = s.name || tr('sitterProfile_nameFallback');
  const rating = s.rating || 5.0;
  const reviewCount = s.reviews || 0;
  const price = s.price || tr('sitterProfile_priceFallback');
  const tags = s.tags || [];
  const area = s.area || city || tr('sitterProfile_areaFallback');

  return (
    <div style={{ ...ui.page, paddingBottom: 'calc(96px + env(safe-area-inset-bottom))' }}>
      <div style={{ ...ui.header, justifyContent: 'space-between' }}>
        <button type="button" onClick={onBack} aria-label={tr('common_back')} style={ui.backButton}>
          <Icon name="arrowLeft" size={20} />
        </button>
        <button type="button" onClick={() => setLiked(!liked)} aria-label={tr('sitterProfile_saveSitter')} aria-pressed={liked}
          style={{ ...ui.backButton, color: liked ? color.danger : color.ink }}>
          <Icon name={liked ? 'heartFilled' : 'heart'} size={20} />
        </button>
      </div>

      <div style={{ background: color.surface, padding: '20px 16px', borderBottom: `1px solid ${color.line}`, display: 'flex', gap: 16, alignItems: 'center' }}>
        <div style={{ width: 80, height: 80, borderRadius: radius.lg, background: color.navySoft, color: color.navy, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: font.xxl, fontWeight: 700, overflow: 'hidden', flexShrink: 0 }}>
          {s.profilePhoto ? <img src={s.profilePhoto} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (s.emoji || name[0].toUpperCase())}
        </div>
        <div style={{ minWidth: 0 }}>
          <h1 style={{ fontSize: font.xl, fontWeight: 700, color: color.ink, margin: 0, display: 'flex', alignItems: 'center', gap: 6, letterSpacing: -0.2 }}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
            {s.verified && <Icon name="shield" size={18} color={color.success} title={tr('sitterProfile_verifiedTitle')} />}
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: font.sm, color: color.muted, marginTop: 4 }}>
            <Icon name="pin" size={14} color={color.muted} />{area}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: font.sm, fontWeight: 600, color: color.ink }}>
              <Icon name="starFilled" size={14} color={color.saffron} />{rating.toFixed(1)}
            </span>
            {s.isTopSitter && <span style={{ ...ui.badge('warning'), background: color.saffronSoft }}>{tr('sitterProfile_topProBadge')}</span>}
          </div>
        </div>
      </div>

      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ ...ui.card, padding: 0, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)' }}>
          {[
            { val: tr('sitterProfile_ratingValue', { rating: rating.toFixed(1) }), lbl: tr('sitterProfile_statRatingLabel') },
            { val: reviewCount, lbl: tr('sitterProfile_statWalksDoneLabel') },
            { val: price, lbl: tr('sitterProfile_statFromLabel') },
          ].map((st, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, padding: '14px 6px', borderLeft: i ? `1px solid ${color.line}` : 'none', textAlign: 'center' }}>
              <div style={{ fontSize: font.lg, fontWeight: 700, color: color.ink, fontVariantNumeric: 'tabular-nums' }}>{st.val}</div>
              <div style={{ fontSize: font.xs, color: color.muted }}>{st.lbl}</div>
            </div>
          ))}
        </div>

        {s.verified && (
          <div style={ui.card}>
            <h2 style={ui.sectionTitle}>{tr('sitterProfile_verifiedTitle')}</h2>
            {[
              { icon: 'check', text: tr('sitterProfile_aadhaarVerifiedText') },
              { icon: 'shield', text: tr('sitterProfile_backgroundCheckedText') },
            ].map((item, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderTop: i ? `1px solid ${color.line}` : 'none' }}>
                <span style={{ width: 28, height: 28, borderRadius: radius.pill, background: color.successSoft, color: color.success, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon name={item.icon} size={16} />
                </span>
                <span style={{ fontSize: font.md, color: color.text }}>{item.text}</span>
              </div>
            ))}
          </div>
        )}

        {tags.length > 0 && (
          <div style={ui.card}>
            <h2 style={ui.sectionTitle}>{tr('sitterProfile_servicesTitle')}</h2>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {tags.map(tag => (
                <span key={tag} style={{ fontSize: font.sm, padding: '6px 12px', borderRadius: radius.pill, background: color.tile, color: color.text, fontWeight: 600 }}>{TAG_LABELS[tag] || tag}</span>
              ))}
            </div>
          </div>
        )}

        <div style={ui.card}>
          <h2 style={ui.sectionTitle}>{tr('sitterProfile_reviewsTitle')}</h2>
          <div style={{ textAlign: 'center', padding: '12px 0' }}>
            <div style={{ ...ui.iconTile, margin: '0 auto 10px' }}><Icon name="star" /></div>
            <div style={{ fontSize: font.md, fontWeight: 600, color: color.ink, marginBottom: 4 }}>{tr('sitterProfile_noReviewsTitle')}</div>
            <div style={{ fontSize: 13, color: color.muted }}>{tr('sitterProfile_noReviewsSub', { name })}</div>
          </div>
        </div>
      </div>

      {/* Messaging isn't available pre-booking — every row in `messages`
          requires a real booking_id, and there's no booking yet at this
          browse stage. A "Message" button here used to render with no
          onClick at all (dead tap target); removed rather than fake it. */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: color.surface, borderTop: `1px solid ${color.line}`, zIndex: 100 }}>
        <div style={{ maxWidth: 480, margin: '0 auto', padding: '12px 16px calc(12px + env(safe-area-inset-bottom))', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: font.xs, color: color.muted }}>{tr('sitterProfile_statFromLabel')}</div>
            <div style={{ fontSize: font.lg, fontWeight: 700, color: color.ink, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{price}</div>
          </div>
          <button type="button" onClick={onBook} style={{ ...ui.primaryButton, flex: 1 }}>
            {tr('sitterProfile_bookNowButton')}
          </button>
        </div>
      </div>
    </div>
  );
}
