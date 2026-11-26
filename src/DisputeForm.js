import React, { useState } from 'react';
import { supabase } from './supabase';
import { useLanguage } from './i18n';


// reporterRole 'parent' files against the booking's sitter; 'sitter' files
// against the pet parent. reported_user_id is always a real users.id.
export default function DisputeForm({ booking, sitterName, otherName, reporterRole = 'parent', onClose, onDisputeFiled }) {
  const { t: tr } = useLanguage();
  const [disputeType, setDisputeType] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [filing, setFiling] = useState(false);

  const disputeTypes = [
    { id: 'refund_request', label: tr('disputeForm_refundRequestLabel'), desc: tr('disputeForm_refundRequestDesc') },
    { id: 'quality_complaint', label: tr('disputeForm_qualityIssueLabel'), desc: tr('disputeForm_qualityIssueDesc') },
    { id: 'payment_issue', label: tr('disputeForm_paymentProblemLabel'), desc: tr('disputeForm_paymentProblemDesc') },
    { id: 'no_show', label: tr('disputeForm_noShowLabel'), desc: tr('disputeForm_noShowDesc') },
    { id: 'safety_concern', label: tr('disputeForm_safetyConcernLabel'), desc: tr('disputeForm_safetyConcernDesc') },
  ];

  const fileDispute = async () => {
    if (!disputeType || !title || !description) {
      alert(tr('disputeForm_fillAllFieldsAlert'));
      return;
    }
    setFiling(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let reportedUserId = booking.pet_parent_id;
      if (reporterRole === 'parent') {
        const { data: sp } = await supabase.from('sitter_profiles').select('user_id').eq('id', booking.sitter_id).single();
        reportedUserId = sp?.user_id;
      }
      if (!reportedUserId) throw new Error(tr('disputeForm_otherPartyNotFound'));

      const { error: disputeError } = await supabase
        .from('disputes')
        .insert({
          booking_id: booking.id,
          reported_user_id: reportedUserId,
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

      try {
        const { data: contact } = await supabase.rpc('get_user_contact', { target_id: reportedUserId });
        const { notifyDisputeFiled } = await import('./notificationService');
        await notifyDisputeFiled(reportedUserId, contact?.[0]?.email, contact?.[0]?.phone,
          reporterRole === 'sitter' ? 'Sitter' : 'Pet Parent', disputeType, title);
      } catch(notifErr) { console.error('Dispute filed notification failed:', notifErr); }

      onDisputeFiled && onDisputeFiled();
      onClose();
      alert(tr('disputeForm_filedSuccessAlert'));
    } catch (error) {
      alert(tr('disputeForm_fileErrorPrefix') + error.message);
    }
    setFiling(false);
  };

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:1001, display:'flex', alignItems:'flex-end', justifyContent:'center' }}>
      <div style={{ background:'white', borderRadius:'24px 24px 0 0', padding:'24px 20px 40px', width:'100%', maxWidth:390 }}>
        <div style={{ fontSize:16, fontWeight:700, color:'#1a1a1a', marginBottom:6 }}>{tr('disputeForm_titleWithSitter', { name: otherName || sitterName })}</div>
        <div style={{ fontSize:13, color:'#888', marginBottom:16 }}>{tr('disputeForm_subIntro')}</div>

        <div style={{ marginBottom:12 }}>
          <div style={{ fontSize:12, fontWeight:600, color:'#555', marginBottom:6 }}>{tr('disputeForm_typeLabel')}</div>
          {disputeTypes.map(dt => (
            <button type="button" key={dt.id} onClick={() => setDisputeType(dt.id)} aria-pressed={disputeType===dt.id}
              style={{ display:'block', width:'100%', textAlign:'left', fontFamily:'inherit', padding:'12px 14px', borderRadius:12, border:disputeType===dt.id?'2px solid #FF6B35':'1.5px solid #E0E0E0', background:disputeType===dt.id?'#FFF0EB':'white', marginBottom:8, fontSize:13, cursor:'pointer', fontWeight:disputeType===dt.id?600:400, color:disputeType===dt.id?'#FF6B35':'#1a1a1a' }}>
              {dt.label}
              <span style={{ display:'block', fontSize:11, color:'#888', fontWeight:400, marginTop:2 }}>{dt.desc}</span>
            </button>
          ))}
        </div>

        <input value={title} onChange={e => setTitle(e.target.value)} placeholder={tr('disputeForm_titlePlaceholder')} aria-label={tr('disputeForm_titlePlaceholder')}
          style={{ width:'100%', padding:'12px 14px', borderRadius:12, border:'1.5px solid #E0E0E0', fontSize:13, marginBottom:12, boxSizing:'border-box', outline:'none', fontFamily:'inherit' }} />

        <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder={tr('disputeForm_descriptionPlaceholder')} aria-label={tr('disputeForm_descriptionPlaceholder')}
          style={{ width:'100%', padding:'12px 14px', borderRadius:12, border:'1.5px solid #E0E0E0', fontSize:13, marginBottom:12, minHeight:80, boxSizing:'border-box', outline:'none', fontFamily:'inherit', resize:'none' }} />

        <div style={{ display:'flex', gap:8 }}>
          <button onClick={onClose}
            style={{ flex:1, padding:'12px 0', borderRadius:12, border:'1.5px solid #E0E0E0', background:'white', color:'#888', fontSize:13, fontWeight:600, cursor:'pointer' }}>
            {tr('common_cancel')}
          </button>
          <button onClick={fileDispute} disabled={filing}
            style={{ flex:1, padding:'12px 0', borderRadius:12, border:'none', background:'#FF6B35', color:'white', fontSize:13, fontWeight:600, cursor:filing?'not-allowed':'pointer', opacity:filing?0.7:1 }}>
            {filing ? tr('disputeForm_filing') : tr('disputeForm_fileDisputeButton')}
          </button>
        </div>
      </div>
    </div>
  );
}
