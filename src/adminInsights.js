import { serviceStartTime } from './CancellationPolicyModal';

const HOUR = 60 * 60 * 1000;
const IN_HAND = ['authorized', 'held', 'paid'];

// Everything an operations person should act on today, most urgent first.
// Pure function so it is easy to test and reason about.
export function attentionItems({ bookings = [], sitters = [], disputes = [], deletions = [], now = new Date() }) {
  const items = [];
  const nameOf = (sitterId) => sitters.find(s => s.id === sitterId)?.users?.name || 'Sitter';
  const t = now.getTime();

  bookings.forEach(b => {
    const start = serviceStartTime(b).getTime();
    const ref = b.booking_ref || b.id;
    if (b.status === 'confirmed' && IN_HAND.includes(b.payment_status) && !Number.isNaN(start) && t - start > 30 * 60 * 1000) {
      items.push({ level: 'critical', kind: 'no_show', bookingId: b.id, title: 'Possible no-show: ' + ref, detail: nameOf(b.sitter_id) + ' has not started a walk that was due ' + Math.round((t - start) / 60000) + ' min ago.' });
    }
    if (b.status === 'active' && b.start_verified_at && t - new Date(b.start_verified_at).getTime() > (b.service_type === 'walk30' ? 2 : 14) * HOUR) {
      items.push({ level: 'critical', kind: 'running_long', bookingId: b.id, title: 'Running long: ' + ref, detail: 'Started ' + Math.round((t - new Date(b.start_verified_at).getTime()) / HOUR) + 'h ago and still not marked complete.' });
    }
    if (b.status === 'pending' && b.created_at && t - new Date(b.created_at).getTime() > 2 * HOUR) {
      items.push({ level: 'warning', kind: 'no_reply', bookingId: b.id, title: 'Sitter has not replied: ' + ref, detail: nameOf(b.sitter_id) + ' has not accepted or declined for ' + Math.round((t - new Date(b.created_at).getTime()) / HOUR) + 'h. Consider reassigning.' });
    }
    if (b.status === 'confirmed' && !IN_HAND.includes(b.payment_status) && !Number.isNaN(start) && start - t < 24 * HOUR && start > t) {
      items.push({ level: 'warning', kind: 'unpaid_soon', bookingId: b.id, title: 'Unpaid, starts soon: ' + ref, detail: 'Starts in ' + Math.max(1, Math.round((start - t) / HOUR)) + 'h and the parent has not paid.' });
    }
    const dueSince = b.released_at || b.completed_at;
    if (payoutBucket(b) === 'ready' && dueSince && t - new Date(dueSince).getTime() > 48 * HOUR) {
      items.push({ level: 'warning', kind: 'payout_late', bookingId: b.id, title: 'Payout overdue: ' + ref, detail: nameOf(b.sitter_id) + "'s payout has been ready for " + Math.round((t - new Date(dueSince).getTime()) / (24 * HOUR)) + ' days; Terms promise payment within 48h of release.' });
    }
    if (b.status === 'cancelled' && ['held', 'paid'].includes(b.payment_status) && (b.refund_amount_paise || 0) > (b.refunded_amount_paise || 0)) {
      items.push({ level: 'critical', kind: 'refund_by_hand', bookingId: b.id, title: 'Refund not sent: ' + ref, detail: 'Cancelled with a refund of Rs.' + Math.round(((b.refund_amount_paise || 0) - (b.refunded_amount_paise || 0)) / 100) + ' that has not gone back to the parent yet.' });
    }
  });

  disputes.filter(d => d.status === 'open' && d.created_at && t - new Date(d.created_at).getTime() > 48 * HOUR).forEach(d => {
    items.push({ level: 'warning', kind: 'dispute_sla', disputeId: d.id, title: 'Dispute waiting: ' + (d.title || 'untitled'), detail: 'Open for ' + Math.round((t - new Date(d.created_at).getTime()) / (24 * HOUR)) + ' days; Terms promise a decision within 72h.' });
  });
  sitters.filter(s => s.status === 'pending' && s.created_at && t - new Date(s.created_at).getTime() > 48 * HOUR).forEach(s => {
    items.push({ level: 'info', kind: 'review_waiting', sitterId: s.id, title: 'Application waiting: ' + (s.users?.name || 'sitter'), detail: 'Applied ' + Math.round((t - new Date(s.created_at).getTime()) / (24 * HOUR)) + ' days ago. Sitters are told to expect 24–48h.' });
  });
  deletions.filter(d => d.status === 'requested' && t - new Date(d.requested_at).getTime() > 25 * 24 * HOUR).forEach(d => {
    items.push({ level: 'critical', kind: 'deletion_due', title: 'Account deletion due', detail: 'Requested ' + Math.round((t - new Date(d.requested_at).getTime()) / (24 * HOUR)) + ' days ago; must be done within 30.' });
  });

  const rank = { critical: 0, warning: 1, info: 2 };
  return items.sort((a, b) => rank[a.level] - rank[b.level]);
}

