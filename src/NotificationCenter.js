import React, { useState, useEffect } from 'react';
import { X, Bell, CheckCircle, MessageCircle, AlertCircle, Gift } from 'lucide-react';
import { supabase } from './supabase';

const NOTIFICATION_TYPES = {
  booking_confirmed: { icon: '✓', label: 'Booking confirmed', color: '#2E7D32' },
  booking_completed: { icon: '✓', label: 'Booking completed', color: '#2E7D32' },
  booking_cancelled: { icon: '✕', label: 'Booking cancelled', color: '#A32D2D' },
  review_received: { icon: '⭐', label: 'New review', color: '#FFC107' },
  message_received: { icon: '💬', label: 'New message', color: '#2196F3' },
  walk_proof: { icon: '📸', label: 'Walk proof received', color: '#FF6B35' },
  referral_bonus: { icon: '🎁', label: 'Referral bonus', color: '#6C5CE7' },
};

export default function NotificationCenter({ onClose }) {
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

    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end', zIndex: 1000 }}>
      <div style={{ width: '100%', maxWidth: 390, background: 'white', borderRadius: '24px 24px 0 0', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid #F0F0F0', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Bell size={20} />
            <div style={{ fontSize: 18, fontWeight: 700 }}>Notifications</div>
            {unreadCount > 0 && (
              <div style={{ background: '#FF6B35', color: 'white', borderRadius: 12, width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700 }}>
                {unreadCount}
              </div>
            )}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
            <X size={20} />
          </button>
        </div>

        {/* Notifications List */}
        <div style={{ flex: 1, overflow: 'auto', padding: '12px 0' }}>
          {loading ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: '#888' }}>Loading...</div>
          ) : notifications.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>📭</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a', marginBottom: 4 }}>All caught up!</div>
              <div style={{ fontSize: 12, color: '#888' }}>No new notifications</div>
            </div>
          ) : (
            notifications.map(notif => {
              const typeInfo = NOTIFICATION_TYPES[notif.type] || { icon: 'ℹ️', label: notif.type };
              return (
                <div key={notif.id}
                  onClick={() => !notif.read && markAsRead(notif.id)}
                  style={{
                    padding: '12px 16px',
                    borderLeft: `4px solid ${typeInfo.color}`,
                    background: notif.read ? 'white' : '#F8F8F8',
                    borderBottom: '1px solid #F0F0F0',
                    cursor: notif.read ? 'default' : 'pointer',
                  }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span style={{ fontSize: 16 }}>{typeInfo.icon}</span>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a1a', flex: 1 }}>{notif.title}</div>
                        {!notif.read && <div style={{ width: 8, height: 8, borderRadius: 4, background: '#FF6B35', flexShrink: 0 }} />}
                      </div>
                      {notif.body && <div style={{ fontSize: 12, color: '#666', marginLeft: 24 }}>{notif.body}</div>}
                      <div style={{ fontSize: 11, color: '#AAA', marginLeft: 24, marginTop: 6 }}>{getTimeAgo(notif.sent_at)}</div>
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); deleteNotification(notif.id); }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#CCC' }}>
                      ✕
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        {unreadCount > 0 && (
          <div style={{ borderTop: '1px solid #F0F0F0', padding: '12px 16px', flexShrink: 0 }}>
            <button onClick={markAllAsRead}
              style={{ width: '100%', padding: '10px 0', borderRadius: 12, border: 'none', background: '#FF6B35', color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              Mark all as read
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
