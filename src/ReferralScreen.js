import React, { useEffect, useState } from 'react';
import { supabase } from './supabase';
import { useLanguage } from './i18n';
import { color, font, radius, ui, navPadding } from './theme';
import Icon from './ui/Icon';

// No 0/O or 1/I, so a code read aloud or typed from a screenshot still works.
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const makeReferralCode = (rand = Math.random) =>
  'FUR' + Array.from({ length: 5 }, () => CODE_CHARS[Math.floor(rand() * CODE_CHARS.length)]).join('');
export const isReferralCode = (code) => /^FUR[A-Z0-9]{5}$/.test(code || '');

// The person's own shareable code row (referred_user_id is null), created on
// first use. A clash on the unique referral_code just means "roll again".
export async function ensureReferralCode(client, userId, rand = Math.random) {
  const { data: existing } = await client.from('referrals').select('*').eq('referrer_id', userId).is('referred_user_id', null);
  const mine = (existing || []).find(r => isReferralCode(r.referral_code)) || (existing || [])[0];
  if (mine) return mine.referral_code;
  for (let attempt = 0; attempt < 6; attempt++) {
    const code = makeReferralCode(rand);
    const { data, error } = await client.from('referrals').insert({ referrer_id: userId, referral_code: code, status: 'active' }).select().single();
    if (!error) return data?.referral_code || code;
    const clash = error.code === '23505' || /duplicate|unique/i.test(error.message || '');
    if (!clash) throw error;
  }
  throw new Error('Could not create a referral code');
}

