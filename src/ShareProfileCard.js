import React, { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { supabase } from './supabase';
import { useLanguage } from './i18n';
import { SITTER_CARD_SELECT } from './sitterCard';
import { color, font, radius, ui } from './theme';
import Icon from './ui/Icon';

export const SHARE_BASE = 'https://fursday.vercel.app/s/';

const ascii = (v) => String(v || '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
export const shortId = (id, n = 6) => String(id || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, n);

// first name + area + the start of the id, e.g. "priya-sector-56-a1b2c3".
// The id part keeps links working before migration 038 adds share_slug.
export function makeShareSlug(name, area, id, idLength = 6) {
  const first = ascii(String(name || '').trim().split(/\s+/)[0]);
  return [first || 'sitter', ascii(area), shortId(id, idLength)].filter(Boolean).join('-');
}

export const shareUrlFor = (slug) => SHARE_BASE + slug;

export function slugFromPath(path) {
  const m = String(path || '').match(/^\/s\/([a-z0-9-]+)\/?$/i);
  return m ? m[1].toLowerCase() : null;
}

export const slugForSitter = (s) => s?.share_slug || makeShareSlug(s?.name || s?.users?.name, s?.base_area, s?.id);

// Saves a slug for the sitter's own profile the first time they share it.
export async function ensureShareSlug(profile) {
  if (profile.share_slug) return profile.share_slug;
  const name = profile.users?.name || profile.name;
  let slug = makeShareSlug(name, profile.base_area, profile.id);
  try {
    const { error } = await supabase.from('sitter_profiles').update({ share_slug: slug }).eq('id', profile.id);
    if (error?.code === '23505') {
      slug = makeShareSlug(name, profile.base_area, profile.id, 12);
      await supabase.from('sitter_profiles').update({ share_slug: slug }).eq('id', profile.id);
    }
  } catch (e) { /* before migration 038 the id part of the slug still finds the sitter */ }
  return slug;
}

export async function findSitterBySlug(slug) {
  if (!slug) return null;
  try {
    const { data, error } = await supabase.from('sitter_profiles').select(SITTER_CARD_SELECT).eq('share_slug', slug).eq('status', 'active').maybeSingle();
    if (!error && data) return data;
  } catch (e) { /* fall back to the id part */ }
  const short = slug.split('-').pop();
  if (!short || short.length < 6) return null;
  try {
    const { data } = await supabase.from('sitter_profiles').select(SITTER_CARD_SELECT).eq('status', 'active');
    return (data || []).find(s => shortId(s.id, short.length) === short) || null;
  } catch (e) {
    return null;
  }
}

// Native share sheet on the apps, the browser's own share where it exists,
// otherwise 'fallback' so the caller shows WhatsApp and copy options.
export async function shareLink({ title, text, url }) {
  if (Capacitor.isNativePlatform()) {
    try { await Share.share({ title, text, url, dialogTitle: title }); return 'shared'; } catch (e) { return 'cancelled'; }
  }
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try { await navigator.share({ title, text, url }); return 'shared'; } catch (e) { if (e?.name === 'AbortError') return 'cancelled'; }
  }
  return 'fallback';
}

export function ShareSheet({ url, text, onClose }) {
  const { t: tr } = useLanguage();
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(url); setCopied(true); } catch (e) { setCopied(false); }
  };
  const optionStyle = { ...ui.secondaryButton, width: '100%', justifyContent: 'flex-start', textDecoration: 'none', boxSizing: 'border-box' };
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 3000, background: 'rgba(21,25,42,0.45)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div role="dialog" aria-modal="true" aria-label={tr('share_sheetTitle')} onClick={e => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 480, boxSizing: 'border-box', background: color.surface, borderRadius: '20px 20px 0 0', padding: '20px 20px calc(20px + env(safe-area-inset-bottom))', fontFamily: font.family }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <div style={{ fontSize: font.lg, fontWeight: 700, color: color.ink }}>{tr('share_sheetTitle')}</div>
          <button type="button" onClick={onClose} aria-label={tr('common_close')}
            style={{ width: 44, height: 44, borderRadius: radius.pill, border: 'none', background: color.tile, color: color.text, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}>
            <Icon name="close" size={20} />
          </button>
        </div>
        <div style={{ fontSize: font.sm, color: color.muted, background: color.bg, borderRadius: radius.md, padding: '10px 12px', marginBottom: 12, overflowWrap: 'anywhere' }}>{url}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <a href={'https://wa.me/?text=' + encodeURIComponent(text + ' ' + url)} target="_blank" rel="noopener noreferrer" style={optionStyle}>
            <Icon name="message" size={18} color={color.success} />{tr('share_whatsapp')}
          </a>
          <button type="button" onClick={copy} style={optionStyle}>
            <Icon name={copied ? 'check' : 'fileText'} size={18} color={color.navy} />{tr(copied ? 'share_copied' : 'share_copy')}
          </button>
        </div>
        <span role="status" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>{copied ? tr('share_copied') : ''}</span>
      </div>
    </div>
  );
}

// "Share my profile" card for the sitter's own Edit profile screen.
export default function ShareProfileCard() {
  const { t: tr } = useLanguage();
  const [profile, setProfile] = useState(null);
  const [sheet, setSheet] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let off = false;
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data } = await supabase.from('sitter_profiles').select('*, users(name)').eq('user_id', user.id).maybeSingle();
        if (!off && data) setProfile(data);
      } catch (e) { /* the card stays hidden */ }
    })();
    return () => { off = true; };
  }, []);

  if (!profile) return null;
  const live = profile.status === 'active';
  const previewUrl = shareUrlFor(slugForSitter(profile));

  const share = async () => {
    setBusy(true);
    const slug = await ensureShareSlug(profile);
    setProfile(p => ({ ...p, share_slug: slug }));
    const payload = { title: tr('share_title'), text: tr('share_ownMessage'), url: shareUrlFor(slug) };
    if ((await shareLink(payload)) === 'fallback') setSheet(payload);
    setBusy(false);
  };

  return (
    <section aria-label={tr('share_title')} style={ui.card}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 12 }}>
        <span style={ui.iconTile}><Icon name="share" /></span>
        <div style={{ minWidth: 0 }}>
          <h2 style={{ ...ui.sectionTitle, margin: '0 0 4px' }}>{tr('share_title')}</h2>
          <div style={{ fontSize: font.sm, color: color.muted, lineHeight: 1.5 }}>{tr(live ? 'share_sub' : 'share_notLiveYet')}</div>
        </div>
      </div>
      {live && (
        <>
          <div style={{ fontSize: font.xs, color: color.muted, marginBottom: 4 }}>{tr('share_linkLabel')}</div>
          <div style={{ fontSize: font.sm, color: color.text, background: color.bg, borderRadius: radius.md, padding: '10px 12px', marginBottom: 12, overflowWrap: 'anywhere' }}>{previewUrl}</div>
        </>
      )}
      <button type="button" onClick={share} disabled={!live || busy} style={{ ...ui.primaryButton, width: '100%', opacity: live ? 1 : 0.55, cursor: live ? 'pointer' : 'not-allowed' }}>
        <Icon name="share" size={18} />{tr('share_button')}
      </button>
      {sheet && <ShareSheet url={sheet.url} text={sheet.text} onClose={() => setSheet(null)} />}
    </section>
  );
}
