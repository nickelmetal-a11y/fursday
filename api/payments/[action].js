// /api/payments/<action>: pay when booking, hold until the sitter accepts,
// release to the sitter 24h after the service. One function serves every
// action so the deployment stays inside Vercel's function limit.
//   create-order  parent   Razorpay order for the booking's DB price (manual capture)
//   verify        parent   checks Razorpay's signature, marks the money authorized
//   simulate      parent   @example.com test accounts only, while Razorpay is off
//   capture       sitter   sitter accepted: take the held money, start the payout hold
//   release-hold  sitter   declined or cancelled by the sitter: hand everything back
//   cancel        parent   refund by the cancellation policy (admin: always 100%)
//   sweep         cron     daily: void unanswered holds, release finished payouts
const L = require('./_lib');

const SVC = { walk30: 'walk', walk60: 'walk', boarding: 'boarding stay', daycare: 'daycare', dropin: 'visit', housesit: 'house sit' };
const rupees = (paise) => 'Rs.' + Math.round((paise || 0) / 100);

async function asParent(req, b) {
  const caller = await L.callerFrom(req);
  if (b.pet_parent_id !== caller.id) throw new L.HttpError(403, 'This is not your booking', 'forbidden');
  return caller;
}
async function asSitterOrAdmin(req, b) {
  const caller = await L.callerFrom(req);
  if (caller.id && caller.id === await L.sitterUserId(b)) return { caller, admin: false };
  if (await L.isAdmin(caller)) return { caller, admin: true };
  throw new L.HttpError(403, 'Only this booking\'s sitter can do that', 'forbidden');
}
// A voided hold can be paid again if the booking is still going ahead.
const unpaid = (b) => !b.payment_status || ['unpaid', 'pending', 'voided'].includes(b.payment_status);

async function markAuthorized(b, fields) {
  let updated = await L.updateBooking(b.id, { payment_status: 'authorized', paid_at: new Date().toISOString(), ...fields });
  await L.logEvent(b.id, 'authorized', b.gross_amount_paise, fields.payment_id, fields.payment_mode === 'simulated' ? 'Simulated test payment' : null);
  if (b.status === 'confirmed') {
    updated = await L.capture(updated);
  } else {
    await L.notify(await L.sitterUserId(b), 'booking_request', 'New paid request ' + (b.booking_ref || ''),
      'The parent has paid ' + rupees(b.gross_amount_paise) + ' for a ' + (SVC[b.service_type] || 'booking') + ' on ' + (b.booking_date || '') + ' ' + (b.time_slot || '') + '. It is held safely: accept to confirm, or decline and they are not charged.', b.id);
  }
  return updated;
}

const result = (b) => ({ ok: true, payment_status: b.payment_status, payout_status: b.payout_status, payout_release_at: b.payout_release_at, status: b.status });

