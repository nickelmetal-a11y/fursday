import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from './supabase';
import { color, font, radius } from './theme';
import Icon from './ui/Icon';
import { A, Badge, ChipGroup, EmptyState, KpiTile, LoadMore, Notice, SearchBox, SectionHeader, Skeleton, Toolbar, fmtDateTime, humanize, usePaged } from './AdminUI';

const KIND = {
  idea: { label: 'Idea', tone: 'info', icon: 'bulb' },
  problem: { label: 'Problem', tone: 'danger', icon: 'alert' },
  love: { label: 'Love', tone: 'success', icon: 'heart' },
};
const STATUS_TONE = { new: 'warning', planned: 'info', done: 'success', wont_do: 'neutral' };
const STATUSES = ['new', 'planned', 'done', 'wont_do'];
const STATUS_LABEL = { new: 'New', planned: 'Planned', done: 'Done', wont_do: "Won't do" };

function FeedbackItem({ item, onSaved }) {
  const [status, setStatus] = useState(item.status);
  const [note, setNote] = useState(item.admin_note || '');
  const [saving, setSaving] = useState(false);
  const [shotUrl, setShotUrl] = useState(null);
  const [shotError, setShotError] = useState('');
  const dirty = status !== item.status || note !== (item.admin_note || '');
  const kind = KIND[item.kind] || KIND.idea;

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from('app_feedback').update({ status, admin_note: note.trim() || null }).eq('id', item.id);
    setSaving(false);
    onSaved(error ? error.message : null, { ...item, status, admin_note: note.trim() || null });
  };

  const openShot = async () => {
    const bucket = supabase.storage.from('feedback');
    if (!bucket.createSignedUrl) { setShotError('Screenshot preview is not available here.'); return; }
    const { data, error } = await bucket.createSignedUrl(item.screenshot_path, 600);
    if (error || !data?.signedUrl) { setShotError('Could not open the screenshot.'); return; }
    setShotUrl(data.signedUrl);
  };

  return (
    <article className="adm-item" style={{ ...A.card, display: 'flex', flexDirection: 'column', gap: 10 }} aria-label={kind.label + ' from ' + (item.users?.name || 'a user')}>
      <div style={{ ...A.row(8), justifyContent: 'space-between' }}>
        <div style={A.row(6)}>
          <Badge tone={kind.tone} icon={kind.icon}>{kind.label}</Badge>
          <Badge tone={STATUS_TONE[item.status] || 'neutral'}>{STATUS_LABEL[item.status] || humanize(item.status)}</Badge>
        </div>
        <span style={A.muted}>{fmtDateTime(item.created_at)}</span>
      </div>
      <p style={{ margin: 0, fontSize: font.md, lineHeight: 1.55, color: color.ink, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{item.message}</p>
      <div style={{ ...A.muted, display: 'flex', flexWrap: 'wrap', gap: '4px 12px' }}>
        <span><Icon name="user" size={13} style={{ verticalAlign: -2, marginRight: 4 }} />{item.users?.name || 'Unknown user'}{item.role ? ' · ' + humanize(item.role) : ''}</span>
        <span>Screen: {humanize(item.screen || 'unknown')}</span>
        <span>{(item.platform || 'web').toUpperCase()} · {(item.lang || 'en').toUpperCase()}</span>
        {item.screenshot_path && <button type="button" onClick={openShot} style={{ ...A.small, minHeight: 28 }}><Icon name="image" size={13} />Screenshot</button>}
      </div>
      {shotError && <Notice tone="warning">{shotError}</Notice>}
      {shotUrl && <img src={shotUrl} alt="Screenshot attached to this feedback" style={{ maxWidth: '100%', maxHeight: 360, objectFit: 'contain', borderRadius: radius.md, border: `1px solid ${color.line}`, alignSelf: 'flex-start' }} />}
      <div style={{ ...A.row(8), alignItems: 'flex-end' }}>
        <div>
          <label htmlFor={'fb-status-' + item.id} style={{ ...A.muted, display: 'block', marginBottom: 4 }}>Status</label>
          <select id={'fb-status-' + item.id} value={status} onChange={e => setStatus(e.target.value)} style={A.select}>
            {STATUSES.map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </select>
        </div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <label htmlFor={'fb-note-' + item.id} style={{ ...A.muted, display: 'block', marginBottom: 4 }}>Private note</label>
          <input id={'fb-note-' + item.id} value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. Planned for December" style={A.input} />
        </div>
        <button type="button" onClick={save} disabled={!dirty || saving} style={{ ...A.smallPrimary, minHeight: 44, ...(!dirty || saving ? A.disabled : null) }}>{saving ? 'Saving…' : 'Save'}</button>
      </div>
    </article>
  );
}

export default function AdminFeedback({ showMsg = () => {} }) {
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');
  const [kind, setKind] = useState('all');
  const [status, setStatus] = useState('open');
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    const { data, error: err } = await supabase.from('app_feedback').select('*, users(name)').order('created_at', { ascending: false }).limit(500);
    if (err) { setError(/app_feedback/.test(err.message || '') ? 'Feedback needs migration 037. Run it in the Supabase SQL Editor.' : err.message); setItems([]); return; }
    setError('');
    setItems(data || []);
  }, []);
  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (items || []).filter(i =>
      (kind === 'all' || i.kind === kind) &&
      (status === 'all' || (status === 'open' ? ['new', 'planned'].includes(i.status) : i.status === status)) &&
      (!q || (i.message + ' ' + (i.users?.name || '') + ' ' + (i.screen || '')).toLowerCase().includes(q)));
  }, [items, kind, status, query]);
  const paged = usePaged(filtered, 20, kind + status + query);

  const topScreens = useMemo(() => {
    const counts = {};
    (items || []).filter(i => i.kind === 'problem' && i.status !== 'done').forEach(i => { counts[i.screen || 'unknown'] = (counts[i.screen || 'unknown'] || 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 3);
  }, [items]);

  if (!items) return <Skeleton rows={5} label="Loading feedback..." />;
  const count = (fn) => items.filter(fn).length;

  return (
    <div style={A.stack(16)}>
      <SectionHeader title="Feedback" subtitle="Ideas, problems and praise sent from the feedback tab on every screen." action={<button type="button" onClick={load} style={A.small}><Icon name="refresh" size={14} />Refresh</button>} />
      {error && <Notice tone="warning">{error}</Notice>}
      <div style={A.grid(150)}>
        <KpiTile label="New" value={count(i => i.status === 'new')} tone={count(i => i.status === 'new') ? 'warning' : undefined} />
        <KpiTile label="Ideas" value={count(i => i.kind === 'idea')} />
        <KpiTile label="Problems open" value={count(i => i.kind === 'problem' && ['new', 'planned'].includes(i.status))} />
        <KpiTile label="Love notes" value={count(i => i.kind === 'love')} />
      </div>
      {topScreens.length > 0 && (
        <Notice tone="info" icon="alert">Most problem reports: {topScreens.map(([s, n]) => humanize(s) + ' (' + n + ')').join(', ')}</Notice>
      )}
      <Toolbar>
        <ChipGroup label="Kind" value={kind} onChange={setKind} options={[{ id: 'all', label: 'All' }, { id: 'idea', label: 'Ideas' }, { id: 'problem', label: 'Problems' }, { id: 'love', label: 'Love' }]} />
        <ChipGroup label="Status" value={status} onChange={setStatus} options={[{ id: 'open', label: 'Open' }, ...STATUSES.map(s => ({ id: s, label: STATUS_LABEL[s] })), { id: 'all', label: 'All' }]} />
        <SearchBox label="Search feedback" value={query} onChange={setQuery} placeholder="Search text, person or screen" />
      </Toolbar>
      {filtered.length === 0
        ? <EmptyState icon="bulb" title="Nothing here yet" text="When people tap the bulb tab on the edge of any screen, their notes land here." />
        : (
          <div style={A.stack(10)}>
            {paged.visible.map(i => (
              <FeedbackItem key={i.id} item={i} onSaved={(err, next) => {
                if (err) { showMsg('Could not save: ' + err, 'error'); return; }
                setItems(list => list.map(x => (x.id === next.id ? next : x)));
                showMsg('Feedback updated');
              }} />
            ))}
            <LoadMore paged={paged} total={filtered.length} />
          </div>
        )}
    </div>
  );
}
