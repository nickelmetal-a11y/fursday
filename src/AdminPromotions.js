import React, { useState, useEffect } from 'react';
import { supabase } from './supabase';
import PromoBanner from './PromoBanner';

const ORANGE = '#FF6B35';

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
  const now = new Date();
  if (promo.status !== 'active') return 'paused';
  if (new Date(promo.valid_until) < now) return 'expired';
  return 'active';
}

export default function AdminPromotions() {
  const [promos, setPromos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [actionMsg, setActionMsg] = useState('');

  useEffect(() => { loadPromos(); }, []);

  const flash = (msg) => { setActionMsg(msg); setTimeout(() => setActionMsg(''), 2500); };

  const loadPromos = async () => {
    setLoading(true);
    const { data } = await supabase.from('promo_codes').select('*').order('created_at', { ascending: false });
    setPromos(data || []);
    setLoading(false);
  };

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
    if (!window.confirm('Delete promo code ' + promo.code + '? This cannot be undone.')) return;
    await supabase.from('promo_codes').delete().eq('id', promo.id);
    flash(promo.code + ' deleted');
    loadPromos();
  };

  return (
    <div>
      {actionMsg && (
        <div style={{ position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', background: '#2E7D32', color: 'white', borderRadius: 12, padding: '10px 20px', fontSize: 13, fontWeight: 600, zIndex: 1000, boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
          {actionMsg}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1a1a' }}>Promotions ({promos.length})</div>
        <button onClick={() => { setShowForm(s => !s); setError(''); }}
          style={{ background: ORANGE, border: 'none', borderRadius: 8, padding: '8px 14px', color: 'white', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
          {showForm ? 'Cancel' : '+ New promotion'}
        </button>
      </div>

      {showForm && (
        <div style={{ background: 'white', borderRadius: 14, padding: 16, marginBottom: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#888', letterSpacing: 0.5, marginBottom: 8 }}>LIVE PREVIEW — WHAT USERS WILL SEE</div>
          <div style={{ maxWidth: 360, marginBottom: 18, pointerEvents: 'none' }}>
            <PromoBanner promo={previewPromo} onUse={() => {}} />
          </div>
          {discountValue > 0 && lossPerUse > 0 && (
            <div role="note" style={{ background: '#FFF8E1', border: '1px solid #FFE082', color: '#8D6E00', borderRadius: 10, padding: '10px 12px', fontSize: 12, lineHeight: 1.5, marginBottom: 14 }}>
              On a Rs.{typicalBooking} booking this costs Fursday about <b>Rs.{lossPerUse} per use</b>: the discount is bigger than the 15% commission (Rs.{Math.round(typicalBooking * 0.15)}). Fine for acquiring new customers; set a minimum booking amount or a usage cap to limit the cost.
            </div>
          )}

          <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>Code</div>
          <input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))} placeholder="e.g. DIWALI2026"
            style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid #E8E8E8', fontSize: 13, marginBottom: 12, boxSizing: 'border-box', textTransform: 'uppercase' }} />

          <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>Discount type</div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            {[{ id: 'flat', label: 'Flat ₹ amount' }, { id: 'percent', label: '% off' }].map(opt => (
              <button key={opt.id} onClick={() => setForm(f => ({ ...f, discountType: opt.id }))}
                style={{ flex: 1, padding: '10px 0', borderRadius: 8, border: form.discountType === opt.id ? '1.5px solid ' + ORANGE : '1.5px solid #E8E8E8', background: form.discountType === opt.id ? '#FFF0EB' : 'white', color: form.discountType === opt.id ? ORANGE : '#555', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                {opt.label}
              </button>
            ))}
          </div>

          <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>{form.discountType === 'flat' ? 'Discount amount (Rs.)' : 'Discount percent (%)'}</div>
          <input value={form.discountValue} onChange={e => setForm(f => ({ ...f, discountValue: e.target.value }))} type="number" placeholder={form.discountType === 'flat' ? 'e.g. 100' : 'e.g. 20'}
            style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid #E8E8E8', fontSize: 13, marginBottom: 12, boxSizing: 'border-box' }} />

          {form.discountType === 'percent' && (
            <>
              <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>Max discount cap (Rs., optional)</div>
              <input value={form.maxDiscountAmount} onChange={e => setForm(f => ({ ...f, maxDiscountAmount: e.target.value }))} type="number" placeholder="e.g. 200"
                style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid #E8E8E8', fontSize: 13, marginBottom: 12, boxSizing: 'border-box' }} />
            </>
          )}

          <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>Minimum booking amount (Rs., optional)</div>
          <input value={form.minBookingAmount} onChange={e => setForm(f => ({ ...f, minBookingAmount: e.target.value }))} type="number" placeholder="e.g. 0"
            style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid #E8E8E8', fontSize: 13, marginBottom: 12, boxSizing: 'border-box' }} />

          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>Expires on</div>
              <input value={form.validUntil} onChange={e => setForm(f => ({ ...f, validUntil: e.target.value }))} type="date" aria-label="Expires on"
                style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1.5px solid #E8E8E8', fontSize: 13, marginBottom: 12, boxSizing: 'border-box' }} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>Max total uses (optional)</div>
              <input value={form.maxUses} onChange={e => setForm(f => ({ ...f, maxUses: e.target.value }))} type="number" placeholder="Unlimited"
                style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid #E8E8E8', fontSize: 13, marginBottom: 12, boxSizing: 'border-box' }} />
            </div>
          </div>

          <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>Banner text (shown to users, optional)</div>
          <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="e.g. on your first Fursday booking"
            style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid #E8E8E8', fontSize: 13, marginBottom: 12, boxSizing: 'border-box' }} />

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, fontSize: 12, color: '#555', cursor: 'pointer' }}>
            <input type="checkbox" checked={form.featuredHome} onChange={e => setForm(f => ({ ...f, featuredHome: e.target.checked }))} />
            Show on home page banner (replaces whatever's currently featured)
          </label>

          {error && <div style={{ color: '#C62828', fontSize: 12, marginBottom: 10 }}>{error}</div>}

          <button onClick={createPromo} disabled={saving}
            style={{ width: '100%', padding: 12, borderRadius: 10, border: 'none', background: ORANGE, color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            {saving ? 'Creating...' : 'Create promotion'}
          </button>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#888' }}>Loading...</div>
      ) : promos.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#888' }}>No promotions yet.</div>
      ) : (
        promos.map(p => {
          const st = statusOf(p);
          return (
            <div key={p.id} style={{ background: 'white', borderRadius: 14, padding: 14, marginBottom: 10, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1a1a', letterSpacing: 0.5 }}>{p.code}</div>
                  <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
                    {p.discount_amount ? 'Rs.' + p.discount_amount + ' off' : p.discount_percent + '% off'}
                    {p.max_discount_amount ? ' (up to Rs.' + p.max_discount_amount + ')' : ''}
                    {p.min_booking_amount ? ' · min Rs.' + p.min_booking_amount : ''}
                  </div>
                  {p.description && <div style={{ fontSize: 11, color: '#AAA', marginTop: 2 }}>"{p.description}"</div>}
                  <div style={{ fontSize: 11, color: '#AAA', marginTop: 4 }}>
                    Used {p.times_used || 0}{p.max_uses ? ' / ' + p.max_uses : 'x'} · expires {new Date(p.valid_until).toLocaleDateString('en-IN')}
                  </div>
                  {p.max_uses > 0 && (
                    <div style={{ height: 4, borderRadius: 2, background: '#F0F0F0', marginTop: 6, width: 160, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: Math.min(100, ((p.times_used || 0) / p.max_uses) * 100) + '%', background: ORANGE }} />
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 20, background: st === 'active' ? '#E8F5E9' : st === 'expired' ? '#FFEBEE' : '#F5F5F5', color: st === 'active' ? '#2E7D32' : st === 'expired' ? '#C62828' : '#888' }}>
                    {st.toUpperCase()}
                  </span>
                  {p.featured_home && <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 20, background: '#FFF0EB', color: ORANGE }}>ON HOME PAGE</span>}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <button onClick={() => toggleFeatured(p)}
                  style={{ flex: 1, padding: '8px 0', borderRadius: 8, border: '1px solid #E8E8E8', background: 'white', color: '#555', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                  {p.featured_home ? 'Remove from home' : 'Show on home'}
                </button>
                <button onClick={() => togglePaused(p)}
                  style={{ flex: 1, padding: '8px 0', borderRadius: 8, border: '1px solid #E8E8E8', background: 'white', color: '#555', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                  {p.status === 'active' ? 'Pause' : 'Activate'}
                </button>
                <button onClick={() => deletePromo(p)}
                  style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #FFCDD2', background: 'white', color: '#C62828', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                  Delete
                </button>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
