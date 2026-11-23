// Vercel Cron target (see vercel.json) - runs every 15 minutes. Finds
// bookings starting in ~1h or ~12h and sends an advance reminder to both
// the pet parent and the sitter. Needs SUPABASE_SERVICE_ROLE_KEY set as a
// Vercel environment variable (server-side only - never exposed to the
// browser bundle, unlike the other REACT_APP_* keys).
//
// This exists because notifyBookingReminder12h/1h in notificationService.js
// were dead code - nothing ever called them, since there was no scheduler.
// Client-side code can't reliably do this (the app has to be open), so this
// has to run server-side regardless of who's logged in.

const SUPABASE_URL = 'https://vucboyiklqdxpqbpfplt.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const SERVICE_NAMES = { walk30: '30-min walk', walk60: '60-min walk', boarding: 'Home boarding', daycare: 'Doggy daycare', dropin: 'Drop-in visit', housesit: 'House sitting' };

async function supabaseFetch(path, options = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  if (!res.ok) throw new Error(`Supabase ${path} failed: ${res.status} ${await res.text()}`);
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

async function createNotification(userId, type, title, body, bookingId) {
  if (!userId) return;
  await supabaseFetch('notifications', {
    method: 'POST',
    body: JSON.stringify({ user_id: userId, type, title, body, booking_id: bookingId }),
  });
}

async function alreadyReminded(bookingId, type) {
  const rows = await supabaseFetch(
    `notifications?booking_id=eq.${bookingId}&type=eq.${type}&select=id&limit=1`
  );
  return Array.isArray(rows) && rows.length > 0;
}

async function processWindow(hoursAhead, type, label) {
  const windowStart = new Date(Date.now() + hoursAhead * 60 * 60 * 1000);
  const windowEnd = new Date(windowStart.getTime() + 15 * 60 * 1000);

  // bookings table stores date and time separately; fetch confirmed bookings
  // in the target date range and filter precisely in JS (combining
  // booking_date + time_slot into a real timestamp isn't expressible as a
  // simple PostgREST filter). The +/-1 day padding is deliberate: booking_date
  // is an IST calendar date but this comparison is done in UTC, so a booking
  // near midnight IST could otherwise fall just outside a same-day filter.
  const dateFrom = new Date(windowStart.getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const dateTo = new Date(windowEnd.getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const bookings = await supabaseFetch(
    `bookings?status=eq.confirmed&booking_date=gte.${dateFrom}&booking_date=lte.${dateTo}` +
    `&select=id,booking_date,time_slot,service_type,pet_parent_id,sitter_id,sitter_profiles(user_id,users(name)),users(name)`
  );

  let sent = 0;
  for (const b of bookings || []) {
    if (!b.time_slot) continue;
    // booking_date/time_slot are India local time (this is a Delhi NCR/Pune
    // app); a bare date string parses as UTC in Vercel's serverless runtime,
    // which would be off by 5.5 hours - anchor the offset explicitly.
    const scheduledAt = new Date(`${b.booking_date}T${b.time_slot}:00+05:30`);
    if (scheduledAt < windowStart || scheduledAt >= windowEnd) continue;
    if (await alreadyReminded(b.id, type)) continue;

    const serviceName = SERVICE_NAMES[b.service_type] || b.service_type;
    const dateTimeStr = `${b.booking_date} at ${b.time_slot}`;
    const parentName = b.users?.name || 'Your pet parent';
    const sitterName = b.sitter_profiles?.users?.name || 'Your sitter';
    const sitterUserId = b.sitter_profiles?.user_id;

    await createNotification(b.pet_parent_id, type, `Upcoming ${serviceName} ${label}`, `With ${sitterName} on ${dateTimeStr}`, b.id);
    await createNotification(sitterUserId, type, `Upcoming ${serviceName} ${label}`, `With ${parentName} on ${dateTimeStr} - time to get ready!`, b.id);
    sent++;
  }
  return sent;
}

module.exports = async function handler(req, res) {
  if (!SERVICE_KEY) {
    res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY not configured' });
    return;
  }
  try {
    const sent12h = await processWindow(12, 'booking_reminder_12h', '(in 12 hours)');
    const sent1h = await processWindow(1, 'booking_reminder_1h', '(in 1 hour)');
    res.status(200).json({ ok: true, sent12h, sent1h });
  } catch (err) {
    console.error('send-reminders failed:', err);
    res.status(500).json({ error: err.message });
  }
};
