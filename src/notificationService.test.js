// notificationService: every alert is one in-app row, then a fire-and-forget
// POST to /api/notify (which emails/pushes on the server). The browser never
// calls an email or SMS provider itself.
import * as notificationService from './notificationService';
import { createNotification } from './notificationService';

const inserted = [];

jest.mock('./supabase', () => ({
  supabase: {
    auth: { getSession: () => Promise.resolve({ data: { session: global.__session } }) },
    from: () => ({
      insert: (row) => { global.__inserted.push(row); return Promise.resolve({ error: global.__insertError }); },
      select: () => ({ eq: () => ({ eq: () => Promise.resolve({ count: 3 }) }) }),
    }),
  },
}));

const flush = () => new Promise(r => setTimeout(r, 0));

beforeEach(() => {
  inserted.length = 0;
  global.__inserted = inserted;
  global.__insertError = null;
  global.__session = { access_token: 'tok-123' };
});

test('inserts the row with an id made in the browser and returns it, without reading it back', async () => {
  const row = await createNotification('u-sitter', 'booking_request', 'New request', 'Accept or decline', null, 'bk-1');
  expect(inserted).toHaveLength(1);
  expect(inserted[0]).toMatchObject({ user_id: 'u-sitter', type: 'booking_request', title: 'New request', booking_id: 'bk-1' });
  expect(inserted[0].id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  expect(row).toEqual(inserted[0]);
});

test('asks /api/notify to deliver it, with the caller\'s session token', async () => {
  const row = await createNotification('u-parent', 'booking_accepted', 'Accepted', 'See you soon');
  await flush();
  const [url, opts] = global.fetch.mock.calls.find(([u]) => String(u).endsWith('/api/notify'));
  expect(url).toBe('https://fursday.vercel.app/api/notify');
  expect(opts.headers.Authorization).toBe('Bearer tok-123');
  expect(JSON.parse(opts.body)).toEqual({ notification_id: row.id });
});

test('signed out: the row is still written but nothing is posted', async () => {
  global.__session = null;
  await createNotification('u-parent', 'booking_accepted', 'Accepted', 'See you soon');
  await flush();
  expect(inserted).toHaveLength(1);
  expect(global.fetch.mock.calls.some(([u]) => String(u).endsWith('/api/notify'))).toBe(false);
});

test('a failed insert returns null and posts nothing; a failed delivery never throws', async () => {
  global.__insertError = { message: 'denied' };
  jest.spyOn(console, 'error').mockImplementation(() => {});
  expect(await createNotification('u-parent', 't', 'x', 'y')).toBeNull();
  await flush();
  expect(global.fetch).not.toHaveBeenCalled();

  global.__insertError = null;
  global.fetch = jest.fn(() => Promise.reject(new Error('offline')));
  await expect(createNotification('u-parent', 't', 'x', 'y')).resolves.toBeTruthy();
  await flush();
  console.error.mockRestore();
});

test('no recipient: nothing happens', async () => {
  expect(await createNotification(null, 't', 'x', 'y')).toBeNull();
  expect(inserted).toHaveLength(0);
});

test('the in-app row is written even when the person turned push off (push only controls the phone alert)', async () => {
  await notificationService.notifyBookingCancelled({ userId: 'u-parent', otherUserName: 'Priya', reason: 'Sick' });
  expect(inserted).toEqual([expect.objectContaining({ user_id: 'u-parent', type: 'booking_cancelled', title: 'Priya cancelled the booking', body: 'Sick' })]);
});

test('the notify* API other screens use still exists and writes one row per recipient', async () => {
  await notificationService.notifyBookingConfirmed({ sitterId: 's', petParentId: 'p', petName: 'Bruno', sitterName: 'Priya', dateTime: 'Mon 7:00 AM' });
  await notificationService.notifyWalkStarted('s', null, 'p', null, 'Bruno', 'Priya');
  await notificationService.notifyPayoutMarked('s', 'x@y.z', '9', 34000, 1, 'today');
  await notificationService.notifyMessageReceived('p', null, 'Priya', 'bk-9');
  expect(inserted.map(r => [r.user_id, r.type])).toEqual([
    ['s', 'booking_confirmed'], ['p', 'booking_confirmed'], ['s', 'walk_started'], ['p', 'walk_started'], ['s', 'payout_marked'], ['p', 'message_received'],
  ]);
  expect(inserted[4].body).toBe('Rs. 340 marked as paid');
  expect(inserted[5].booking_id).toBe('bk-9');
  for (const name of ['notifyReviewReceived', 'notifyScheduleProposed', 'notifySitterArriving', 'notifyWalkProofReceived', 'notifyBookingCompleted',
    'notifyWalkCompleted', 'notifySitterRejected', 'notifySitterSuspended', 'notifyTopSitterAwarded', 'notifyDisputeFiled', 'notifyDisputeResolved',
    'notifyHeatAdvisory', 'notifyBookingReminder12h', 'notifyBookingReminder1h', 'notifyWeeklyEarnings', 'notifyRatingUpdate', 'notifyNoShow',
    'notifyCancellationReminder', 'notifyPaymentFailed', 'notifyResponseTimeout', 'notifySitterUnavailable', 'notifyReferralBonusPaid',
    'notifyPerformanceBadge', 'notifyAdminAction', 'getUserUnreadNotificationCount']) {
    expect(typeof notificationService[name]).toBe('function');
  }
  expect(await notificationService.getUserUnreadNotificationCount('p')).toBe(3);
});
