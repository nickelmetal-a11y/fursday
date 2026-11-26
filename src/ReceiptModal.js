import React from 'react';
import { X, Download, Printer, Share2 } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { useLanguage } from './i18n';

const SERVICE_NAMES = {
  walk30: 'receiptModal_svcWalk30',
  boarding: 'receiptModal_svcBoarding',
  daycare: 'receiptModal_svcDaycare',
  dropin: 'receiptModal_svcDropin',
  housesit: 'receiptModal_svcHousesit',
};

export default function ReceiptModal({ booking, sitter, pet, onClose }) {
  const { t: tr, lang } = useLanguage();
  if (!booking || !sitter || !pet) return null;

  const locale = lang === 'hi' ? 'hi-IN' : undefined;
  const bookingDate = new Date(booking.booking_date);
  const completedDate = new Date(booking.completed_at || booking.created_at);
  const serviceName = SERVICE_NAMES[booking.service_type] ? tr(SERVICE_NAMES[booking.service_type]) : booking.service_type;
  const amount = Math.round((booking.gross_amount_paise || 0) / 100);
  const paid = booking.payment_status === 'paid';
  const sitterName = sitter.name || sitter.users?.name || tr('receiptModal_sitterFallback');
  const isNative = Capacitor.isNativePlatform();

  // Native WebViews ignore window.print() and <a download>, so the app shares a text receipt instead.
  const handleShare = () => Share.share({
    title: tr('receiptModal_shareTitle', { ref: booking.booking_ref }),
    text: [
      tr('receiptModal_shareRef', { ref: booking.booking_ref }),
      tr('receiptModal_shareService', { service: serviceName, date: bookingDate.toLocaleDateString(locale) }),
      tr('receiptModal_sharePet', { name: pet.name }),
      tr('receiptModal_shareSitter', { name: sitterName }),
      tr(paid ? 'receiptModal_shareTotalPaid' : 'receiptModal_shareTotalUnpaid', { amount }),
    ].join('\n'),
  }).catch(() => {});

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = () => {
    const element = document.getElementById('receipt-content');
    const html = element.innerHTML;
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fursday-receipt-${booking.booking_ref}.html`;
    a.click();
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
      <div style={{ background: 'white', borderRadius: 24, maxWidth: 500, width: '100%', maxHeight: '90vh', overflow: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid #F0F0F0', position: 'sticky', top: 0, background: 'white' }}>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{tr('receiptModal_title')}</div>
          <button type="button" onClick={onClose} aria-label={tr('common_close')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
            <X size={20} />
          </button>
        </div>

        <div id="receipt-content" style={{ padding: '32px 24px', fontFamily: 'monospace', fontSize: 13, lineHeight: 1.8 }}>
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>🐾 Fursday</div>
            <div style={{ fontSize: 12, color: '#888' }}>{tr('receiptModal_subtitle')}</div>
          </div>

          {/* Receipt Number */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24, borderBottom: '1px dashed #E0E0E0', paddingBottom: 16 }}>
            <div>
              <div style={{ color: '#888', fontSize: 11, marginBottom: 4 }}>{tr('receiptModal_receiptNo')}</div>
              <div style={{ fontWeight: 600 }}>{booking.booking_ref}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ color: '#888', fontSize: 11, marginBottom: 4 }}>{tr('receiptModal_date')}</div>
              <div style={{ fontWeight: 600 }}>{completedDate.toLocaleDateString(locale)}</div>
            </div>
          </div>

          {/* Service Details */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ color: '#888', fontSize: 11, marginBottom: 8, fontWeight: 600, textTransform: 'uppercase' }}>{tr('receiptModal_serviceDetails')}</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span>{tr('receiptModal_serviceType')}</span>
              <span style={{ fontWeight: 600 }}>{serviceName}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span>{tr('receiptModal_serviceDate')}</span>
              <span style={{ fontWeight: 600 }}>{bookingDate.toLocaleDateString(locale)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span>{tr('receiptModal_pet')}</span>
              <span style={{ fontWeight: 600 }}>{pet.name} ({pet.breed || tr('receiptModal_dogFallback')})</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>{tr('receiptModal_sitter')}</span>
              <span style={{ fontWeight: 600 }}>{sitterName}</span>
            </div>
          </div>

          {/* Pricing */}
          <div style={{ marginBottom: 24, borderTop: '1px dashed #E0E0E0', borderBottom: '1px dashed #E0E0E0', padding: '16px 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span>{tr('receiptModal_serviceCharge')}</span>
              <span>₹{amount}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, color: '#888', fontSize: 12 }}>
              <span>{tr('receiptModal_taxesFees')}</span>
              <span>₹0</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16, fontWeight: 700 }}>
              <span>{paid ? tr('receiptModal_totalPaid') : tr('receiptModal_total')}</span>
              <span>₹{amount}</span>
            </div>
          </div>

          {/* Payment Status */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ color: '#888' }}>{tr('receiptModal_paymentStatus')}</span>
              <span style={{ color: paid ? '#2E7D32' : '#E65100', fontWeight: 600 }}>{paid ? tr('receiptModal_paid') : tr('receiptModal_unpaid')}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#888' }}>{tr('receiptModal_bookingStatus')}</span>
              <span style={{ color: '#2E7D32', fontWeight: 600 }}>{tr('receiptModal_completed')}</span>
            </div>
          </div>

          {/* Footer */}
          <div style={{ textAlign: 'center', color: '#888', fontSize: 11, borderTop: '1px dashed #E0E0E0', paddingTop: 16 }}>
            <div>{tr('receiptModal_thanks')}</div>
            <div style={{ marginTop: 8 }}>{tr('receiptModal_confirmsCompleted')}</div>
            <div style={{ marginTop: 12, fontSize: 10 }}>support@fursday.in | www.fursday.in</div>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: 8, padding: '20px 24px', borderTop: '1px solid #F0F0F0', background: '#F8F8F8', position: 'sticky', bottom: 0 }}>
          {isNative ? (
            <button type="button" onClick={handleShare}
              style={{ flex: 1, padding: '12px 0', borderRadius: 12, border: 'none', background: '#FF6B35', color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <Share2 size={16} />
              {tr('receiptModal_share')}
            </button>
          ) : (<>
            <button type="button" onClick={handlePrint}
              style={{ flex: 1, padding: '12px 0', borderRadius: 12, border: 'none', background: 'white', color: '#1a1a1a', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <Printer size={16} />
              {tr('receiptModal_print')}
            </button>
            <button type="button" onClick={handleDownload}
              style={{ flex: 1, padding: '12px 0', borderRadius: 12, border: 'none', background: '#FF6B35', color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <Download size={16} />
              {tr('receiptModal_download')}
            </button>
          </>)}
        </div>
      </div>
    </div>
  );
}