const shortName = (full) => {
  const parts = (full || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return parts[0] || '';
  return parts[0] + ' ' + parts[parts.length - 1][0] + '.';
};

const APPLY_ERRORS = {
  invalid: 'referral_errInvalid',
  own_code: 'referral_errOwn',
  already_referred: 'referral_errAlready',
  not_signed_in: 'referral_errSignedOut',
};

export default function ReferralScreen({ onBack }) {
  const { t, lang } = useLanguage();
  const locale = lang === 'hi' ? 'hi-IN' : 'en-IN';
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [code, setCode] = useState('');
  const [amounts, setAmounts] = useState({ reward: 100, signup: 50 });
  const [friends, setFriends] = useState([]);
  const [credits, setCredits] = useState([]);
  const [wasReferred, setWasReferred] = useState(false);
  const [copied, setCopied] = useState(false);
  const [friendCode, setFriendCode] = useState('');
  const [applying, setApplying] = useState(false);
  const [applyMsg, setApplyMsg] = useState(null);

  useEffect(() => {
    let off = false;
    (async () => {
      setLoading(true);
      setLoadError(false);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('not signed in');
        const { data: settings } = await supabase.from('app_settings').select('key, value').in('key', ['referral_reward_rs', 'referral_signup_rs']);
        const setting = (k, d) => { const v = Number((settings || []).find(s => s.key === k)?.value); return v > 0 ? v : d; };
        const myCode = await ensureReferralCode(supabase, user.id);
        const { data: used } = await supabase.from('referrals').select('*').eq('referrer_id', user.id).not('referred_user_id', 'is', null);
        const ids = [...new Set((used || []).map(r => r.referred_user_id))];
        const { data: people } = ids.length ? await supabase.from('users').select('id, name').in('id', ids) : { data: [] };
        const { data: bonuses } = await supabase.from('referral_bonuses').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
        const { data: mine } = await supabase.from('referrals').select('id').eq('referred_user_id', user.id);
        if (off) return;
        setAmounts({ reward: setting('referral_reward_rs', 100), signup: setting('referral_signup_rs', 50) });
        setCode(myCode);
        setFriends((used || []).map(r => ({ ...r, name: shortName((people || []).find(p => p.id === r.referred_user_id)?.name) || t('referral_friendFallback') }))
          .sort((a, b) => String(b.used_at || b.created_at).localeCompare(String(a.used_at || a.created_at))));
        setCredits(bonuses || []);
        setWasReferred((mine || []).length > 0);
      } catch (e) {
        if (!off) setLoadError(true);
      }
      if (!off) setLoading(false);
    })();
    return () => { off = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadKey]);

  const shareText = t('referral_shareMessage', { code, signup: amounts.signup, reward: amounts.reward });
  const shareUrl = 'https://wa.me/?text=' + encodeURIComponent(shareText);

  const copyCode = async () => {
    try { await navigator.clipboard.writeText(code); } catch (e) { /* older WebViews: the code is on screen to copy by hand */ }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const applyCode = async () => {
    const entered = friendCode.trim().toUpperCase();
    if (!entered) return;
    setApplying(true);
    setApplyMsg(null);
    const { data, error } = await supabase.rpc('apply_referral_code', { p_code: entered });
    setApplying(false);
    if (error || !data) { setApplyMsg({ tone: 'danger', text: t('referral_errGeneric') }); return; }
    if (data.error) { setApplyMsg({ tone: 'danger', text: t(APPLY_ERRORS[data.error] || 'referral_errGeneric') }); return; }
    setApplyMsg({ tone: 'success', text: t('referral_applied', { signup: data.signup ?? amounts.signup }) });
    setFriendCode('');
    setReloadKey(k => k + 1);
  };

  const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' }) : '');
  const pendingTotal = credits.filter(c => c.status === 'pending').reduce((s, c) => s + Number(c.amount || 0), 0);
  const earnedTotal = credits.filter(c => c.status === 'applied' || c.status === 'paid').reduce((s, c) => s + Number(c.amount || 0), 0);
  const card = { ...ui.card, marginBottom: 12 };

  const header = (
    <div style={ui.header}>
      <button onClick={onBack} aria-label={t('common_back')} style={ui.backButton}><Icon name="arrowLeft" size={20} /></button>
      <h1 style={{ ...ui.headerTitle, flex: 1 }}>{t('referral_title')}</h1>
    </div>
  );

  if (loading) return (
    <div style={{ ...ui.page, paddingBottom: navPadding }}>
      {header}
      <div role="status" aria-label={t('common_loading')} style={{ padding: 16 }}>
        {[200, 140, 120].map((h, i) => <div key={i} style={{ height: h, borderRadius: radius.lg, background: color.tile, marginBottom: 12 }} />)}
      </div>
    </div>
  );

  if (loadError) return (
    <div style={{ ...ui.page, paddingBottom: navPadding }}>
      {header}
      <div style={{ padding: 16 }}>
        <div style={{ ...ui.card, textAlign: 'center', padding: 28 }}>
          <div style={{ ...ui.iconTile, margin: '0 auto 12px', background: color.dangerSoft, color: color.danger }}><Icon name="alert" /></div>
          <div style={{ color: color.text, fontSize: font.md, marginBottom: 16 }}>{t('referral_loadFailed')}</div>
          <button onClick={() => setReloadKey(k => k + 1)} style={{ ...ui.primaryButton, width: '100%' }}>{t('common_retry')}</button>
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ ...ui.page, paddingBottom: navPadding }}>
      {header}
      <div style={{ padding: 16 }}>
        <div style={card}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 14 }}>
            <span style={{ ...ui.iconTile, background: color.saffronSoft, color: color.saffron }}><Icon name="gift" /></span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: font.lg, fontWeight: 700, color: color.ink }}>{t('referral_heroTitle', { reward: amounts.reward })}</div>
              <div style={{ fontSize: font.sm, color: color.muted, lineHeight: 1.5 }}>{t('referral_heroSub', { signup: amounts.signup })}</div>
            </div>
          </div>
          <div style={ui.label}>{t('referral_yourCode')}</div>
          <div data-testid="referral-code" style={{ border: `1.5px dashed ${color.navy}`, borderRadius: radius.md, background: color.navySoft, padding: '14px 12px', textAlign: 'center', fontSize: font.xxl, fontWeight: 700, color: color.navy, letterSpacing: 3, fontVariantNumeric: 'tabular-nums', marginBottom: 12 }}>
            {code}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={copyCode} style={{ ...ui.secondaryButton, flex: 1 }}>
              {copied ? <><Icon name="check" size={18} />{t('referral_copied')}</> : t('referral_copy')}
            </button>
            <button type="button" onClick={() => window.open(shareUrl, '_blank')} style={{ ...ui.primaryButton, flex: 1.4 }}>
              <Icon name="message" size={18} />{t('referral_shareWhatsapp')}
            </button>
          </div>
        </div>

        <div style={card}>
          <h2 style={ui.sectionTitle}>{t('referral_howTitle')}</h2>
          {[
            t('referral_step1'),
            t('referral_step2', { signup: amounts.signup }),
            t('referral_step3', { reward: amounts.reward }),
          ].map((text, i) => (
            <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '10px 0', borderTop: i ? `1px solid ${color.line}` : 'none' }}>
              <span style={{ width: 28, height: 28, borderRadius: radius.pill, background: color.navy, color: color.surface, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: font.sm, fontWeight: 700, flexShrink: 0 }}>{i + 1}</span>
              <span style={{ fontSize: font.md, color: color.text, lineHeight: 1.5 }}>{text}</span>
            </div>
          ))}
        </div>

        <div style={card}>
          <h2 style={ui.sectionTitle}>{t('referral_creditsTitle')}</h2>
          <div style={{ display: 'flex', gap: 8, marginBottom: credits.length ? 10 : 0 }}>
            {[{ label: t('referral_pendingTotal'), val: pendingTotal, tone: 'warning' }, { label: t('referral_earnedTotal'), val: earnedTotal, tone: 'success' }].map(x => (
              <div key={x.label} style={{ flex: 1, background: color[x.tone + 'Soft'], borderRadius: radius.md, padding: '10px 12px' }}>
                <div style={{ fontSize: font.xs, color: color.muted }}>{x.label}</div>
                <div style={{ fontSize: font.xl, fontWeight: 700, color: color[x.tone], fontVariantNumeric: 'tabular-nums' }}>Rs.{x.val}</div>
              </div>
            ))}
          </div>
          {credits.length === 0 ? (
            <div style={{ fontSize: font.sm, color: color.muted, marginTop: 10 }}>{t('referral_noCredits')}</div>
          ) : credits.map((c, i) => {
            const done = c.status === 'applied' || c.status === 'paid';
            return (
              <div key={c.id || i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '10px 0', borderTop: `1px solid ${color.line}` }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: font.md, fontWeight: 600, color: color.ink }}>{t(c.type === 'signup_bonus' ? 'referral_creditSignup' : 'referral_creditReward')}</div>
                  <div style={{ fontSize: font.sm, color: color.muted }}>{done ? t('referral_creditAppliedSub') : t('referral_creditPendingSub')}</div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: font.md, fontWeight: 700, color: color.ink, fontVariantNumeric: 'tabular-nums' }}>Rs.{Number(c.amount || 0)}</div>
                  <span style={ui.badge(done ? 'success' : 'warning')}>{done ? t('referral_statusApplied') : t('referral_statusPending')}</span>
                </div>
              </div>
            );
          })}
        </div>

        <div style={card}>
          <h2 style={ui.sectionTitle}>{t('referral_friendsTitle', { n: friends.length })}</h2>
          {friends.length === 0 ? (
            <div style={{ fontSize: font.sm, color: color.muted }}>{t('referral_noFriends')}</div>
          ) : friends.map((f, i) => (
            <div key={f.id || i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderTop: i ? `1px solid ${color.line}` : 'none' }}>
              <span style={{ ...ui.iconTile, width: 36, height: 36, borderRadius: radius.pill, fontSize: font.md, fontWeight: 700 }}>{(f.name || '?')[0]}</span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: font.md, fontWeight: 600, color: color.ink }}>{f.name}</div>
                <div style={{ fontSize: font.sm, color: color.muted }}>{t('referral_joinedOn', { date: fmtDate(f.used_at || f.created_at) })}</div>
              </div>
            </div>
          ))}
        </div>

        <div style={card}>
          <h2 style={ui.sectionTitle}>{t('referral_haveCodeTitle')}</h2>
          {wasReferred ? (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: font.sm, color: color.success, fontWeight: 600 }}>
              <Icon name="check" size={16} />{t('referral_alreadyJoined')}
            </div>
          ) : (
            <>
              <div style={{ fontSize: font.sm, color: color.muted, marginBottom: 10 }}>{t('referral_haveCodeSub', { signup: amounts.signup })}</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input value={friendCode} onChange={e => { setFriendCode(e.target.value.toUpperCase()); setApplyMsg(null); }} maxLength={20}
                  placeholder={t('referral_codePlaceholder')} aria-label={t('referral_codePlaceholder')} autoCapitalize="characters"
                  style={{ ...ui.input, flex: 1, minWidth: 0, letterSpacing: 1 }} />
                <button type="button" onClick={applyCode} disabled={applying || !friendCode.trim()} style={{ ...ui.primaryButton, opacity: applying || !friendCode.trim() ? 0.6 : 1 }}>
                  {applying ? t('common_saving') : t('referral_apply')}
                </button>
              </div>
            </>
          )}
          {applyMsg && <div role={applyMsg.tone === 'danger' ? 'alert' : 'status'} style={{ marginTop: 10, fontSize: font.sm, fontWeight: 600, color: color[applyMsg.tone], lineHeight: 1.5 }}>{applyMsg.text}</div>}
        </div>
      </div>
    </div>
  );
}
