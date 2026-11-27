import React from 'react';
import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { useLanguage } from './i18n';
import { moneyCaptured, moneyLine } from './paymentsClient';
import { color, font, radius, ui } from './theme';
import Icon from './ui/Icon';

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
  const paid = moneyCaptured(booking);
  const sitterName = sitter.name || sitter.users?.name || tr('receiptModal_sitterFallback');
  const money = moneyLine(booking, tr, sitterName);
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

  const row = { display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 8 };
  const value = { fontWeight: 600, color: color.ink, textAlign: 'right' };
  const eyebrow = { color: color.muted, fontSize: font.xs, marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 };
  const divider = `1px dashed ${color.line}`;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(21,25,42,0.5)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 1000, fontFamily: font.family }}>
      <div role="dialog" aria-modal="true" style={{ background: color.surface, borderRadius: '20px 20px 0 0', maxWidth: 480, width: '100%', maxHeight: '90vh', overflow: 'auto', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '16px 20px', borderBottom: `1px solid ${color.line}`, position: 'sticky', top: 0, background: color.surface, zIndex: 1 }}>
          <div style={{ fontSize: font.lg + 2, fontWeight: 700, color: color.ink }}>{tr('receiptModal_title')}</div>
          <button type="button" onClick={onClose} aria-label={tr('common_close')}
            style={{ width: 36, height: 36, borderRadius: radius.pill, border: 'none', background: color.tile, color: color.text, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0, flexShrink: 0 }}>
            <Icon name="plus" size={20} style={{ transform: 'rotate(45deg)' }} />
          </button>
        </div>

        <div id="receipt-content" style={{ padding: '24px 20px', fontFamily: font.family, fontSize: 13, lineHeight: 1.7, color: color.text, fontVariantNumeric: 'tabular-nums' }}>
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: font.xl, fontWeight: 700, color: color.navy, marginBottom: 4 }}>
              <Icon name="paw" size={22} color={color.navy} />Fursday
            </div>
            <div style={{ fontSize: font.sm, color: color.muted }}>{tr('receiptModal_subtitle')}</div>
          </div>

          {/* Receipt Number */}
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 20, borderBottom: divider, paddingBottom: 16 }}>
            <div>
              <div style={{ color: color.muted, fontSize: font.xs, marginBottom: 2 }}>{tr('receiptModal_receiptNo')}</div>
              <div style={{ fontWeight: 600, color: color.ink }}>{booking.booking_ref}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ color: color.muted, fontSize: font.xs, marginBottom: 2 }}>{tr('receiptModal_date')}</div>
              <div style={{ fontWeight: 600, color: color.ink }}>{completedDate.toLocaleDateString(locale)}</div>
            </div>
          </div>

          {/* Service Details */}
          <div style={{ marginBottom: 20 }}>
            <div style={eyebrow}>{tr('receiptModal_serviceDetails')}</div>
            <div style={row}>
              <span>{tr('receiptModal_serviceType')}</span>
              <span style={value}>{serviceName}</span>
            </div>
            <div style={row}>
              <span>{tr('receiptModal_serviceDate')}</span>
              <span style={value}>{bookingDate.toLocaleDateString(locale)}</span>
            </div>
            <div style={row}>
              <span>{tr('receiptModal_pet')}</span>
              <span style={value}>{pet.name} ({pet.breed || tr('receiptModal_dogFallback')})</span>
            </div>
            <div style={{ ...row, marginBottom: 0 }}>
              <span>{tr('receiptModal_sitter')}</span>
              <span style={value}>{sitterName}</span>
            </div>
          </div>

          {/* Pricing */}
          <div style={{ marginBottom: 20, borderTop: divider, borderBottom: divider, padding: '16px 0' }}>
            <div style={row}>
              <span>{tr('receiptModal_serviceCharge')}</span>
              <span style={{ color: color.ink }}>₹{amount}</span>
            </div>
            <div style={{ ...row, color: color.muted, fontSize: font.sm }}>
              <span>{tr('receiptModal_taxesFees')}</span>
              <span>₹0</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: font.lg, fontWeight: 700, color: color.ink }}>
              <span>{paid ? tr('receiptModal_totalPaid') : tr('receiptModal_total')}</span>
              <span>₹{amount}</span>
            </div>
          </div>

          {/* Payment Status */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ ...row, alignItems: 'center' }}>
              <span style={{ color: color.muted }}>{tr('receiptModal_paymentStatus')}</span>
              <span style={ui.badge(paid ? 'success' : 'warning')}>{paid ? tr('receiptModal_paid') : tr('receiptModal_unpaid')}</span>
            </div>
            <div style={{ ...row, alignItems: 'center', marginBottom: 0 }}>
              <span style={{ color: color.muted }}>{tr('receiptModal_bookingStatus')}</span>
              <span style={ui.badge('success')}>{tr('receiptModal_completed')}</span>
            </div>
            {money && <div style={{ marginTop: 8, fontSize: font.sm, color: color[money.tone], fontWeight: 600 }}>{money.text}</div>}
          </div>

          {/* Footer */}
          <div style={{ textAlign: 'center', color: color.muted, fontSize: font.xs, borderTop: divider, paddingTop: 16 }}>
            <div>{tr('receiptModal_thanks')}</div>
            <div style={{ marginTop: 6 }}>{tr('receiptModal_confirmsCompleted')}</div>
            <div style={{ marginTop: 10, color: color.faint }}>support@fursday.in | www.fursday.in</div>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: 8, padding: '12px 20px calc(12px + env(safe-area-inset-bottom))', borderTop: `1px solid ${color.line}`, background: color.surface, position: 'sticky', bottom: 0 }}>
          {isNative ? (
            <button type="button" onClick={handleShare} style={{ ...ui.primaryButton, flex: 1 }}>
              <Icon name="share" size={18} />
              {tr('receiptModal_share')}
            </button>
          ) : (<>
            <button type="button" onClick={handlePrint} style={{ ...ui.secondaryButton, flex: 1 }}>
              <Icon name="printer" size={18} />
              {tr('receiptModal_print')}
            </button>
            <button type="button" onClick={handleDownload} style={{ ...ui.primaryButton, flex: 1 }}>
              <Icon name="download" size={18} />
              {tr('receiptModal_download')}
            </button>
          </>)}
        </div>
      </div>
    </div>
  );
}
