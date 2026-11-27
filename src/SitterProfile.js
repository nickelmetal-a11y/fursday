import React, { useState, useEffect } from 'react';
import { supabase } from './supabase';
import { useLanguage } from './i18n';
import { HIGHLIGHT_KEYS } from './SitterEditProfile';
import { HOME_OPTIONS, homeOptionKey, isBoardingHost } from './BoardingHomeEditor';
import { color, font, radius, ui } from './theme';
import Icon from './ui/Icon';

const FACT_ICONS = {
  home_type: 'home', outdoor: 'tree', someone_home: 'clock', kids: 'users', other_pets: 'paw',
  sleeping: 'bed', ac: 'snowflake', max_dogs: 'boarding', sizes: 'scale', vet_km: 'stethoscope', updates: 'camera',
};

// Icon rows for the facts a host filled in, in the order parents weigh them.
function homeFacts(tr, d) {
  const opt = (field, v) => tr(homeOptionKey(field, v));
  return Object.keys(FACT_ICONS).flatMap(field => {
    const v = d[field];
    let value = null;
    if (field === 'ac') value = typeof v === 'boolean' ? tr(v ? 'bhome_ac_yes' : 'bhome_ac_no') : null;
    else if (field === 'max_dogs') value = v ? tr('boardingProfile_upToDogs', { n: v }) : null;
    else if (field === 'vet_km') value = v != null && v !== '' ? tr('boardingProfile_vetKm', { n: v }) : null;
    else if (Array.isArray(v)) value = v.length ? v.map(x => opt(field, x)).join(', ') : null;
    else if (v && HOME_OPTIONS[field]) value = opt(field, v);
    return value ? [{ field, icon: FACT_ICONS[field], label: tr('bhome_field_' + field), value }] : [];
  });
}

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
  // Headline, highlights, travel radius and the boarding home come from
  // sitter_profiles; fetch them when the card that opened this screen didn't
  // carry them. select('*') keeps working before migrations 035/037 run.
  const [extra, setExtra] = useState(null);
  useEffect(() => {
    if (!s.id || (s.headline !== undefined && s.home_details !== undefined)) return undefined;
    let off = false;
    (async () => {
      try {
        const { data } = await supabase.from('sitter_profiles').select('*, sitter_services(service_type, price_paise)').eq('id', s.id).maybeSingle();
        if (!off && data) setExtra(data);
      } catch (e) { /* display extras only */ }
    })();
    return () => { off = true; };
  }, [s.id, s.headline, s.home_details]);
  const headline = s.headline ?? extra?.headline;
  const highlights = s.highlights ?? extra?.highlights ?? [];
  const radiusKm = s.service_radius_km ?? extra?.service_radius_km;
  const baseArea = s.base_area ?? extra?.base_area;
  const providerType = s.provider_type ?? extra?.provider_type ?? 'sitter';
  const boardingOnly = providerType === 'boarding';
  const homeDetails = s.home_details ?? extra?.home_details ?? {};
  const homePhotos = s.home_photos ?? extra?.home_photos ?? [];
  const facts = isBoardingHost(providerType) ? homeFacts(tr, homeDetails) : [];
  const rules = isBoardingHost(providerType) ? (homeDetails.rules || '').trim() : '';
  const showHome = facts.length > 0 || homePhotos.length > 0 || !!rules;
  const boardingSvc = (extra?.sitter_services || s.services || []).find(sv => sv.service_type === 'boarding');
  const shownPrice = boardingOnly && boardingSvc ? tr('boardingProfile_pricePerNight', { n: Math.round(boardingSvc.price_paise / 100) }) : price;

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
          {headline && <div style={{ fontSize: font.md, color: color.text, marginTop: 4, lineHeight: 1.4 }}>{headline}</div>}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: font.sm, color: color.muted, marginTop: 4 }}>
            <Icon name="pin" size={14} color={color.muted} />{baseArea || area}
          </div>
          {boardingOnly
            ? <div style={{ fontSize: font.sm, color: color.muted, marginTop: 2 }}>{tr('boardingProfile_hostsAt')}</div>
            : radiusKm && <div style={{ fontSize: font.sm, color: color.muted, marginTop: 2 }}>{tr('sitterProfile_travelsUpTo', { n: Number(radiusKm) })}</div>}
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
            { val: reviewCount, lbl: tr(boardingOnly ? 'boardingProfile_staysLabel' : 'sitterProfile_statWalksDoneLabel') },
            { val: shownPrice, lbl: tr('sitterProfile_statFromLabel') },
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

        {showHome && (
          <section aria-label={tr('boardingProfile_title')} style={ui.card}>
            <h2 style={ui.sectionTitle}>{tr('boardingProfile_title')}</h2>
            {homePhotos.length > 0 && (
              <div style={{ display: 'flex', gap: 8, overflowX: 'auto', margin: '0 -16px 12px', padding: '0 16px 2px', scrollbarWidth: 'none' }}>
                {homePhotos.map((url, i) => (
                  <img key={url + i} src={url} alt={tr('boardingProfile_photoAlt', { name, n: i + 1 })}
                    style={{ width: 132, height: 100, borderRadius: radius.md, objectFit: 'cover', flexShrink: 0, display: 'block', background: color.tile }} />
                ))}
              </div>
            )}
            {facts.map((f, i) => (
              <div key={f.field} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderTop: i ? `1px solid ${color.line}` : 'none' }}>
                <span style={{ ...ui.iconTile, width: 36, height: 36 }}><Icon name={f.icon} size={18} /></span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: font.xs, color: color.muted }}>{f.label}</div>
                  <div style={{ fontSize: font.md, fontWeight: 600, color: color.ink }}>{f.value}</div>
                </div>
              </div>
            ))}
            {rules && (
              <div style={{ marginTop: facts.length ? 8 : 0, paddingTop: facts.length ? 12 : 0, borderTop: facts.length ? `1px solid ${color.line}` : 'none' }}>
                <div style={{ fontSize: font.sm, fontWeight: 700, color: color.ink, marginBottom: 4 }}>{tr('boardingProfile_rulesTitle')}</div>
                <div style={{ fontSize: font.md, color: color.text, lineHeight: 1.6, whiteSpace: 'pre-line', overflowWrap: 'anywhere' }}>{rules}</div>
              </div>
            )}
          </section>
        )}

        {highlights.length > 0 && (
          <div style={ui.card}>
            <h2 style={ui.sectionTitle}>{tr('sitterProfile_highlightsTitle')}</h2>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {highlights.map(h => (
                <span key={h} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: font.sm, padding: '6px 12px', borderRadius: radius.pill, background: color.navySoft, color: color.navy, fontWeight: 600 }}>
                  <Icon name="check" size={13} />{tr(HIGHLIGHT_KEYS[h] || h)}
                </span>
              ))}
            </div>
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
            <div style={{ fontSize: font.lg, fontWeight: 700, color: color.ink, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{shownPrice}</div>
          </div>
          <button type="button" onClick={onBook} style={{ ...ui.primaryButton, flex: 1 }}>
            {tr('sitterProfile_bookNowButton')}
          </button>
        </div>
      </div>
    </div>
  );
}
