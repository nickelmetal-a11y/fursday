-- Confirmed via a direct Realtime websocket probe: subscribing to postgres_changes
-- on `messages` returns "Unable to subscribe to changes... Realtime is [not]
-- enabled for the given connect parameters." Messages save correctly (RLS and
-- inserts both work), but ChatScreen.js's live subscription can never receive
-- them, so the other party never sees a new message without a manual reload.
-- NotificationCenter.js subscribes to `notifications` the same way and has the
-- same gap.
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