// Flat 15% commission for everyone (TermsAndConditions.js #7), except the
// first 20 launch sitters an admin has marked "Founding Sitter" — they pay
// 0% until an admin turns it back off (see migration 025).
export const sitterKeepRate = (sitter) => (sitter?.is_founding_sitter ? 1 : 0.85);
// What the sitter receives for one booking: their own price (sitter_payout_paise;
// a parent's promo only lowers gross) less commission, plus any tip in full
// (the server adds tips to sitter_payout_paise).
export const sitterNetPaise = (b, sitter) => {
  const tip = b.tip_paise || 0;
  return Math.round(((b.sitter_payout_paise || b.gross_amount_paise || 0) - tip) * sitterKeepRate(sitter)) + tip;
};
// A late cancellation keeps a fee for the sitter once the parent's refund has
// gone out (api/payments cancel); any other cancellation owes the sitter nothing.
const keepsFee = (b) => (b.refund_percentage ?? 100) < 100 && (b.refunded_amount_paise || 0) >= (b.refund_amount_paise || 0);
// Where a sitter's payout stands: on_hold until 24h after the service, then
// ready to pay; disputed pauses it. Jobs from before pay-at-booking have no
// payout_status and are ready as soon as they are completed.
export function payoutBucket(b) {
  if (b.payout_status === 'paid') return 'paid';
  if (b.status === 'cancelled' && !(b.payout_status && keepsFee(b))) return null;
  if (['ready', 'on_hold', 'disputed'].includes(b.payout_status)) return b.payout_status;
  return b.status === 'completed' ? 'ready' : null;
}
export const unpaidPayouts = (bookings = []) => bookings.filter(b => payoutBucket(b) === 'ready');

// Unpaid completed jobs grouped per sitter, biggest amount owed first.
export function payoutGroups(bookings = [], sitters = []) {
  const byId = Object.fromEntries(sitters.map(s => [s.id, s]));
  const groups = {};
  unpaidPayouts(bookings).forEach(b => {
    const key = b.sitter_id || 'unknown';
    const sitter = byId[b.sitter_id] || null;
    const g = (groups[key] = groups[key] || { sitterId: b.sitter_id || null, sitter, items: [], total: 0 });
    const net = Math.round(sitterNetPaise(b, sitter) / 100);
    g.items.push({ booking: b, net });
    g.total += net;
  });
  return Object.values(groups).sort((a, b) => b.total - a.total);
}

const DAY = 24 * HOUR;
const inWindow = (iso, from, to) => {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return t >= from && t < to;
};

// Headline numbers for the last 7 days against the 7 days before.
export function weekOverWeek({ bookings = [], sitters = [], users = [], now = new Date() }) {
  const t = now.getTime();
  const sitterUserIds = new Set(sitters.map(s => s.user_id));
  const stats = (from, to) => {
    const created = bookings.filter(b => inWindow(b.created_at, from, to));
    const done = bookings.filter(b => b.status === 'completed' && inWindow(b.completed_at || b.booking_date || b.created_at, from, to));
    return {
      bookings: created.length,
      gmv: Math.round(done.reduce((a, b) => a + (b.gross_amount_paise || 0), 0) / 100),
      newParents: users.filter(u => !sitterUserIds.has(u.id) && inWindow(u.created_at, from, to)).length,
      newSitters: sitters.filter(s => s.status !== 'draft' && inWindow(s.created_at, from, to)).length,
      cancelRate: created.length ? Math.round((created.filter(b => b.status === 'cancelled').length / created.length) * 100) : 0,
    };
  };
  return { current: stats(t - 7 * DAY, t + 1), previous: stats(t - 14 * DAY, t - 7 * DAY) };
}

// Provider scorecard, the way service marketplaces track partner quality.
export function sitterScorecard(sitter, bookings = []) {
  const mine = bookings.filter(b => b.sitter_id === sitter.id);
  const completed = mine.filter(b => b.status === 'completed').length;
  const sitterCancelled = mine.filter(b => b.status === 'cancelled' && /^(Sitter:|Declined by sitter)/.test(b.cancellation_reason || '')).length;
  const responded = mine.filter(b => b.status !== 'pending').length;
  const declined = mine.filter(b => (b.cancellation_reason || '') === 'Declined by sitter').length;
  const acceptanceRate = responded ? Math.round(((responded - declined) / responded) * 100) : null;
  const cancelRate = mine.length ? Math.round((sitterCancelled / mine.length) * 100) : 0;
  const rating = Number(sitter.avg_rating || sitter.rating || 0);
  const flags = [];
  if (rating && rating < 3.5) flags.push('Rating below 3.5 (Terms minimum)');
  if (mine.length >= 3 && cancelRate >= 20) flags.push('Cancels ' + cancelRate + '% of jobs');
  if (acceptanceRate != null && responded >= 3 && acceptanceRate < 60) flags.push('Accepts only ' + acceptanceRate + '% of requests');
  return { total: mine.length, completed, sitterCancelled, acceptanceRate, cancelRate, rating, reviews: sitter.review_count || 0, flags };
}
