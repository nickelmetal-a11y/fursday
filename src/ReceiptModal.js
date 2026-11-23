import React from 'react';
import { X, Download, Printer } from 'lucide-react';

const SERVICE_NAMES = {
  walk30: 'Dog Walking',
  boarding: 'Home Boarding',
  daycare: 'Doggy Daycare',
  dropin: 'Drop-in Visit',
  housesit: 'House Sitting',
};

export default function ReceiptModal({ booking, sitter, pet, onClose }) {
  if (!booking || !sitter || !pet) return null;

  const bookingDate = new Date(booking.booking_date);
  const completedDate = new Date(booking.completed_at || booking.created_at);
  const serviceName = SERVICE_NAMES[booking.service_type] || booking.service_type;

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
          <div style={{ fontSize: 18, fontWeight: 700 }}>Receipt</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
            <X size={20} />
          </button>
        </div>

        <div id="receipt-content" style={{ padding: '32px 24px', fontFamily: 'monospace', fontSize: 13, lineHeight: 1.8 }}>
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>🐾 Fursday</div>
            <div style={{ fontSize: 12, color: '#888' }}>Pet Care Receipt</div>
          </div>

          {/* Receipt Number */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24, borderBottom: '1px dashed #E0E0E0', paddingBottom: 16 }}>
            <div>
              <div style={{ color: '#888', fontSize: 11, marginBottom: 4 }}>Receipt #</div>
              <div style={{ fontWeight: 600 }}>{booking.booking_ref}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ color: '#888', fontSize: 11, marginBottom: 4 }}>Date</div>
              <div style={{ fontWeight: 600 }}>{completedDate.toLocaleDateString()}</div>
            </div>
          </div>

          {/* Service Details */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ color: '#888', fontSize: 11, marginBottom: 8, fontWeight: 600, textTransform: 'uppercase' }}>Service Details</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span>Service Type</span>
              <span style={{ fontWeight: 600 }}>{serviceName}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span>Service Date</span>
              <span style={{ fontWeight: 600 }}>{bookingDate.toLocaleDateString()}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span>Pet</span>
              <span style={{ fontWeight: 600 }}>{pet.name} ({pet.breed || 'Dog'})</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Sitter</span>
              <span style={{ fontWeight: 600 }}>{sitter.name || sitter.users?.name || 'Fursday Sitter'}</span>
            </div>
          </div>

          {/* Pricing */}
          <div style={{ marginBottom: 24, borderTop: '1px dashed #E0E0E0', borderBottom: '1px dashed #E0E0E0', padding: '16px 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span>Service Charge</span>
              <span>₹{booking.price || 0}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, color: '#888', fontSize: 12 }}>
              <span>Taxes & Fees</span>
              <span>₹0</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16, fontWeight: 700 }}>
              <span>Total Paid</span>
              <span>₹{booking.price || 0}</span>
            </div>
          </div>

          {/* Payment Status */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ color: '#888' }}>Payment Status</span>
              <span style={{ color: '#2E7D32', fontWeight: 600 }}>✓ Completed</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#888' }}>Booking Status</span>
              <span style={{ color: '#2E7D32', fontWeight: 600 }}>✓ Completed</span>
            </div>
          </div>

          {/* Footer */}
          <div style={{ textAlign: 'center', color: '#888', fontSize: 11, borderTop: '1px dashed #E0E0E0', paddingTop: 16 }}>
            <div>Thank you for using Fursday! 🐾</div>
            <div style={{ marginTop: 8 }}>This receipt confirms your pet care service has been completed.</div>
            <div style={{ marginTop: 12, fontSize: 10 }}>support@fursday.in | www.fursday.in</div>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: 8, padding: '20px 24px', borderTop: '1px solid #F0F0F0', background: '#F8F8F8', position: 'sticky', bottom: 0 }}>
          <button onClick={handlePrint}
            style={{ flex: 1, padding: '12px 0', borderRadius: 12, border: 'none', background: 'white', color: '#1a1a1a', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <Printer size={16} />
            Print
          </button>
          <button onClick={handleDownload}
            style={{ flex: 1, padding: '12px 0', borderRadius: 12, border: 'none', background: '#FF6B35', color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <Download size={16} />
            Download
          </button>
        </div>
      </div>
    </div>
  );
}
