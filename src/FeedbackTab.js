import React, { useEffect, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { supabase } from './supabase';
import { useLanguage } from './i18n';
import { color, font, radius, ui } from './theme';
import Icon from './ui/Icon';

const HIDE_KEY = 'fursday_feedback_hidden_until';
const PEEK_KEY = 'fursday_feedback_peeked';
const KINDS = [
  { id: 'idea', icon: 'bulb', label: 'feedback_kindIdea', hint: 'feedback_hintIdea' },
  { id: 'problem', icon: 'alert', label: 'feedback_kindProblem', hint: 'feedback_hintProblem' },
  { id: 'love', icon: 'heart', label: 'feedback_kindLove', hint: 'feedback_hintLove' },
];

const store = {
  get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} },
};

const CSS = `
@keyframes fwPeek { 0%,100% { transform: translateX(0) } 30%,70% { transform: translateX(-10px) } }
@keyframes fwSheetIn { from { transform: translateY(24px); opacity: 0 } to { transform: none; opacity: 1 } }
@keyframes fwGlow { 0%,100% { opacity: .35 } 50% { opacity: .9 } }
.fw-fb-tab:hover, .fw-fb-tab:focus-visible { width: 44px !important; }
.fw-fb-peek { animation: fwPeek 1.6s ease-in-out 1; }
.fw-fb-sheet { animation: fwSheetIn .22s ease-out; }
.fw-fb-glow { animation: fwGlow 2.8s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce) { .fw-fb-peek, .fw-fb-sheet, .fw-fb-glow { animation: none; } }
`;

function Doodle() {
  return (
    <svg width="96" height="64" viewBox="0 0 96 64" aria-hidden="true">
      <circle cx="48" cy="34" r="28" fill={color.saffronSoft} />
      <g transform="translate(30 18) scale(1.5)" fill="none" stroke={color.navy} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <ellipse cx="7" cy="8" rx="1.8" ry="2.4" /><ellipse cx="12" cy="5.6" rx="1.8" ry="2.4" /><ellipse cx="17" cy="8" rx="1.8" ry="2.4" />
        <path d="M12 11c3 0 6 3.6 6 6 0 1.8-1.6 2.6-3.1 2.2-1.1-.3-1.8-.8-2.9-.8s-1.8.5-2.9.8C7.6 19.6 6 18.8 6 17c0-2.4 3-6 6-6z" />
      </g>
      <g className="fw-fb-glow" fill={color.saffron}>
        <path d="M76 10l1.4 4 4 1.4-4 1.4-1.4 4-1.4-4-4-1.4 4-1.4z" />
        <path d="M18 14l1 2.6 2.6 1-2.6 1-1 2.6-1-2.6-2.6-1 2.6-1z" />
        <circle cx="82" cy="40" r="2" />
      </g>
    </svg>
  );
}

