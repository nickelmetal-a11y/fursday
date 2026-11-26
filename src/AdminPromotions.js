import React, { useState, useEffect } from 'react';
import { supabase } from './supabase';
import { color, font, radius, ui } from './theme';
import PromoBanner from './PromoBanner';
import { A, Badge, ChipGroup, ConfirmDialog, DataTable, EmptyState, Notice, SectionHeader, Skeleton, Toast, Toolbar, SearchBox, fmtDate } from './AdminUI';

const isoDateInDays = (days) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
};

const emptyForm = () => ({
  code: '',
  discountType: 'flat', // 'flat' | 'percent'
  discountValue: '',
  maxDiscountAmount: '',
  minBookingAmount: '',
  maxUses: '',
  validUntil: isoDateInDays(90),
  description: '',
  featuredHome: true,
});

function statusOf(promo) {
  if (promo.status !== 'active') return 'paused';
  if (new Date(promo.valid_until) < new Date()) return 'expired';
  return 'active';
}
const STATUS_TONE = { active: 'success', expired: 'danger', paused: 'neutral' };

export default function AdminPromotions() {
  const [promos, setPromos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [actionMsg, setActionMsg] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');

  const discountValue = parseFloat(form.discountValue) || 0;
  // Fursday earns 15% of a booking; a bigger discount is paid out of pocket.
  const typicalBooking = Math.max(parseFloat(form.minBookingAmount) || 0, 349);
  const discountRs = form.discountType === 'flat' ? discountValue : Math.min(typicalBooking * discountValue / 100, parseFloat(form.maxDiscountAmount) || Infinity);
  const lossPerUse = Math.round(discountRs - typicalBooking * 0.15);
  const previewPromo = {
    code: form.code.trim().toUpperCase() || 'YOURCODE',
    discount_amount: form.discountType === 'flat' ? discountValue : null,
    discount_percent: form.discountType === 'percent' ? discountValue : 0,
    description: form.description.trim(),
  };

  useEffect(() => { loadPromos(); }, []);

  const flash = (msg) => { setActionMsg(msg); setTimeout(() => setActionMsg(''), 2500); };
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  async function loadPromos() {
    setLoading(true);
    const { data } = await supabase.from('promo_codes').select('*').order('created_at', { ascending: false });
    setPromos(data || []);
    setLoading(false);
  }

  const createPromo = async () => {
    setError('');
    const code = form.code.trim().toUpperCase();
    const value = parseFloat(form.discountValue);
    if (!code) { setError('Enter a code'); return; }
    if (!value || value <= 0) { setError('Enter a discount value greater than 0'); return; }
    if (form.discountType === 'percent' && value > 100) { setError('Percent off cannot exceed 100'); return; }
    const validUntil = new Date(form.validUntil + 'T23:59:59');
    if (isNaN(validUntil) || validUntil < new Date()) { setError('Pick an expiry date in the future'); return; }
    setSaving(true);
    try {
      // Only one promo is ever featured on the home page at a time — a
      // fresh declaration replaces whatever was shown before.
      if (form.featuredHome) {
        await supabase.from('promo_codes').update({ featured_home: false }).eq('featured_home', true);
      }
      const { error: insertError } = await supabase.from('promo_codes').insert({
        code,
        discount_percent: form.discountType === 'percent' ? value : 0,
        discount_amount: form.discountType === 'flat' ? value : null,
        max_discount_amount: form.maxDiscountAmount ? parseFloat(form.maxDiscountAmount) : null,
        min_booking_amount: form.minBookingAmount ? parseFloat(form.minBookingAmount) : 0,
        max_uses: form.maxUses ? parseInt(form.maxUses, 10) : null,
        valid_from: new Date().toISOString(),
        valid_until: validUntil.toISOString(),
        status: 'active',
        description: form.description.trim() || null,
        featured_home: form.featuredHome,
      });
      if (insertError) {
        setError(insertError.code === '23505' ? 'A promo with code ' + code + ' already exists' : insertError.message);
        setSaving(false);
        return;
      }
      setForm(emptyForm());
      setShowForm(false);
      await loadPromos();
      flash('Promotion created');
    } catch (e) {
      setError('Something went wrong creating the promotion');
    }
    setSaving(false);
  };

  const toggleFeatured = async (promo) => {
    if (!promo.featured_home) {
      await supabase.from('promo_codes').update({ featured_home: false }).eq('featured_home', true);
      await supabase.from('promo_codes').update({ featured_home: true }).eq('id', promo.id);
      flash(promo.code + ' is now shown on the home page');
    } else {
      await supabase.from('promo_codes').update({ featured_home: false }).eq('id', promo.id);
      flash(promo.code + ' removed from the home page');
    }
    loadPromos();
  };

  const togglePaused = async (promo) => {
    const newStatus = promo.status === 'active' ? 'paused' : 'active';
    await supabase.from('promo_codes').update({ status: newStatus }).eq('id', promo.id);
    flash(promo.code + (newStatus === 'paused' ? ' paused' : ' reactivated'));
    loadPromos();
  };

  const deletePromo = async (promo) => {
    setConfirmDelete(null);
    await supabase.from('promo_codes').delete().eq('id', promo.id);
    flash(promo.code + ' deleted');
    loadPromos();
  };

  const q = query.trim().toLowerCase();
  const shown = promos.filter(p => (filter === 'all' || statusOf(p) === filter) && (!q || p.code.toLowerCase().includes(q) || (p.description || '').toLowerCase().includes(q)));

  const columns = [
    { key: 'code', label: 'Code', render: p => (
      <div style={{ minWidth: 140 }}>
        <div style={{ fontSize: font.md, fontWeight: 700, letterSpacing: 0.5 }}>{p.code}</div>
        {p.description && <div style={{ ...A.muted, fontSize: font.xs }}>"{p.description}"</div>}
      </div>
    ) },
    { key: 'discount', label: 'Discount', render: p => (
      <span>
        {p.discount_amount ? 'Rs.' + p.discount_amount + ' off' : p.discount_percent + '% off'}
        {p.max_discount_amount ? ' (up to Rs.' + p.max_discount_amount + ')' : ''}
        {p.min_booking_amount ? ' · min Rs.' + p.min_booking_amount : ''}
      </span>
    ) },
    { key: 'usage', label: 'Used', align: 'right', render: p => (
      <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
        <span>{p.times_used || 0}{p.max_uses ? ' / ' + p.max_uses : 'x'}</span>
        {p.max_uses > 0 && (
          <span style={{ display: 'block', height: 4, borderRadius: 2, background: color.tile, width: 80, overflow: 'hidden' }}>
            <span style={{ display: 'block', height: '100%', width: Math.min(100, ((p.times_used || 0) / p.max_uses) * 100) + '%', background: color.saffron }} />
          </span>
        )}
      </div>
    ) },
    { key: 'expires', label: 'Expires', nowrap: true, render: p => fmtDate(p.valid_until) },
    { key: 'status', label: 'Status', render: p => (
      <div style={A.stack(4)}>
        <Badge tone={STATUS_TONE[statusOf(p)]}>{statusOf(p).toUpperCase()}</Badge>
        {p.featured_home && <Badge tone="saffron">ON HOME PAGE</Badge>}
      </div>
    ) },
    { key: 'actions', label: 'Actions', render: p => (
      <div style={{ ...A.row(6), flexWrap: 'nowrap' }}>
        <button onClick={() => toggleFeatured(p)} style={A.small}>{p.featured_home ? 'Remove from home' : 'Show on home'}</button>
        <button onClick={() => togglePaused(p)} style={A.small}>{p.status === 'active' ? 'Pause' : 'Activate'}</button>
        <button onClick={() => setConfirmDelete(p)} style={A.smallDanger}>Delete</button>
      </div>
    ) },
  ];

  const fieldLabel = (id, text) => <label htmlFor={id} style={ui.label}>{text}</label>;

  return (
    <div>
      <Toast message={actionMsg} />
      <SectionHeader title={'Promotions (' + promos.length + ')'} subtitle="One promo can be featured on the home page at a time."
        action={<button onClick={() => { setShowForm(s => !s); setError(''); }} style={showForm ? A.secondary : A.primary}>{showForm ? 'Cancel' : '+ New promotion'}</button>} />

      {showForm && (
        <section style={{ ...ui.card, marginBottom: 16, display: 'flex', gap: 24, flexWrap: 'wrap-reverse' }}>
          <div style={{ flex: '1 1 320px', ...A.stack(14) }}>
            <div>
              {fieldLabel('promo-code', 'Code')}
              <input id="promo-code" value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))} placeholder="e.g. DIWALI2026" style={{ ...A.input, textTransform: 'uppercase' }} />
            </div>
            <div>
              <span style={ui.label}>Discount type</span>
              <ChipGroup label="Discount type" value={form.discountType} onChange={(v) => setForm(f => ({ ...f, discountType: v }))}
                options={[{ id: 'flat', label: 'Flat Rs. amount' }, { id: 'percent', label: '% off' }]} />
            </div>
            <div>
              {fieldLabel('promo-value', form.discountType === 'flat' ? 'Discount amount (Rs.)' : 'Discount percent (%)')}
              <input id="promo-value" value={form.discountValue} onChange={set('discountValue')} type="number" placeholder={form.discountType === 'flat' ? 'e.g. 100' : 'e.g. 20'} style={A.input} />
            </div>
            {form.discountType === 'percent' && (
              <div>
                {fieldLabel('promo-cap', 'Max discount cap (Rs., optional)')}
                <input id="promo-cap" value={form.maxDiscountAmount} onChange={set('maxDiscountAmount')} type="number" placeholder="e.g. 200" style={A.input} />
              </div>
            )}
            <div>
              {fieldLabel('promo-min', 'Minimum booking amount (Rs., optional)')}
              <input id="promo-min" value={form.minBookingAmount} onChange={set('minBookingAmount')} type="number" placeholder="e.g. 0" style={A.input} />
            </div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 140px' }}>
                {fieldLabel('promo-expiry', 'Expires on')}
                <input id="promo-expiry" value={form.validUntil} onChange={set('validUntil')} type="date" aria-label="Expires on" style={A.input} />
              </div>
              <div style={{ flex: '1 1 140px' }}>
                {fieldLabel('promo-uses', 'Max total uses (optional)')}
                <input id="promo-uses" value={form.maxUses} onChange={set('maxUses')} type="number" placeholder="Unlimited" style={A.input} />
              </div>
            </div>
            <div>
              {fieldLabel('promo-text', 'Banner text (shown to users, optional)')}
              <input id="promo-text" value={form.description} onChange={set('description')} placeholder="e.g. on your first Fursday booking" style={A.input} />
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: font.md, color: color.text, cursor: 'pointer', minHeight: 36 }}>
              <input type="checkbox" checked={form.featuredHome} onChange={e => setForm(f => ({ ...f, featuredHome: e.target.checked }))} />
              Show on home page banner (replaces whatever's currently featured)
            </label>
            {error && <Notice tone="danger" icon="alert">{error}</Notice>}
            <button onClick={createPromo} disabled={saving} style={{ ...A.primary, width: '100%' }}>{saving ? 'Creating...' : 'Create promotion'}</button>
          </div>
          <div style={{ flex: '1 1 300px', ...A.stack(12) }}>
            <div style={{ fontSize: font.xs, fontWeight: 600, color: color.muted, letterSpacing: 0.5, textTransform: 'uppercase' }}>Live preview — what users will see</div>
            <div style={{ maxWidth: 360, pointerEvents: 'none', borderRadius: radius.lg }}>
              <PromoBanner promo={previewPromo} onUse={() => {}} />
            </div>
            {discountValue > 0 && lossPerUse > 0 && (
              <Notice tone="warning" icon="alert">
                On a Rs.{typicalBooking} booking this costs Fursday about <b>Rs.{lossPerUse} per use</b>: the discount is bigger than the 15% commission (Rs.{Math.round(typicalBooking * 0.15)}). Fine for acquiring new customers; set a minimum booking amount or a usage cap to limit the cost.
              </Notice>
            )}
          </div>
        </section>
      )}

      {!loading && promos.length > 0 && (
        <Toolbar>
          <SearchBox label="Search promotions" value={query} onChange={setQuery} placeholder="Search code or banner text" />
          <ChipGroup label="Filter promotions by status" value={filter} onChange={setFilter}
            options={[{ id: 'all', label: 'All' }, { id: 'active', label: 'Active' }, { id: 'paused', label: 'Paused' }, { id: 'expired', label: 'Expired' }]} />
        </Toolbar>
      )}

      {loading ? <Skeleton rows={4} /> : promos.length === 0 ? (
        <EmptyState icon="tag" title="No promotions yet." text="Create a code to offer a discount, and feature it on the home page." />
      ) : shown.length === 0 ? (
        <EmptyState icon="search" title="No promotions match" />
      ) : (
        <DataTable label="Promotions" columns={columns} rows={shown} />
      )}

      {confirmDelete && (
        <ConfirmDialog title={'Delete ' + confirmDelete.code + '?'} tone="danger" confirmLabel="Delete promo" onCancel={() => setConfirmDelete(null)} onConfirm={() => deletePromo(confirmDelete)}>
          People can no longer use this code. This cannot be undone; pause it instead if you may want it back.
        </ConfirmDialog>
      )}
    </div>
  );
}
