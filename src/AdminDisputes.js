import React, { useState, useEffect } from 'react';
import { supabase } from './supabase';

const DISPUTE_TYPES = {
  refund_request: '💰 Refund Request',
  quality_complaint: '⭐ Quality Issue',
  payment_issue: '🏧 Payment Problem',
  no_show: '❌ No Show',
  safety_concern: '🚨 Safety Concern',
};

export default function AdminDisputes() {
  const [disputes, setDisputes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('open');
  const [selectedDispute, setSelectedDispute] = useState(null);
  const [resolution, setResolution] = useState('');
  const [refundAmount, setRefundAmount] = useState('');
  const [adminNotes, setAdminNotes] = useState('');
  const [resolving, setResolving] = useState(false);

  useEffect(() => {
    loadDisputes();
  }, [filterStatus]);

  const loadDisputes = async () => {
    setLoading(true);
    let query = supabase
      .from('disputes')
      .select('*, bookings(booking_ref, gross_amount_paise)')
      .order('created_at', { ascending: false });

    if (filterStatus !== 'all') {
      query = query.eq('status', filterStatus);
    }

    const { data } = await query;
    setDisputes(data || []);
    setLoading(false);
  };

  const resolveDispute = async (disputeId) => {
    if (!resolution) {
      alert('Please select a resolution');
      return;
    }
    setResolving(true);
    try {
      const { error: updateError } = await supabase
        .from('disputes')
        .update({
          status: 'resolved',
          resolution,
          refund_amount: refundAmount ? parseFloat(refundAmount) : null,
          admin_notes: adminNotes,
          resolved_at: new Date().toISOString(),
        })
        .eq('id', disputeId);
      if (updateError) throw updateError;

      // TIER 2: Send dispute resolved notification
      try {
        const { data: disputeData } = await supabase
          .from('disputes')
          .select('reported_by, reported_user_id')
          .eq('id', disputeId)
          .single();
        const { notifyDisputeResolved } = await import('./notificationService');
        // Both sides hear the outcome: the person who raised it and the person it was about.
        for (const uid of [disputeData?.reported_by, disputeData?.reported_user_id].filter(Boolean)) {
          const { data: contact } = await supabase.rpc('get_user_contact', { target_id: uid });
          await notifyDisputeResolved(uid, contact?.[0]?.email, contact?.[0]?.phone, 'Fursday', resolution,
            uid === disputeData.reported_by && refundAmount ? parseFloat(refundAmount) * 100 : 0);
        }
      } catch(notifErr) { console.error('Dispute resolution notification failed:', notifErr); }

      setSelectedDispute(null);
      setResolution('');
      setRefundAmount('');
      setAdminNotes('');
      loadDisputes();
      alert('Dispute resolved!');
    } catch (error) {
      alert('Error resolving dispute: ' + error.message);
    }
    setResolving(false);
  };

  const statusCounts = {
    open: disputes.filter(d => d.status === 'open').length,
    in_review: disputes.filter(d => d.status === 'in_review').length,
    resolved: disputes.filter(d => d.status === 'resolved').length,
  };

  return (
    <div>
      {selectedDispute ? (
        <div>
          <button onClick={() => setSelectedDispute(null)} style={{ marginBottom: 16, padding: '6px 14px', borderRadius: 8, border: '1.5px solid #E0E0E0', background: 'white', color: '#888', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            ← Back to List
          </button>
          <div style={{ background: 'white', borderRadius: 16, padding: 16, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#1a1a1a' }}>
                  {DISPUTE_TYPES[selectedDispute.dispute_type] || selectedDispute.dispute_type}
                </div>
                <div style={{ fontSize: 12, color: '#888' }}>Booking: {selectedDispute.bookings?.booking_ref}</div>
              </div>
              <div style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: '#FFF3E0', color: '#E65100', fontWeight: 600 }}>
                {selectedDispute.status}
              </div>
            </div>
            <div style={{ background: '#F8F8F8', borderRadius: 10, padding: 12, marginBottom: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#1a1a1a', marginBottom: 6 }}>{selectedDispute.title}</div>
              <div style={{ fontSize: 12, color: '#555', lineHeight: 1.6 }}>{selectedDispute.description}</div>
            </div>

            {selectedDispute.status !== 'resolved' && (
              <div style={{ borderTop: '1px solid #E0E0E0', paddingTop: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a1a', marginBottom: 10 }}>Resolution</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
                  {['refund_full', 'refund_partial', 'no_refund', 'other'].map(opt => (
                    <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                      <input type="radio" name="resolution" value={opt} checked={resolution === opt} onChange={(e) => setResolution(e.target.value)} />
                      <span style={{ fontSize: 12, color: '#555' }}>
                        {opt === 'refund_full' ? '100% Refund' : opt === 'refund_partial' ? 'Partial Refund' : opt === 'no_refund' ? 'No Refund' : 'Other'}
                      </span>
                    </label>
                  ))}
                </div>
                {resolution.includes('refund') && (
                  <input type="number" placeholder="Refund amount (Rs.)" value={refundAmount} onChange={(e) => setRefundAmount(e.target.value)}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid #E0E0E0', fontSize: 12, marginBottom: 10, boxSizing: 'border-box' }} />
                )}
                <textarea placeholder="Admin notes..." value={adminNotes} onChange={(e) => setAdminNotes(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid #E0E0E0', fontSize: 12, marginBottom: 10, minHeight: 60, boxSizing: 'border-box', fontFamily: 'inherit' }} />
                <button onClick={() => resolveDispute(selectedDispute.id)} disabled={resolving}
                  style={{ width: '100%', padding: '10px 0', borderRadius: 10, border: 'none', background: '#2E7D32', color: 'white', fontSize: 13, fontWeight: 700, cursor: resolving ? 'not-allowed' : 'pointer', opacity: resolving ? 0.7 : 1 }}>
                  {resolving ? 'Resolving...' : 'Resolve Dispute'}
                </button>
              </div>
            )}
          </div>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            {['open', 'in_review', 'resolved', 'all'].map(status => (
              <button key={status} onClick={() => setFilterStatus(status)}
                style={{ padding: '6px 14px', borderRadius: 8, border: 'none', background: filterStatus === status ? '#FF6B35' : '#F0F0F0', color: filterStatus === status ? 'white' : '#888', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                {status === 'all' ? 'All' : status.charAt(0).toUpperCase() + status.slice(1)} ({status === 'all' ? disputes.length : statusCounts[status] || 0})
              </button>
            ))}
          </div>

          {loading && <div style={{ textAlign: 'center', padding: 40, color: '#888' }}>Loading disputes...</div>}

          {!loading && disputes.length === 0 && (
            <div style={{ textAlign: 'center', padding: 40 }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>✨</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a' }}>No disputes</div>
            </div>
          )}

          {!loading && disputes.map(dispute => (
            <div key={dispute.id} onClick={() => setSelectedDispute(dispute)}
              style={{ background: 'white', borderRadius: 16, padding: 14, marginBottom: 10, boxShadow: '0 2px 8px rgba(0,0,0,0.05)', cursor: 'pointer', borderLeft: `4px solid ${dispute.status === 'open' ? '#E65100' : dispute.status === 'in_review' ? '#2196F3' : '#2E7D32'}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a1a' }}>
                    {DISPUTE_TYPES[dispute.dispute_type] || dispute.dispute_type}
                  </div>
                  <div style={{ fontSize: 12, color: '#888' }}>
                    {dispute.title} · {dispute.bookings?.booking_ref}
                  </div>
                </div>
                <div style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: dispute.status === 'open' ? '#FFF3E0' : dispute.status === 'in_review' ? '#E3F2FD' : '#E8F5E9', color: dispute.status === 'open' ? '#E65100' : dispute.status === 'in_review' ? '#1565C0' : '#2E7D32', fontWeight: 600 }}>
                  {dispute.status}
                </div>
              </div>
              <div style={{ fontSize: 11, color: '#AAA' }}>{new Date(dispute.created_at).toLocaleDateString('en-IN')}</div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
