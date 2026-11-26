import { serviceStartTime } from './CancellationPolicyModal';

const HOUR = 60 * 60 * 1000;

// Everything an operations person should act on today, most urgent first.
// Pure function so it is easy to test and reason about.
export function attentionItems({ bookings = [], sitters = [], disputes = [], deletions = [], now = new Date() }) {
  const items = [];
  const nameOf = (sitterId) => sitters.find(s => s.id === sitterId)?.users?.name || 'Sitter';
  const t = now.getTime();

  bookings.forEach(b => {
    const start = serviceStartTime(b).getTime();
    const ref = b.booking_ref || b.id;
    if (b.status === 'confirmed' && b.payment_status === 'paid' && !Number.isNaN(start) && t - start > 30 * 60 * 1000) {
      items.push({ level: 'critical', kind: 'no_show', bookingId: b.id, title: 'Possible no-show: ' + ref, detail: nameOf(b.sitter_id) + ' has not started a walk that was due ' + Math.round((t - start) / 60000) + ' min ago.' });
    }
    if (b.status === 'active' && b.start_verified_at && t - new Date(b.start_verified_at).getTime() > (b.service_type === 'walk30' ? 2 : 14) * HOUR) {
      items.push({ level: 'critical', kind: 'running_long', bookingId: b.id, title: 'Running long: ' + ref, detail: 'Started ' + Math.round((t - new Date(b.start_verified_at).getTime()) / HOUR) + 'h ago and still not marked complete.' });
    }
    if (b.status === 'pending' && b.created_at && t - new Date(b.created_at).getTime() > 2 * HOUR) {
      items.push({ level: 'warning', kind: 'no_reply', bookingId: b.id, title: 'Sitter has not replied: ' + ref, detail: nameOf(b.sitter_id) + ' has not accepted or declined for ' + Math.round((t - new Date(b.created_at).getTime()) / HOUR) + 'h. Consider reassigning.' });
    }
    if (b.status === 'confirmed' && b.payment_status !== 'paid' && !Number.isNaN(start) && start - t < 24 * HOUR && start > t) {
      items.push({ level: 'warning', kind: 'unpaid_soon', bookingId: b.id, title: 'Unpaid, starts soon: ' + ref, detail: 'Starts in ' + Math.max(1, Math.round((start - t) / HOUR)) + 'h and the parent has not paid.' });
    }
    if (b.status === 'completed' && b.payout_status !== 'paid' && b.completed_at && t - new Date(b.completed_at).getTime() > 48 * HOUR) {
      items.push({ level: 'warning', kind: 'payout_late', bookingId: b.id, title: 'Payout overdue: ' + ref, detail: nameOf(b.sitter_id) + ' finished ' + Math.round((t - new Date(b.completed_at).getTime()) / (24 * HOUR)) + ' days ago; Terms promise payment within 48h.' });
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
