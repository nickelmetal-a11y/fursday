import React, { useState, useEffect } from 'react';
import { supabase } from './supabase';
import { useLanguage } from './i18n';
import { HIGHLIGHT_KEYS } from './SitterEditProfile';
import { HOME_OPTIONS, homeOptionKey, isBoardingHost } from './BoardingHomeEditor';
import { sitterRating } from './sitterCard';
import SitterRating from './SitterRating';
import { ShareSheet, shareLink, shareUrlFor, slugForSitter } from './ShareProfileCard';
import { color, font, radius, ui } from './theme';
import Icon from './ui/Icon';

const REVIEWS_SHOWN = 5;

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

function Stars({ n, size = 13 }) {
  return [1, 2, 3, 4, 5].map(i => <Icon key={i} name={i <= n ? 'starFilled' : 'star'} size={size} color={i <= n ? color.saffron : color.line} />);
}

export default function SitterProfile({ onBack, onBook, sitter, city, isGuest, onRequireSignIn, onAskQuestion }) {
  const { t: tr, lang } = useLanguage();
  const TAG_LABELS = { walk30: tr('sitterProfile_tagWalk30'), boarding: tr('sitterProfile_tagBoarding'), daycare: tr('sitterProfile_tagDaycare') };
  const [liked, setLiked] = useState(false);
  const [reviews, setReviews] = useState(null);
  const [showAllReviews, setShowAllReviews] = useState(false);
  const [shareSheet, setShareSheet] = useState(null);
  const s = sitter || {};
  const name = s.name || s.users?.name || tr('sitterProfile_nameFallback');
  const firstName = name.trim().split(/\s+/)[0];
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

  // Visitors can't read reviews until migration 038 opens them up; the
  // section is hidden rather than showing a false "no reviews".
  useEffect(() => {
    if (!s.id) { setReviews(false); return undefined; }
    let off = false;
    (async () => {
      try {
        const { data, error } = await supabase.from('reviews').select('*, users(name)').eq('sitter_id', s.id).order('created_at', { ascending: false });
        if (!off) setReviews(error || !Array.isArray(data) ? false : data.filter(r => r.is_visible !== false));
      } catch (e) { if (!off) setReviews(false); }
    })();
    return () => { off = true; };
  }, [s.id]);

  useEffect(() => {
    if (isGuest || !s.id) return undefined;
    let off = false;
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data } = await supabase.from('favorites').select('sitter_id').eq('pet_parent_id', user.id).eq('sitter_id', s.id);
        if (!off && Array.isArray(data) && data.length) setLiked(true);
      } catch (e) { /* favourites are optional */ }
    })();
    return () => { off = true; };
  }, [isGuest, s.id]);

  const toggleLike = async () => {
    if (isGuest) { onRequireSignIn && onRequireSignIn({ type: 'favorite', sitter: s }); return; }
    const next = !liked;
    setLiked(next);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      if (next) await supabase.from('favorites').insert({ sitter_id: s.id, pet_parent_id: user.id });
      else await supabase.from('favorites').delete().eq('sitter_id', s.id).eq('pet_parent_id', user.id);
    } catch (e) { /* the heart still reflects the tap */ }
  };

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
  const walks = s.walks ?? s.total_bookings ?? extra?.total_bookings ?? 0;

  const loaded = Array.isArray(reviews) ? reviews : null;
  const fromCard = s.reviewCount !== undefined ? { rating: s.rating ?? null, count: s.reviewCount } : sitterRating({ ...extra, ...s });
  const rating = loaded ? (loaded.length ? Math.round((loaded.reduce((a, r) => a + (Number(r.rating) || 0), 0) / loaded.length) * 10) / 10 : null) : fromCard.rating;
  const reviewCount = loaded ? loaded.length : fromCard.count;
  const shownReviews = loaded ? (showAllReviews ? loaded : loaded.slice(0, REVIEWS_SHOWN)) : [];
  const dateLocale = lang === 'hi' ? 'hi-IN' : 'en-IN';

  const share = async () => {
    const url = shareUrlFor(slugForSitter({ ...s, name, base_area: baseArea, share_slug: s.share_slug ?? extra?.share_slug }));
    const payload = { title: name, text: tr('share_otherMessage', { name }), url };
    if ((await shareLink(payload)) === 'fallback') setShareSheet(payload);
  };

  return (
    <div style={{ ...ui.page, paddingBottom: 'calc(96px + env(safe-area-inset-bottom))' }}>
      <div style={{ ...ui.header, justifyContent: 'space-between' }}>
        <button type="button" onClick={onBack} aria-label={tr('common_back')} style={ui.backButton}>
          <Icon name="arrowLeft" size={20} />
        </button>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" onClick={share} aria-label={tr('share_profileButton')} style={{ ...ui.backButton, width: 44, height: 44 }}>
            <Icon name="share" size={20} />
          </button>
          <button type="button" onClick={toggleLike} aria-label={tr('sitterProfile_saveSitter')} aria-pressed={liked}
            style={{ ...ui.backButton, width: 44, height: 44, color: liked ? color.danger : color.ink }}>
            <Icon name={liked ? 'heartFilled' : 'heart'} size={20} />
          </button>
        </div>
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 8, fontSize: font.sm, color: color.muted }}>
            <SitterRating rating={rating} count={reviewCount} size={14} />
            {s.isTopSitter && <span style={{ ...ui.badge('warning'), background: color.saffronSoft }}>{tr('sitterProfile_topProBadge')}</span>}
          </div>
        </div>
      </div>

      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ ...ui.card, padding: 0, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)' }}>
          {[
            { val: rating != null ? tr('sitterProfile_ratingValue', { rating: rating.toFixed(1) }) : tr('rating_new'), lbl: tr('sitterProfile_statRatingLabel') },
            { val: walks, lbl: tr(boardingOnly ? 'boardingProfile_staysLabel' : 'sitterProfile_statWalksDoneLabel') },
            { val: shownPrice, lbl: tr('sitterProfile_statFromLabel') },
          ].map((st, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, padding: '14px 6px', borderLeft: i ? `1px solid ${color.line}` : 'none', textAlign: 'center' }}>
              <div style={{ fontSize: font.lg, fontWeight: 700, color: color.ink, fontVariantNumeric: 'tabular-nums' }}>{st.val}</div>
              <div style={{ fontSize: font.xs, color: color.muted }}>{st.lbl}</div>
            </div>
          ))}
        </div>

        {onAskQuestion && (
          <div style={{ ...ui.card, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: font.md, color: color.text, lineHeight: 1.5 }}>{tr('sitterProfile_askHint', { name: firstName })}</div>
            <button type="button" onClick={() => onAskQuestion(s)} style={{ ...ui.secondaryButton, width: '100%' }}>
              <Icon name="message" size={18} />{tr('sitterProfile_askQuestion')}
            </button>
          </div>
        )}

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

        {reviews !== false && (
          <section aria-label={tr('sitterProfile_reviewsTitle')} style={ui.card}>
            <h2 style={ui.sectionTitle}>{tr('sitterProfile_reviewsTitle')}</h2>
            {reviews === null && [0, 1].map(i => <div key={i} style={{ height: 56, borderRadius: radius.md, background: color.tile, marginBottom: 8 }} />)}
            {loaded && loaded.length === 0 && (
              <div style={{ textAlign: 'center', padding: '12px 0' }}>
                <div style={{ ...ui.iconTile, margin: '0 auto 10px' }}><Icon name="star" /></div>
                <div style={{ fontSize: font.md, fontWeight: 600, color: color.ink, marginBottom: 4 }}>{tr('sitterProfile_noReviewsTitle')}</div>
                <div style={{ fontSize: 13, color: color.muted }}>{tr('sitterProfile_noReviewsSub', { name })}</div>
              </div>
            )}
            {loaded && loaded.length > 0 && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                  <span style={{ fontSize: font.xxl, fontWeight: 700, color: color.ink, fontVariantNumeric: 'tabular-nums' }}>{rating.toFixed(1)}</span>
                  <span>
                    <span style={{ display: 'flex', gap: 1 }} role="img" aria-label={tr('sitterProfile_reviewStarsAria', { n: rating.toFixed(1) })}><Stars n={Math.round(rating)} size={15} /></span>
                    <span style={{ display: 'block', fontSize: font.sm, color: color.muted, marginTop: 2 }}>
                      {loaded.length === 1 ? tr('sitterProfile_reviewCountOne') : tr('sitterProfile_reviewCountMany', { n: loaded.length })}
                    </span>
                  </span>
                </div>
                <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                  {shownReviews.map(r => (
                    <li key={r.id} style={{ padding: '12px 0', borderTop: `1px solid ${color.line}` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: font.md, fontWeight: 600, color: color.ink }}>{(r.users?.name || '').trim().split(/\s+/)[0] || tr('sitterProfile_reviewerFallback')}</span>
                        {r.created_at && <span style={{ fontSize: font.xs, color: color.muted }}>{new Date(r.created_at).toLocaleDateString(dateLocale, { day: 'numeric', month: 'short', year: 'numeric' })}</span>}
                      </div>
                      <span style={{ display: 'flex', gap: 1, margin: '4px 0' }} role="img" aria-label={tr('sitterProfile_reviewStarsAria', { n: r.rating })}><Stars n={Number(r.rating) || 0} /></span>
                      {r.review_text && <div style={{ fontSize: font.md, color: color.text, lineHeight: 1.5, overflowWrap: 'anywhere' }}>{r.review_text}</div>}
                    </li>
                  ))}
                </ul>
                {loaded.length > REVIEWS_SHOWN && (
                  <button type="button" onClick={() => setShowAllReviews(v => !v)} aria-expanded={showAllReviews}
                    style={{ ...ui.secondaryButton, width: '100%', marginTop: 4 }}>
                    {showAllReviews ? tr('sitterProfile_showFewerReviews') : tr('sitterProfile_showAllReviews', { n: loaded.length })}
                  </button>
                )}
              </>
            )}
          </section>
        )}
      </div>

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
      {shareSheet && <ShareSheet url={shareSheet.url} text={shareSheet.text} onClose={() => setShareSheet(null)} />}
    </div>
  );
}
