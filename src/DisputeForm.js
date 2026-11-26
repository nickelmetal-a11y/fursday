import React, { useState } from 'react';
import { supabase } from './supabase';
import { useLanguage } from './i18n';
import { color, font, radius, ui } from './theme';
import Icon from './ui/Icon';

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
    <div style={{ position:'fixed', inset:0, background:'rgba(21,25,42,0.5)', zIndex:1001, display:'flex', alignItems:'flex-end', justifyContent:'center', fontFamily:font.family }}>
      <div role="dialog" aria-modal="true" style={{ background:color.surface, borderRadius:'20px 20px 0 0', padding:'20px 20px calc(20px + env(safe-area-inset-bottom))', width:'100%', maxWidth:480, boxSizing:'border-box', maxHeight:'90vh', overflowY:'auto' }}>
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:12, marginBottom:4 }}>
          <div style={{ fontSize:font.lg, fontWeight:700, color:color.ink, paddingTop:6 }}>{tr('disputeForm_titleWithSitter', { name: otherName || sitterName })}</div>
          <button type="button" onClick={onClose} aria-label={tr('common_close')}
            style={{ width:36, height:36, borderRadius:radius.pill, border:'none', background:color.tile, color:color.text, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', padding:0, flexShrink:0 }}>
            <Icon name="plus" size={20} style={{ transform:'rotate(45deg)' }} />
          </button>
        </div>
        <div style={{ fontSize:13, color:color.muted, marginBottom:16 }}>{tr('disputeForm_subIntro')}</div>

        <div style={{ marginBottom:12 }}>
          <div style={ui.label}>{tr('disputeForm_typeLabel')}</div>
          {disputeTypes.map(dt => {
            const on = disputeType === dt.id;
            return (
              <button type="button" key={dt.id} onClick={() => setDisputeType(dt.id)} aria-pressed={on}
                style={{ display:'block', width:'100%', minHeight:48, textAlign:'left', fontFamily:'inherit', padding:'10px 14px', borderRadius:radius.md, border:`1px solid ${on ? color.navy : color.line}`, boxShadow:on ? `inset 0 0 0 1px ${color.navy}` : 'none', background:on ? color.navySoft : color.surface, marginBottom:8, fontSize:14, cursor:'pointer', fontWeight:600, color:on ? color.navy : color.ink }}>
                {dt.label}
                <span style={{ display:'block', fontSize:font.sm, color:color.muted, fontWeight:400, marginTop:2 }}>{dt.desc}</span>
              </button>
            );
          })}
        </div>

        <input value={title} onChange={e => setTitle(e.target.value)} placeholder={tr('disputeForm_titlePlaceholder')} aria-label={tr('disputeForm_titlePlaceholder')}
          style={{ ...ui.input, fontSize:14, marginBottom:10 }} />

        <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder={tr('disputeForm_descriptionPlaceholder')} aria-label={tr('disputeForm_descriptionPlaceholder')}
          style={{ ...ui.input, fontSize:14, marginBottom:14, minHeight:96, lineHeight:1.5, resize:'none' }} />

        <div style={{ display:'flex', gap:8 }}>
          <button type="button" onClick={onClose} style={{ ...ui.secondaryButton, flex:1, color:color.muted }}>
            {tr('common_cancel')}
          </button>
          <button type="button" onClick={fileDispute} disabled={filing}
            style={{ ...ui.primaryButton, flex:2, cursor:filing?'not-allowed':'pointer', opacity:filing?0.7:1 }}>
            {filing ? tr('disputeForm_filing') : tr('disputeForm_fileDisputeButton')}
          </button>
        </div>
      </div>
    </div>
  );
}
