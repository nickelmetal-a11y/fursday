import React, { useState } from 'react';
import { supabase } from './supabase';

export default function DisputeForm({ booking, sitterName, onClose, onDisputeFiled }) {
  const [disputeType, setDisputeType] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [filing, setFiling] = useState(false);

  const disputeTypes = [
    { id: 'refund_request', label: '💰 Refund Request', desc: 'Requesting a refund for this booking' },
    { id: 'quality_complaint', label: '⭐ Quality Issue', desc: 'Service quality did not meet expectations' },
    { id: 'payment_issue', label: '🏧 Payment Problem', desc: 'Charged incorrectly or payment error' },
    { id: 'no_show', label: '❌ No Show', desc: 'Sitter did not show up' },
    { id: 'safety_concern', label: '🚨 Safety Concern', desc: 'Safety or trust issue' },
  ];

  const fileDispute = async () => {
    if (!disputeType || !title || !description) {
      alert('Please fill in all fields');
      return;
    }
    setFiling(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error: disputeError } = await supabase
        .from('disputes')
        .insert({
          booking_id: booking.id,
          reported_user_id: booking.sitter_id,
          reported_by: user.id,
          dispute_type: disputeType,
          title,
          description,
          status: 'open',
          created_at: new Date().toISOString(),
        })
        .select()
        .single();
      if (disputeError) throw disputeError;

      // TIER 2: Send dispute filed notification to sitter
      try {
        const { data: sitterData } = await supabase
          .from('sitter_profiles')
          .select('users(id, name)')
          .eq('id', booking.sitter_id)
          .single();

        if (sitterData?.users) {
          const { data: contact } = await supabase.rpc('get_user_contact', { target_id: sitterData.users.id });
          const { notifyDisputeFiled } = await import('./notificationService');
          await notifyDisputeFiled(
            sitterData.users.id,
            contact?.[0]?.email,
            contact?.[0]?.phone,
            'Pet Parent',
            disputeType,
            title
          );
        }
      } catch(notifErr) { console.error('Dispute filed notification failed:', notifErr); }

      onDisputeFiled && onDisputeFiled();
      onClose();
      alert('Dispute filed successfully. Our team will review within 24 hours.');
    } catch (error) {
      alert('Error filing dispute: ' + error.message);
    }
    setFiling(false);
  };

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:1001, display:'flex', alignItems:'flex-end', justifyContent:'center' }}>
      <div style={{ background:'white', borderRadius:'24px 24px 0 0', padding:'24px 20px 40px', width:'100%', maxWidth:390 }}>
        <div style={{ fontSize:16, fontWeight:700, color:'#1a1a1a', marginBottom:6 }}>File Dispute with {sitterName}</div>
        <div style={{ fontSize:13, color:'#888', marginBottom:16 }}>Formal disputes are reviewed by our team within 24 hours.</div>

        <div style={{ marginBottom:12 }}>
          <div style={{ fontSize:12, fontWeight:600, color:'#555', marginBottom:6 }}>Dispute Type</div>
          {disputeTypes.map(dt => (
            <div key={dt.id} onClick={() => setDisputeType(dt.id)}
              style={{ padding:'12px 14px', borderRadius:12, border:disputeType===dt.id?'2px solid #FF6B35':'1.5px solid #E0E0E0', background:disputeType===dt.id?'#FFF0EB':'white', marginBottom:8, fontSize:13, cursor:'pointer', fontWeight:disputeType===dt.id?600:400, color:disputeType===dt.id?'#FF6B35':'#1a1a1a' }}>
              {dt.label}
              <div style={{ fontSize:11, color:'#888', fontWeight:400, marginTop:2 }}>{dt.desc}</div>
            </div>
          ))}
        </div>

        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Brief title of issue"
          style={{ width:'100%', padding:'12px 14px', borderRadius:12, border:'1.5px solid #E0E0E0', fontSize:13, marginBottom:12, boxSizing:'border-box', outline:'none', fontFamily:'inherit' }} />

        <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Describe what happened..."
          style={{ width:'100%', padding:'12px 14px', borderRadius:12, border:'1.5px solid #E0E0E0', fontSize:13, marginBottom:12, minHeight:80, boxSizing:'border-box', outline:'none', fontFamily:'inherit', resize:'none' }} />

        <div style={{ display:'flex', gap:8 }}>
          <button onClick={onClose}
            style={{ flex:1, padding:'12px 0', borderRadius:12, border:'1.5px solid #E0E0E0', background:'white', color:'#888', fontSize:13, fontWeight:600, cursor:'pointer' }}>
            Cancel
          </button>
          <button onClick={fileDispute} disabled={filing}
            style={{ flex:1, padding:'12px 0', borderRadius:12, border:'none', background:'#FF6B35', color:'white', fontSize:13, fontWeight:600, cursor:filing?'not-allowed':'pointer', opacity:filing?0.7:1 }}>
            {filing ? 'Filing...' : 'File Dispute'}
          </button>
        </div>
      </div>
    </div>
  );
}
