import React, { useState, useEffect } from 'react';
import { TrendingUp, Calendar, Wallet, DollarSign, Clock } from 'lucide-react';
import { supabase } from './supabase';

const THEMES = {
  Gurgaon: { primary: '#FF6B35', light: '#FFF0EB', grad: 'linear-gradient(135deg,#FF6B35,#FF8C5A)' },
  Pune: { primary: '#6C5CE7', light: '#F0EEFF', grad: 'linear-gradient(135deg,#6C5CE7,#8E7CF3)' },
};

export default function SitterEarningsDashboard({ city, onBack }) {
  const t = THEMES[city] || THEMES.Gurgaon;
  const [earnings, setEarnings] = useState({
    totalEarnings: 0,
    monthlyEarnings: [],
    pendingPayout: 0,
    paidOutTotal: 0,
    completedBookings: 0,
    lastPayoutDate: null,
  });
  const [loading, setLoading] = useState(true);
  const [timeFilter, setTimeFilter] = useState('all'); // all, month, week
  const [breakdown, setBreakdown] = useState([]);

  useEffect(() => {
    loadEarnings();
  }, []);

  const loadEarnings = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get sitter profile
      const { data: sitterProfile } = await supabase
        .from('sitter_profiles')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!sitterProfile) return;

      // Get all completed bookings for this sitter
      const { data: bookings } = await supabase
        .from('bookings')
        .select('id, gross_amount_paise, created_at, status, payment_status')
        .eq('sitter_id', sitterProfile.id)
        .eq('status', 'completed')
        .order('created_at', { ascending: false });

      if (!bookings) {
        setLoading(false);
        return;
      }

      // Calculate earnings (sitter gets 85%, platform gets 15%)
      let totalEarnings = 0;
      let completedCount = 0;
      let monthlyMap = {};
      let breakdownList = [];

      bookings.forEach(booking => {
        const earningsPaise = Math.floor(booking.gross_amount_paise * 0.85); // 85%
        const earningsRs = earningsPaise / 100;
        totalEarnings += earningsRs;
        completedCount += 1;

        // Track by month
        const date = new Date(booking.created_at);
        const monthKey = date.toLocaleString('en-IN', { month: 'short', year: 'numeric' });
        if (!monthlyMap[monthKey]) monthlyMap[monthKey] = 0;
        monthlyMap[monthKey] += earningsRs;

        // Individual booking breakdown
        breakdownList.push({
          id: booking.id,
          date: new Date(booking.created_at).toLocaleDateString('en-IN'),
          amount: (booking.gross_amount_paise / 100).toFixed(2),
          sitterEarnings: earningsRs.toFixed(2),
          status: booking.payment_status,
        });
      });

      // Get payout information (from admin_audit_logs or separate payout table)
      const { data: payoutLogs } = await supabase
        .from('admin_audit_logs')
        .select('*')
        .eq('action', 'mark_payout_paid')
        .ilike('reason', `%${sitterProfile.id}%`)
        .order('created_at', { ascending: false })
        .limit(1);

      const lastPaidOut = payoutLogs?.[0]?.created_at || null;

      // Calculate monthly breakdown
      const monthlyEarnings = Object.entries(monthlyMap).map(([month, amount]) => ({
        month,
        amount: amount.toFixed(2),
      }));

      setEarnings({
        totalEarnings: totalEarnings.toFixed(2),
        monthlyEarnings,
        completedBookings: completedCount,
        lastPayoutDate: lastPaidOut,
      });
      setBreakdown(breakdownList);
    } catch (error) {
      console.error('Error loading earnings:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filter breakdown based on time filter
  const getFilteredBreakdown = () => {
    const now = new Date();
    return breakdown.filter(item => {
      if (timeFilter === 'all') return true;
      const itemDate = new Date(item.date.split('/').reverse().join('-'));
      if (timeFilter === 'month') {
        return (now - itemDate) / (1000 * 60 * 60 * 24) <= 30;
      }
      if (timeFilter === 'week') {
        return (now - itemDate) / (1000 * 60 * 60 * 24) <= 7;
      }
      return true;
    });
  };

  if (loading) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', color: '#888' }}>
        Loading earnings...
      </div>
    );
  }

  const filteredBreakdown = getFilteredBreakdown();
  const filterTotal = filteredBreakdown.reduce((sum, item) => sum + parseFloat(item.sitterEarnings), 0);

  return (
    <div style={{ maxWidth: 500, margin: '0 auto', background: '#F8F8F8', minHeight: '100vh', paddingBottom: 100 }}>
      {/* Header */}
      <div style={{ background: t.grad, padding: '48px 20px 20px', color: 'white', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={onBack} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', width: 36, height: 36, borderRadius: 12, color: 'white', cursor: 'pointer', fontSize: 18 }}>
          ←
        </button>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>My Earnings</div>
          <div style={{ fontSize: 12, opacity: 0.8 }}>Track your walker income 💰</div>
        </div>
      </div>

      {/* Total Earnings Card */}
      <div style={{ padding: '20px', background: 'white', margin: '16px', borderRadius: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <div style={{ width: 48, height: 48, background: t.light, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>
            💰
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#888' }}>Total Earnings (All Time)</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: t.primary }}>Rs. {earnings.totalEarnings}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12, fontSize: 12, color: '#888' }}>
          <div>✓ {earnings.completedBookings} walks</div>
          <div>📅 Since joining</div>
        </div>
      </div>

      {/* Monthly Breakdown */}
      <div style={{ padding: '20px', background: 'white', margin: '0 16px 16px', borderRadius: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, fontSize: 14, fontWeight: 600, color: '#1a1a1a' }}>
          <Calendar size={16} color={t.primary} />
          Monthly Earnings
        </div>
        {earnings.monthlyEarnings.length === 0 ? (
          <div style={{ color: '#AAA', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>
            No earnings yet. Complete your first walk! 🚶
          </div>
        ) : (
          earnings.monthlyEarnings.map((month, idx) => (
            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: idx < earnings.monthlyEarnings.length - 1 ? '1px solid #F0F0F0' : 'none' }}>
              <span style={{ fontSize: 13, color: '#555' }}>{month.month}</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: t.primary }}>Rs. {month.amount}</span>
            </div>
          ))
        )}
      </div>

      {/* Payout Status */}
      <div style={{ padding: '20px', background: 'white', margin: '0 16px 16px', borderRadius: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, fontSize: 14, fontWeight: 600, color: '#1a1a1a' }}>
          <Wallet size={16} color={t.primary} />
          Payout Status
        </div>
        <div style={{ background: '#E8F5E9', padding: 12, borderRadius: 10, marginBottom: 12 }}>
          <div style={{ fontSize: 12, color: '#2E7D32', marginBottom: 4 }}>
            ✓ Admin marks payouts as paid
          </div>
          <div style={{ fontSize: 13, color: '#555', lineHeight: 1.6 }}>
            Once your walks are complete and verified, the admin marks your payout as paid. You'll see the status update here!
          </div>
        </div>
        {earnings.lastPayoutDate ? (
          <div style={{ fontSize: 12, color: '#888' }}>
            Last payout marked: {new Date(earnings.lastPayoutDate).toLocaleDateString('en-IN')}
          </div>
        ) : (
          <div style={{ fontSize: 12, color: '#AAA' }}>
            No payouts marked yet
          </div>
        )}
      </div>

      {/* Individual Bookings Breakdown */}
      <div style={{ padding: '20px', background: 'white', margin: '0 16px 16px', borderRadius: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, fontSize: 14, fontWeight: 600, color: '#1a1a1a' }}>
          <DollarSign size={16} color={t.primary} />
          Walk Earnings
        </div>

        {/* Filter Buttons */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {['all', 'month', 'week'].map(f => (
            <button
              key={f}
              onClick={() => setTimeFilter(f)}
              style={{
                padding: '6px 12px',
                borderRadius: 8,
                border: 'none',
                background: timeFilter === f ? t.primary : '#F0F0F0',
                color: timeFilter === f ? 'white' : '#888',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {f === 'all' ? 'All Time' : f === 'month' ? 'This Month' : 'This Week'}
            </button>
          ))}
        </div>

        {/* Summary for filtered period */}
        {filteredBreakdown.length > 0 && (
          <div style={{ background: t.light, padding: 12, borderRadius: 10, marginBottom: 12, textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: '#888' }}>
              {filteredBreakdown.length} walk{filteredBreakdown.length !== 1 ? 's' : ''} · Rs. {filterTotal.toFixed(2)} earned
            </div>
          </div>
        )}

        {/* Breakdown List */}
        {filteredBreakdown.length === 0 ? (
          <div style={{ color: '#AAA', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>
            No walks in this period
          </div>
        ) : (
          filteredBreakdown.map((item, idx) => (
            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: idx < filteredBreakdown.length - 1 ? '1px solid #F0F0F0' : 'none' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, color: '#1a1a1a' }}>{item.date}</div>
                <div style={{ fontSize: 11, color: '#888' }}>Booking: Rs. {item.amount}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: t.primary }}>Rs. {item.sitterEarnings}</div>
                <div style={{ fontSize: 10, color: item.status === 'paid' ? '#2E7D32' : '#E65100', fontWeight: 600 }}>
                  {item.status === 'paid' ? '✓ Paid' : 'Pending'}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Tips Section */}
      <div style={{ padding: '20px', background: 'white', margin: '0 16px 16px', borderRadius: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, fontSize: 14, fontWeight: 600, color: '#1a1a1a' }}>
          <TrendingUp size={16} color={t.primary} />
          Earn More Tips
        </div>
        <ul style={{ fontSize: 12, color: '#555', lineHeight: 1.8, paddingLeft: 16 }}>
          <li>⭐ Get 5-star reviews to become a Top Sitter</li>
          <li>📸 Upload walk photos to increase trust</li>
          <li>⚡ Accept bookings quickly to earn the Lightning Response badge</li>
          <li>💯 Maintain 100% completion rate</li>
          <li>💬 Message back fast - happy parents book again!</li>
        </ul>
      </div>
    </div>
  );
}