const actions = {
  async 'create-order'(req, body) {
    const caller = await L.callerFrom(req);
    let b;
    try { b = await L.loadBooking(body.booking_id); } catch (e) {
      if (e.code === 'needs_migration') return { ok: true, mode: 'unavailable', reason: 'needs_migration' };
      throw e;
    }
    if (b.pet_parent_id !== caller.id) throw new L.HttpError(403, 'This is not your booking', 'forbidden');
    if (!['pending', 'confirmed'].includes(b.status)) throw new L.HttpError(409, 'This booking can no longer be paid', 'bad_state');
    if (!unpaid(b)) throw new L.HttpError(409, 'This booking is already paid', 'already_paid');
    const amount = b.gross_amount_paise || 0;
    if (amount < 100) return { ok: true, mode: 'none_due', amount };
    const keys = L.razorpayKeys();
    if (!keys) return { ok: true, mode: L.TEST_EMAIL.test(caller.email) ? 'simulated' : 'unavailable', amount };
    const order = await L.razorpay('/orders', 'POST', {
      amount, currency: 'INR', receipt: String(b.booking_ref || b.id).slice(0, 40), notes: { booking_id: b.id },
      payment: { capture: 'manual', capture_options: { automatic_expiry_period: 12, manual_expiry_period: 7200, refund_speed: 'normal' } },
    });
    await L.updateBooking(b.id, { razorpay_order_id: order.id });
    return { ok: true, mode: L.gatewayMode(keys), order_id: order.id, key_id: keys.id, amount, currency: 'INR', booking_ref: b.booking_ref };
  },

  async verify(req, body) {
    const b = await L.loadBooking(body.booking_id);
    await asParent(req, b);
    const { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature } = body;
    if (!unpaid(b) && b.payment_id === paymentId) return result(b);
    if (!unpaid(b)) throw new L.HttpError(409, 'This booking is already paid', 'already_paid');
    if (!b.razorpay_order_id || orderId !== b.razorpay_order_id) throw new L.HttpError(400, 'This payment is for a different order', 'order_mismatch');
    if (!L.signatureValid(orderId, paymentId, signature)) throw new L.HttpError(400, 'Payment signature is not valid', 'bad_signature');
    const p = await L.razorpay('/payments/' + encodeURIComponent(paymentId));
    if (p.order_id !== orderId || Number(p.amount) !== Number(b.gross_amount_paise) || !['authorized', 'captured'].includes(p.status)) {
      throw new L.HttpError(400, 'Payment does not match this booking', 'payment_mismatch');
    }
    return result(await markAuthorized(b, { payment_id: paymentId, payment_mode: L.gatewayMode(L.razorpayKeys()) }));
  },

  async simulate(req, body) {
    const b = await L.loadBooking(body.booking_id);
    const caller = await asParent(req, b);
    if (!L.TEST_EMAIL.test(caller.email)) throw new L.HttpError(403, 'Test payments are only for test accounts', 'not_test_account');
    if (L.razorpayKeys()) throw new L.HttpError(409, 'Razorpay is switched on; use the real checkout', 'gateway_on');
    if (!['pending', 'confirmed'].includes(b.status)) throw new L.HttpError(409, 'This booking can no longer be paid', 'bad_state');
    if (!unpaid(b)) throw new L.HttpError(409, 'This booking is already paid', 'already_paid');
    return result(await markAuthorized(b, { payment_id: 'sim_' + b.id.slice(0, 8) + '_' + Date.now().toString(36), payment_mode: 'simulated' }));
  },

  async capture(req, body) {
    const b = await L.loadBooking(body.booking_id);
    await asSitterOrAdmin(req, b);
    if (['cancelled', 'completed'].includes(b.status)) throw new L.HttpError(409, 'This booking is ' + b.status, 'bad_state');
    return result(await L.capture(b));
  },

  async 'release-hold'(req, body) {
    const b = await L.loadBooking(body.booking_id);
    await asSitterOrAdmin(req, b);
    if (b.status === 'completed') throw new L.HttpError(409, 'A completed booking is paid out, not released', 'bad_state');
    const reason = String(body.reason || 'The sitter could not take this booking').slice(0, 300);
    const { booking, outcome } = await L.releaseFully(b, reason);
    return { ...result(booking), outcome };
  },

  async cancel(req, body) {
    const b = await L.loadBooking(body.booking_id);
    const caller = await L.callerFrom(req);
    const admin = b.pet_parent_id !== caller.id && await L.isAdmin(caller);
    if (b.pet_parent_id !== caller.id && !admin) throw new L.HttpError(403, 'This is not your booking', 'forbidden');
    if (!['pending', 'confirmed'].includes(b.status) && !(admin && b.status === 'active')) throw new L.HttpError(409, 'This booking can no longer be cancelled', 'bad_state');
    const reason = String(body.reason || 'Cancelled').slice(0, 300);
    const now = new Date().toISOString();
    const gross = b.gross_amount_paise || 0;
    const base = { status: 'cancelled', cancellation_reason: reason, cancelled_at: now, payout_status: null };

    if (unpaid(b) || b.payment_status === 'refunded') {
      const updated = await L.updateBooking(b.id, { ...base, refund_percentage: 0, refund_amount_paise: 0 });
      return { ...result(updated), refund_percentage: 0, refund_amount_paise: 0 };
    }
    if (b.payment_status === 'authorized') {
      const { booking } = await L.releaseFully(b, reason);
      return { ...result(booking), refund_percentage: 100, refund_amount_paise: gross, outcome: 'voided' };
    }
    const pct = admin ? 100 : L.refundPercent(b);
    const already = b.refunded_amount_paise || 0;
    const amount = Math.max(0, Math.round(gross * pct / 100) - already);
    const r = await L.refund(b, amount, reason);
    const refunded = already + amount;
    const fields = {
      ...base, refund_percentage: pct, refund_amount_paise: Math.round(gross * pct / 100), refunded_amount_paise: refunded,
      payment_status: refunded >= gross && gross > 0 ? 'refunded' : refunded > 0 ? 'partially_refunded' : b.payment_status,
    };
    const updated = await L.updateBooking(b.id, fields);
    if (amount > 0) await L.logEvent(b.id, 'refunded', amount, r.ref, (r.manual ? 'Refund by hand: ' : '') + pct + '% policy refund. ' + reason);
    return { ...result(updated), refund_percentage: pct, refund_amount_paise: fields.refund_amount_paise, outcome: r.manual ? 'refund_manual' : amount > 0 ? 'refunded' : 'no_refund' };
  },

  async sweep(req) {
    const secret = process.env.CRON_SECRET;
    const viaCron = secret && (req.headers.authorization || '') === 'Bearer ' + secret;
    if (!viaCron && !(await L.isAdmin(await L.callerFrom(req)))) throw new L.HttpError(403, 'Admins only', 'forbidden');
    const now = Date.now();
    const out = { ok: true, voided: 0, captured: 0, released: 0, disputed: 0, errors: [] };

    let holds;
    try { holds = await L.rest('bookings?select=*&payment_status=eq.authorized'); } catch (e) {
      if (/payment_status|column/i.test(e.message)) return { ...out, ok: true, note: 'Run migration 037 first' };
      throw e;
    }
    for (const b of holds || []) {
      if (['confirmed', 'active', 'completed'].includes(b.status)) {
        // Accepted while the payments server was unreachable: capture now.
        try { await L.capture(b); out.captured++; } catch (e) { out.errors.push((b.booking_ref || b.id) + ': ' + e.message); }
        continue;
      }
      const stale = b.status === 'pending' && b.paid_at && now - new Date(b.paid_at).getTime() > L.NO_REPLY_HOURS * L.HOUR;
      if (!stale && b.status !== 'cancelled') continue;
      try { await L.releaseFully(b, stale ? 'The sitter did not reply within 24 hours' : 'Booking cancelled'); out.voided++; }
      catch (e) { out.errors.push((b.booking_ref || b.id) + ': ' + e.message); }
    }

    const waiting = await L.rest('bookings?select=*&payout_status=in.(on_hold,disputed)');
    const ids = (waiting || []).map(b => b.id);
    const openDispute = new Set(), reported = new Set();
    if (ids.length) {
      const list = 'in.(' + ids.join(',') + ')';
      (await L.rest('disputes?select=booking_id,status&booking_id=' + list) || []).forEach(d => { if (!L.CLOSED_DISPUTE.includes(d.status)) openDispute.add(d.booking_id); });
      try { (await L.rest('sitter_reports?select=booking_id&booking_id=' + list) || []).forEach(r => reported.add(r.booking_id)); } catch { /* no reports table */ }
    }
    for (const b of waiting || []) {
      try {
        if (b.status !== 'completed') continue;
        const held = openDispute.has(b.id) || reported.has(b.id);
        if (held) {
          if (b.payout_status === 'on_hold') {
            await L.updateBooking(b.id, { payout_status: 'disputed' });
            await L.logEvent(b.id, 'disputed', b.sitter_payout_paise, null, 'Payout paused: the parent reported a problem');
            out.disputed++;
          }
          continue;
        }
        if (b.payout_status === 'on_hold' && b.payout_release_at && new Date(b.payout_release_at).getTime() > now) continue;
        // Phase 1: a Razorpay Route transfer to the sitter's linked account goes here.
        await L.updateBooking(b.id, { payout_status: 'ready', released_at: new Date().toISOString() });
        await L.logEvent(b.id, 'released', b.sitter_payout_paise, null, 'Ready to pay the sitter');
        await L.notify(await L.sitterUserId(b), 'payout_ready', 'Your payout is ready', 'Booking ' + (b.booking_ref || '') + ' is complete and its payout is on its way to your UPI.', b.id);
        out.released++;
      } catch (e) { out.errors.push((b.booking_ref || b.id) + ': ' + e.message); }
    }
    return out;
  },
};

async function handler(req, res) {
  L.cors(req, res);
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  const action = (req.query && req.query.action) || String(req.url || '').split('?')[0].split('/').pop();
  const run = actions[action];
  if (!run) { res.status(404).json({ error: 'Unknown payments action' }); return; }
  if (req.method !== 'POST' && !(action === 'sweep' && req.method === 'GET')) { res.status(405).json({ error: 'Use POST' }); return; }
  if (!L.serviceKey()) { res.status(500).json({ error: 'Server is not configured' }); return; }
  res.setHeader('Cache-Control', 'no-store');
  try {
    res.status(200).json(await run(req, L.readBody(req)));
  } catch (err) {
    const status = err instanceof L.HttpError ? err.status : 500;
    if (status >= 500) console.error('payments/' + action + ' failed:', err);
    res.status(status).json({ error: err.message, code: err.code || 'error' });
  }
}

module.exports = handler;
module.exports.config = { maxDuration: 60 };
