// SMS notification service using MSG91 API
// Setup: Add REACT_APP_MSG91_AUTH_KEY and REACT_APP_MSG91_ROUTE to .env

const MSG91_AUTH_KEY = process.env.REACT_APP_MSG91_AUTH_KEY;
const MSG91_ROUTE = process.env.REACT_APP_MSG91_ROUTE || '4'; // 4 = Transactional, 1 = Promotional

// Helper to format phone for MSG91 (91-XXXXXXXXXX for India)
const formatPhoneForMSG91 = (phone) => {
  let p = phone.replace(/\D/g, '');
  if (!p.startsWith('91')) p = '91' + p;
  return p;
};

export const sendBookingReminderSMS = async (phone, bookingDetails) => {
  const { sitterName, petName, dateTime } = bookingDetails;
  const message = `Hi! Your walk with ${sitterName} and ${petName} is scheduled for ${dateTime}. Get ready! 🐾 -Fursday`;
  return sendSMS(phone, message);
};

export const sendWalkStartingSoonSMS = async (phone, minutesUntilStart) => {
  const message = `Your walk starts in ${minutesUntilStart} minutes! Your sitter is on the way. 🐕 -Fursday`;
  return sendSMS(phone, message);
};

export const sendPayoutNotificationSMS = async (phone, amount) => {
  const message = `Great news! Your payout of Rs. ${amount} has been marked paid. Check your bank account! 💳 -Fursday`;
  return sendSMS(phone, message);
};

export const sendPhotosUploadedSMS = async (phone, sitterName) => {
  const message = `${sitterName} uploaded walk photos! Check the app to view proof of service. 📸 -Fursday`;
  return sendSMS(phone, message);
};

export const sendDisputeResolutionSMS = async (phone, resolution) => {
  const message = `Your dispute has been resolved. ${resolution}. Check the app for details. -Fursday`;
  return sendSMS(phone, message);
};

// Core SMS send function
async function sendSMS(phoneNumber, message) {
  if (!MSG91_AUTH_KEY) {
    console.warn('MSG91 API key not configured. SMS not sent:', { phoneNumber, message });
    return false;
  }

  try {
    const formattedPhone = formatPhoneForMSG91(phoneNumber);

    const url = new URL('https://api.msg91.com/apiv2/sendsms');
    url.searchParams.append('authkey', MSG91_AUTH_KEY);
    url.searchParams.append('mobiles', formattedPhone);
    url.searchParams.append('message', message);
    url.searchParams.append('route', MSG91_ROUTE);
    url.searchParams.append('sender', 'FURSDY'); // 6-char sender ID

    const response = await fetch(url.toString(), { method: 'GET' });
    const result = await response.json();

    if (result.type === 'success') {
      console.log('SMS sent to:', phoneNumber);
      return true;
    } else {
      console.error('MSG91 error:', result);
      return false;
    }
  } catch (error) {
    console.error('SMS send failed:', error);
    return false;
  }
}

// Fallback: Log SMS in development
export const logSMSInDev = (phone, message) => {
  if (process.env.NODE_ENV === 'development') {
    console.log('[SMS]', { phone, message });
  }
};