export default function FeedbackTab({ screen, role, userId, userName }) {
  const { t: tr, lang } = useLanguage();
  const [open, setOpen] = useState(false);
  const [hidden, setHidden] = useState(() => Number(store.get(HIDE_KEY) || 0) > Date.now());
  const [peek, setPeek] = useState(false);
  const [kind, setKind] = useState('idea');
  const [message, setMessage] = useState('');
  const [shot, setShot] = useState(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const fileRef = useRef(null);
  const textRef = useRef(null);

  useEffect(() => {
    if (hidden || store.get(PEEK_KEY)) return undefined;
    const t1 = setTimeout(() => { setPeek(true); store.set(PEEK_KEY, '1'); }, 20000);
    return () => clearTimeout(t1);
  }, [hidden]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    const t = setTimeout(() => textRef.current?.focus(), 50);
    return () => { window.removeEventListener('keydown', onKey); clearTimeout(t); };
  }, [open]);

  if (hidden) return null;

  const close = () => {
    setOpen(false);
    if (sent) { setSent(false); setMessage(''); setShot(null); setKind('idea'); }
  };

  const hideForToday = () => {
    store.set(HIDE_KEY, String(Date.now() + 24 * 3600 * 1000));
    setOpen(false);
    setHidden(true);
  };

  const send = async () => {
    if (message.trim().length < 3) { setError(tr('feedback_errShort')); return; }
    setSending(true);
    setError('');
    let screenshotPath = null;
    if (shot && userId) {
      const path = userId + '/' + Date.now() + '-' + (shot.name || 'screenshot').replace(/[^a-z0-9.]/gi, '_').slice(-40);
      const { error: upErr } = await supabase.storage.from('feedback').upload(path, shot, { contentType: shot.type || 'image/jpeg' });
      if (!upErr) screenshotPath = path;
    }
    const { error: insErr } = await supabase.from('app_feedback').insert({
      user_id: userId,
      kind,
      message: message.trim().slice(0, 2000),
      screen,
      role,
      lang,
      platform: Capacitor.isNativePlatform() ? Capacitor.getPlatform() : 'web',
      screenshot_path: screenshotPath,
    });
    setSending(false);
    if (insErr) { setError(tr('feedback_errSend')); return; }
    setSent(true);
  };

  const current = KINDS.find(k => k.id === kind);
  const firstName = (userName || '').trim().split(/\s+/)[0];

  return (
    <>
      <style>{CSS}</style>
      {!open && (
        <button type="button" className={'fw-fb-tab' + (peek ? ' fw-fb-peek' : '')} onClick={() => { setOpen(true); setPeek(false); }}
          aria-label={tr('feedback_tabAria')} title={tr('feedback_tabAria')}
          onAnimationEnd={() => setPeek(false)}
          style={{ position: 'fixed', right: 0, top: '58%', zIndex: 150, width: 34, height: 52, padding: 0, border: 'none', cursor: 'pointer',
            borderRadius: `${radius.md}px 0 0 ${radius.md}px`, background: color.navy, color: '#F3B77A',
            boxShadow: '0 4px 14px rgba(20,37,74,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'flex-start', paddingLeft: 7,
            transition: 'width .18s ease', opacity: 0.92 }}>
          <Icon name="bulb" size={20} strokeWidth={1.9} />
        </button>
      )}

      {open && (
        <div role="presentation" onClick={close}
          style={{ position: 'fixed', inset: 0, zIndex: 400, background: 'rgba(17,24,39,0.38)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div role="dialog" aria-modal="true" aria-labelledby="fw-fb-title" className="fw-fb-sheet" onClick={e => e.stopPropagation()}
            style={{ width: '100%', maxWidth: 480, background: color.surface, borderRadius: `${radius.xl}px ${radius.xl}px 0 0`, padding: '10px 18px calc(18px + env(safe-area-inset-bottom))', boxSizing: 'border-box', maxHeight: '92vh', overflowY: 'auto' }}>
            <div aria-hidden="true" style={{ width: 40, height: 4, borderRadius: 2, background: color.line, margin: '0 auto 6px' }} />
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button type="button" onClick={close} aria-label={tr('feedback_close')} style={{ ...ui.backButton, width: 40, height: 40 }}><Icon name="close" size={18} /></button>
            </div>

            {sent ? (
              <div style={{ textAlign: 'center', padding: '4px 4px 8px' }}>
                <div style={{ width: 60, height: 60, borderRadius: radius.pill, background: color.successSoft, color: color.success, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
                  <Icon name="check" size={30} strokeWidth={2.4} />
                </div>
                <h2 id="fw-fb-title" style={{ fontSize: font.xl, fontWeight: 700, color: color.ink, margin: '0 0 6px' }}>
                  {firstName ? tr('feedback_thanksName', { name: firstName }) : tr('feedback_thanks')}
                </h2>
                <p style={{ fontSize: font.md, color: color.muted, lineHeight: 1.55, margin: '0 0 20px' }}>{tr('feedback_thanksSub')}</p>
                <button type="button" onClick={close} style={{ ...ui.primaryButton, width: '100%' }}>{tr('feedback_done')}</button>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', marginTop: -18 }}>
                  <Doodle />
                  <h2 id="fw-fb-title" style={{ fontSize: font.xl, fontWeight: 700, color: color.ink, margin: '6px 0 4px', letterSpacing: -0.2 }}>{tr('feedback_title')}</h2>
                  <p style={{ fontSize: font.md, color: color.muted, lineHeight: 1.5, margin: '0 0 16px' }}>{tr('feedback_sub')}</p>
                </div>

                <div role="radiogroup" aria-label={tr('feedback_kindLabel')} style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                  {KINDS.map(k => {
                    const on = kind === k.id;
                    return (
                      <button type="button" key={k.id} role="radio" aria-checked={on} onClick={() => setKind(k.id)}
                        style={{ flex: 1, minWidth: 0, minHeight: 64, borderRadius: radius.lg, cursor: 'pointer', fontFamily: font.family, fontSize: font.sm, fontWeight: 600,
                          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '8px 4px',
                          background: on ? color.navy : color.surface, color: on ? 'white' : color.text, border: `1px solid ${on ? color.navy : color.line}` }}>
                        <Icon name={k.icon} size={20} color={on ? '#F3B77A' : color.navy} />
                        {tr(k.label)}
                      </button>
                    );
                  })}
                </div>

                <label htmlFor="fw-fb-msg" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>{tr('feedback_messageLabel')}</label>
                <textarea id="fw-fb-msg" ref={textRef} value={message} maxLength={2000}
                  onChange={e => { setMessage(e.target.value); setError(''); }}
                  placeholder={tr(current.hint)}
                  style={{ ...ui.input, minHeight: 110, resize: 'none', lineHeight: 1.55, fontSize: 15 }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, margin: '8px 0 14px' }}>
                  <button type="button" onClick={() => fileRef.current?.click()}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, minHeight: 40, padding: '0 12px', borderRadius: radius.pill, border: `1px dashed ${color.line}`, background: 'none', cursor: 'pointer', fontFamily: font.family, fontSize: font.sm, color: shot ? color.success : color.muted, fontWeight: 600, maxWidth: '70%', overflow: 'hidden' }}>
                    <Icon name={shot ? 'check' : 'image'} size={16} />
                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{shot ? tr('feedback_shotAdded') : tr('feedback_addShot')}</span>
                  </button>
                  <input ref={fileRef} type="file" accept="image/*" aria-label={tr('feedback_addShot')} style={{ display: 'none' }}
                    onChange={e => { const f = e.target.files?.[0]; if (f && f.size <= 5 * 1024 * 1024) setShot(f); }} />
                  <span style={{ fontSize: font.xs, color: color.faint, fontVariantNumeric: 'tabular-nums' }}>{message.length}/2000</span>
                </div>

                {error && (
                  <div role="alert" style={{ display: 'flex', gap: 8, background: color.dangerSoft, color: color.danger, borderRadius: radius.md, padding: '10px 12px', fontSize: 13, marginBottom: 12 }}>
                    <Icon name="alert" size={16} style={{ marginTop: 1 }} />{error}
                  </div>
                )}

                <button type="button" onClick={send} disabled={sending}
                  style={{ ...ui.primaryButton, width: '100%', opacity: message.trim().length >= 3 ? 1 : 0.6 }}>
                  <Icon name="send" size={17} /> {sending ? tr('common_sending') : tr('feedback_send')}
                </button>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, gap: 8 }}>
                  <span style={{ fontSize: font.xs, color: color.faint, lineHeight: 1.4 }}>{tr('feedback_privacy')}</span>
                  <button type="button" onClick={hideForToday}
                    style={{ background: 'none', border: 'none', color: color.muted, fontSize: font.xs, fontWeight: 600, cursor: 'pointer', minHeight: 40, padding: '0 4px', fontFamily: font.family, whiteSpace: 'nowrap' }}>
                    {tr('feedback_hideToday')}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
