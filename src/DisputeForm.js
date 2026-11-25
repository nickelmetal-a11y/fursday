import React, { useState } from 'react';
import { supabase } from './supabase';
import { useLanguage, registerTranslations } from './i18n';

registerTranslations({
  en: {
    disputeForm_refundRequestLabel: '💰 Refund Request',
    disputeForm_refundRequestDesc: 'Requesting a refund for this booking',
    disputeForm_qualityIssueLabel: '⭐ Quality Issue',
    disputeForm_qualityIssueDesc: 'Service quality did not meet expectations',
    disputeForm_paymentProblemLabel: '🏧 Payment Problem',
    disputeForm_paymentProblemDesc: 'Charged incorrectly or payment error',
    disputeForm_noShowLabel: '❌ No Show',
    disputeForm_noShowDesc: 'Sitter did not show up',
    disputeForm_safetyConcernLabel: '🚨 Safety Concern',
    disputeForm_safetyConcernDesc: 'Safety or trust issue',
    disputeForm_fillAllFieldsAlert: 'Please fill in all fields',
    disputeForm_filedSuccessAlert: 'Dispute filed successfully. Our team will review within 24 hours.',
    disputeForm_fileErrorPrefix: 'Error filing dispute: ',
    disputeForm_titleWithSitter: 'File Dispute with {name}',
    disputeForm_subIntro: 'Formal disputes are reviewed by our team within 24 hours.',
    disputeForm_typeLabel: 'Dispute Type',
    disputeForm_titlePlaceholder: 'Brief title of issue',
    disputeForm_descriptionPlaceholder: 'Describe what happened...',
    disputeForm_filing: 'Filing...',
    disputeForm_fileDisputeButton: 'File Dispute',
  },
  hi: {
    disputeForm_refundRequestLabel: '💰 रिफंड का अनुरोध',
    disputeForm_refundRequestDesc: 'इस बुकिंग के लिए रिफंड मांग रहे हैं',
    disputeForm_qualityIssueLabel: '⭐ क्वालिटी की समस्या',
    disputeForm_qualityIssueDesc: 'सेवा की क्वालिटी उम्मीद के मुताबिक नहीं थी',
    disputeForm_paymentProblemLabel: '🏧 भुगतान की समस्या',
    disputeForm_paymentProblemDesc: 'गलत पैसे कटे या भुगतान में त्रुटि हुई',
    disputeForm_noShowLabel: '❌ सिटर नहीं आया',
    disputeForm_noShowDesc: 'सिटर समय पर नहीं पहुंचा',
    disputeForm_safetyConcernLabel: '🚨 सुरक्षा से जुड़ी चिंता',
    disputeForm_safetyConcernDesc: 'सुरक्षा या भरोसे से जुड़ी समस्या',
    disputeForm_fillAllFieldsAlert: 'कृपया सभी फ़ील्ड भरें',
    disputeForm_filedSuccessAlert: 'विवाद सफलतापूर्वक दर्ज हुआ। हमारी टीम 24 घंटे के अंदर समीक्षा करेगी।',
    disputeForm_fileErrorPrefix: 'विवाद दर्ज करने में त्रुटि: ',
    disputeForm_titleWithSitter: '{name} के खिलाफ विवाद दर्ज करें',
    disputeForm_subIntro: 'औपचारिक विवादों की समीक्षा हमारी टीम 24 घंटे के अंदर करती है।',
    disputeForm_typeLabel: 'विवाद का प्रकार',
    disputeForm_titlePlaceholder: 'समस्या का संक्षिप्त शीर्षक',
    disputeForm_descriptionPlaceholder: 'क्या हुआ, बताएं...',
    disputeForm_filing: 'दर्ज हो रहा है...',
    disputeForm_fileDisputeButton: 'विवाद दर्ज करें',
  },
});

export default function DisputeForm({ booking, sitterName, onClose, onDisputeFiled }) {
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
      alert(tr('disputeForm_filedSuccessAlert'));
    } catch (error) {
      alert(tr('disputeForm_fileErrorPrefix') + error.message);
    }
    setFiling(false);
  };

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:1001, display:'flex', alignItems:'flex-end', justifyContent:'center' }}>
      <div style={{ background:'white', borderRadius:'24px 24px 0 0', padding:'24px 20px 40px', width:'100%', maxWidth:390 }}>
        <div style={{ fontSize:16, fontWeight:700, color:'#1a1a1a', marginBottom:6 }}>{tr('disputeForm_titleWithSitter', { name: sitterName })}</div>
        <div style={{ fontSize:13, color:'#888', marginBottom:16 }}>{tr('disputeForm_subIntro')}</div>

        <div style={{ marginBottom:12 }}>
          <div style={{ fontSize:12, fontWeight:600, color:'#555', marginBottom:6 }}>{tr('disputeForm_typeLabel')}</div>
          {disputeTypes.map(dt => (
            <div key={dt.id} onClick={() => setDisputeType(dt.id)}
              style={{ padding:'12px 14px', borderRadius:12, border:disputeType===dt.id?'2px solid #FF6B35':'1.5px solid #E0E0E0', background:disputeType===dt.id?'#FFF0EB':'white', marginBottom:8, fontSize:13, cursor:'pointer', fontWeight:disputeType===dt.id?600:400, color:disputeType===dt.id?'#FF6B35':'#1a1a1a' }}>
              {dt.label}
              <div style={{ fontSize:11, color:'#888', fontWeight:400, marginTop:2 }}>{dt.desc}</div>
            </div>
          ))}
        </div>

        <input value={title} onChange={e => setTitle(e.target.value)} placeholder={tr('disputeForm_titlePlaceholder')}
          style={{ width:'100%', padding:'12px 14px', borderRadius:12, border:'1.5px solid #E0E0E0', fontSize:13, marginBottom:12, boxSizing:'border-box', outline:'none', fontFamily:'inherit' }} />

        <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder={tr('disputeForm_descriptionPlaceholder')}
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
