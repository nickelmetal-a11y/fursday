import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://vucboyiklqdxpqbpfplt.supabase.co";
const SUPABASE_KEY = "sb_publishable_Ka7fejAT4Qw6ba5osxQVSg_iq6E-tz4";

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Notification helpers for Fursday
export const sendLocalNotification = (title, body) => {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title, { body, icon: '/favicon.ico' });
  }
};

export const requestNotifications = async () => {
  if ('Notification' in window && Notification.permission === 'default') {
    await Notification.requestPermission();
  }
};
