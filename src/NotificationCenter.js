import React, { useState, useEffect } from 'react';
import { supabase } from './supabase';
import { useLanguage } from './i18n';
import { color, font, radius, ui } from './theme';
import Icon from './ui/Icon';

const NOTIFICATION_TYPES = {
  booking_confirmed: { icon: 'check', tone: 'success' },
  booking_completed: { icon: 'check', tone: 'success' },
  booking_cancelled: { icon: 'close', tone: 'danger' },
  review_received: { icon: 'star', tone: 'warning' },
  message_received: { icon: 'message', tone: 'info' },
  walk_proof: { icon: 'camera', tone: null },
  referral_bonus: { icon: 'gift', tone: null },
  schedule_proposed: { icon: 'calendar', tone: null },
  sitter_on_way: { icon: 'walk', tone: 'info' },
  sitter_arrived: { icon: 'pin', tone: 'success' },
  walk_started: { icon: 'walk', tone: 'success' },
  walk_completed: { icon: 'check', tone: 'success' },
  booking_reminder: { icon: 'clock', tone: 'warning' },
};

export default function NotificationCenter({ onClose }) {
  const { t: tr } = useLanguage();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadNotifications();
    const subscription = supabase
      .channel('notifications')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, () => {
        loadNotifications();
      })
      .subscribe();

    return () => subscription.unsubscribe();
  }, []);

  const loadNotifications = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('sent_at', { ascending: false })
      .limit(50);

    setNotifications(data || []);
    setUnreadCount(data?.filter(n => !n.read).length || 0);
    setLoading(false);
  };

  const markAsRead = async (notificationId) => {
    await supabase
      .from('notifications')
      .update({ read: true, read_at: new Date().toISOString() })
      .eq('id', notificationId);
    loadNotifications();
  };

  const markAllAsRead = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase
      .from('notifications')
      .update({ read: true, read_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .eq('read', false);
    loadNotifications();
  };

  const deleteNotification = async (notificationId) => {
    await supabase.from('notifications').delete().eq('id', notificationId);
    loadNotifications();
  };

  const getTimeAgo = (date) => {
    const now = new Date();
    const diff = now - new Date(date);
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return tr('notifications_justNow');
    if (minutes < 60) return tr('notifications_minutesAgo', { n: minutes });
    if (hours < 24) return tr('notifications_hoursAgo', { n: hours });
    return tr('notifications_daysAgo', { n: days });
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(16,24,40,0.5)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 1000 }}>
      <div role="dialog" aria-modal="true" aria-label={tr('notifications_title')}
        style={{ width: '100%', maxWidth: 480, background: color.surface, borderRadius: `${radius.xl}px ${radius.xl}px 0 0`, maxHeight: '90vh', display: 'flex', flexDirection: 'column', fontFamily: font.family, paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div aria-hidden="true" style={{ width: 36, height: 4, borderRadius: 2, background: color.line, margin: '8px auto 0', flexShrink: 0 }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px 12px 20px', borderBottom: `1px solid ${color.line}`, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ fontSize: font.lg, fontWeight: 700, color: color.ink }}>{tr('notifications_title')}</div>
            {unreadCount > 0 && (
              <span style={{ minWidth: 22, height: 22, padding: '0 6px', boxSizing: 'border-box', borderRadius: radius.pill, background: color.navy, color: color.surface, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: font.xs, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                {unreadCount}
              </span>
            )}
          </div>
          <button onClick={onClose} aria-label={tr('common_close')} style={{ ...ui.backButton, borderRadius: radius.pill }}>
            <Icon name="plus" size={20} style={{ transform: 'rotate(45deg)' }} />
          </button>
        </div>

        <div style={{ flex: 1, overflow: 'auto' }}>
          {loading ? (
            <div role="status" aria-label={tr('common_loading')} style={{ padding: 16 }}>
              {[0, 1, 2].map(i => (
                <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 14 }}>
                  <div style={{ width: 40, height: 40, borderRadius: radius.md, background: color.tile, flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ height: 12, width: '60%', borderRadius: 6, background: color.tile, marginBottom: 8 }} />
                    <div style={{ height: 10, width: '85%', borderRadius: 5, background: color.tile }} />
                  </div>
                </div>
              ))}
            </div>
          ) : notifications.length === 0 ? (
            <div style={{ padding: '40px 24px', textAlign: 'center' }}>
              <div style={{ ...ui.iconTile, margin: '0 auto 12px' }}><Icon name="bell" /></div>
              <div style={{ fontSize: font.md, fontWeight: 600, color: color.ink, marginBottom: 4 }}>{tr('notifications_allCaughtUp')}</div>
              <div style={{ fontSize: 13, color: color.muted }}>{tr('notifications_noNewNotifications')}</div>
            </div>
          ) : (
            notifications.map((notif, i) => {
              const typeInfo = NOTIFICATION_TYPES[notif.type] || { icon: 'bell', tone: null };
              const tileTone = typeInfo.tone ? { background: color[typeInfo.tone + 'Soft'], color: color[typeInfo.tone] } : null;
              return (
                <div key={notif.id}
                  onClick={() => !notif.read && markAsRead(notif.id)}
                  role={notif.read ? undefined : 'button'}
                  tabIndex={notif.read ? undefined : 0}
                  aria-label={notif.read ? undefined : tr('notifications_markReadAria', { title: [notif.title, notif.body].filter(Boolean).join('. ') })}
                  onKeyDown={notif.read ? undefined : (e) => {
                    if (e.target !== e.currentTarget) return;
                    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); markAsRead(notif.id); }
                  }}
                  style={{
                    display: 'flex', gap: 12, alignItems: 'flex-start',
                    padding: '14px 12px 14px 16px',
                    background: notif.read ? color.surface : color.navySoft,
                    borderTop: i ? `1px solid ${color.line}` : 'none',
                    cursor: notif.read ? 'default' : 'pointer',
                  }}>
                  <div style={{ ...ui.iconTile, width: 40, height: 40, background: notif.read ? color.tile : color.surface, ...tileTone }}>
                    <Icon name={typeInfo.icon} size={19} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ fontSize: font.md, fontWeight: notif.read ? 600 : 700, color: color.ink, flex: 1, minWidth: 0 }}>{notif.title}</div>
                      {!notif.read && <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: 4, background: color.navy, flexShrink: 0 }} />}
                    </div>
                    {notif.body && <div style={{ fontSize: 13, color: color.text, marginTop: 2, lineHeight: 1.45 }}>{notif.body}</div>}
                    <div style={{ fontSize: font.xs, color: color.faint, marginTop: 6 }}>{getTimeAgo(notif.sent_at)}</div>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); deleteNotification(notif.id); }}
                    aria-label={tr('notifications_deleteAria')}
                    style={{ width: 36, height: 36, borderRadius: radius.pill, background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: color.faint, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon name="plus" size={18} style={{ transform: 'rotate(45deg)' }} />
                  </button>
                </div>
              );
            })
          )}
        </div>

        {unreadCount > 0 && (
          <div style={{ borderTop: `1px solid ${color.line}`, padding: '12px 16px', flexShrink: 0 }}>
            <button onClick={markAllAsRead} style={{ ...ui.secondaryButton, width: '100%', minHeight: 44, fontSize: font.md, color: color.navy }}>
              <Icon name="check" size={16} strokeWidth={2.25} />{tr('notifications_markAllRead')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
