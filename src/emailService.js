// Email notification service using SendGrid or standard fetch
// Setup: Add REACT_APP_SENDGRID_KEY or REACT_APP_EMAIL_API_KEY to .env

const SENDGRID_KEY = process.env.REACT_APP_SENDGRID_KEY;
const EMAIL_FROM = 'support@fursday.app';
const EMAIL_DOMAIN = 'https://fursday.vercel.app';

export const sendBookingConfirmationEmail = async (email, bookingDetails) => {
  const { bookingRef, sitterName, petName, serviceType, dateTime, amount, cancellationDeadline } = bookingDetails;

  const htmlContent = `
    <div style="font-family: sans-serif; background: #F8F8F8; padding: 20px;">
      <div style="max-width: 500px; margin: 0 auto; background: white; borderRadius: '12px'; padding: 24px;">
        <h2 style="color: #FF6B35; margin-top: 0;">Booking Confirmed! 🎉</h2>
        <p>Hi ${petName}'s parent,</p>
        <p>Your walk booking has been confirmed. Here are the details:</p>

        <div style="background: #FFF0EB; padding: 16px; borderRadius: '8px'; margin: 16px 0;">
          <p style="margin: 8px 0;"><strong>Booking Ref:</strong> ${bookingRef}</p>
          <p style="margin: 8px 0;"><strong>Sitter:</strong> ${sitterName}</p>
          <p style="margin: 8px 0;"><strong>Pet:</strong> ${petName}</p>
          <p style="margin: 8px 0;"><strong>Service:</strong> ${serviceType}</p>
          <p style="margin: 8px 0;"><strong>Date & Time:</strong> ${dateTime}</p>
          <p style="margin: 8px 0;"><strong>Amount:</strong> Rs. ${amount}</p>
        </div>

        <p style="color: #E65100; font-weight: 600;">Free cancellation until: ${cancellationDeadline}</p>

        <div style="margin: 24px 0;">
          <a href="${EMAIL_DOMAIN}" style="background: #FF6B35; color: white; padding: 12px 24px; textDecoration: 'none'; borderRadius: '8px'; display: 'inline-block'>View Booking</a>
        </div>

        <p style="color: #888; font-size: 12px;">Questions? Contact us at ${EMAIL_FROM}</p>
      </div>
    </div>
  `;

  return sendEmail(email, 'Booking Confirmed - ' + bookingRef, htmlContent);
};

export const sendReviewReceivedEmail = async (email, reviewDetails) => {
  const { sitterName, rating, petName, reviewText } = reviewDetails;
  const stars = '⭐'.repeat(rating);

  const htmlContent = `
    <div style="font-family: sans-serif; background: #F8F8F8; padding: 20px;">
      <div style="max-width: 500px; margin: 0 auto; background: white; borderRadius: '12px'; padding: 24px;">
        <h2 style="color: #6C5CE7; margin-top: 0;">You received a review! ${stars}</h2>
        <p>Hi ${sitterName},</p>
        <p>${petName}'s parent left you a review:</p>

        <div style="background: #F0EEFF; padding: 16px; borderRadius: '8px'; margin: 16px 0;">
          <p style="margin: 8px 0;"><strong>${petName}'s parent:</strong></p>
          <p>"${reviewText}"</p>
        </div>

        <p>Great work keeping ${petName} safe and happy! 🐾</p>

        <div style="margin: 24px 0;">
          <a href="${EMAIL_DOMAIN}" style="background: #6C5CE7; color: white; padding: 12px 24px; textDecoration: 'none'; borderRadius: '8px'; display: 'inline-block'>View Profile</a>
        </div>
      </div>
    </div>
  `;

  return sendEmail(email, 'New review from ' + petName, htmlContent);
};

export const sendPayoutNotificationEmail = async (email, payoutDetails) => {
  const { sitterName, amount, bookingCount, payoutDate } = payoutDetails;

  const htmlContent = `
    <div style="font-family: sans-serif; background: #F8F8F8; padding: 20px;">
      <div style="max-width: 500px; margin: 0 auto; background: white; borderRadius: '12px'; padding: 24px;">
        <h2 style="color: #2E7D32; margin-top: 0;">Payout Processed 💳</h2>
        <p>Hi ${sitterName},</p>
        <p>Your payout has been marked complete!</p>

        <div style="background: #E8F5E9; padding: 16px; borderRadius: '8px'; margin: 16px 0;">
          <p style="margin: 8px 0;"><strong>Amount:</strong> Rs. ${amount}</p>
          <p style="margin: 8px 0;"><strong>Bookings:</strong> ${bookingCount} walks</p>
          <p style="margin: 8px 0;"><strong>Payout Date:</strong> ${payoutDate}</p>
        </div>

        <p>Check your bank account for the transfer. You're crushing it! 🌟</p>
      </div>
    </div>
  `;

  return sendEmail(email, 'Your payout is ready', htmlContent);
};

export const sendCancellationEmail = async (email, cancellationDetails) => {
  const { bookingRef, reason, refundAmount, refundStatus } = cancellationDetails;

  const htmlContent = `
    <div style="font-family: sans-serif; background: #F8F8F8; padding: 20px;">
      <div style="max-width: 500px; margin: 0 auto; background: white; borderRadius: '12px'; padding: 24px;">
        <h2 style="color: #E65100; margin-top: 0;">Booking Cancelled</h2>
        <p>Your booking ${bookingRef} has been cancelled.</p>

        <div style="background: #FFF3E0; padding: 16px; borderRadius: '8px'; margin: 16px 0;">
          <p style="margin: 8px 0;"><strong>Refund Amount:</strong> Rs. ${refundAmount}</p>
          <p style="margin: 8px 0;"><strong>Status:</strong> ${refundStatus}</p>
          <p style="margin: 8px 0;"><strong>Reason:</strong> ${reason}</p>
        </div>

        <p>The refund will be credited within 3-5 business days.</p>

        <div style="margin: 24px 0;">
          <a href="${EMAIL_DOMAIN}" style="background: #FF6B35; color: white; padding: 12px 24px; textDecoration: 'none'; borderRadius: '8px'; display: 'inline-block'>Book Another Walk</a>
        </div>
      </div>
    </div>
  `;

  return sendEmail(email, 'Booking Cancelled - Refund: Rs.' + refundAmount, htmlContent);
};

// Core send function
async function sendEmail(to, subject, htmlContent) {
  if (!SENDGRID_KEY) {
    console.warn('SendGrid key not configured. Email not sent:', { to, subject });
    return false;
  }

  try {
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + SENDGRID_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{
          to: [{ email: to }],
          subject: subject,
        }],
        from: { email: EMAIL_FROM, name: 'Fursday' },
        content: [{
          type: 'text/html',
          value: htmlContent,
        }],
      }),
    });

    if (response.ok) {
      console.log('Email sent to:', to);
      return true;
    } else {
      console.error('SendGrid error:', response.status, response.statusText);
      return false;
    }
  } catch (error) {
    console.error('Email send failed:', error);
    return false;
  }
}

// Fallback: Log emails in development
export const logEmailInDev = (to, subject, content) => {
  if (process.env.NODE_ENV === 'development') {
    console.log('[EMAIL]', { to, subject, preview: content.substring(0, 100) });
  }
};
