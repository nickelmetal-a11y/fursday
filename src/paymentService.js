// Multi-payment integration service
// Supports: Razorpay, Apple Pay, Google Pay, UPI, Bank Transfer

const RAZORPAY_KEY = 'rzp_test_T7V79a2d0jgcQW';
const PAYPAL_CLIENT_ID = process.env.REACT_APP_PAYPAL_CLIENT_ID || 'test-client-id';

export const PAYMENT_METHODS = {
  RAZORPAY: 'razorpay',
  APPLE_PAY: 'apple_pay',
  GOOGLE_PAY: 'google_pay',
  UPI: 'upi',
  BANK_TRANSFER: 'bank_transfer',
  PAYPAL: 'paypal',
};

export const PAYMENT_METHOD_CONFIG = {
  [PAYMENT_METHODS.RAZORPAY]: {
    label: 'Credit / Debit Card & UPI',
    emoji: '💳',
    description: 'Visa, Mastercard, RuPay, UPI',
    enabled: true,
    priority: 1,
  },
  [PAYMENT_METHODS.APPLE_PAY]: {
    label: 'Apple Pay',
    emoji: '🍎',
    description: 'Fast & secure payment',
    enabled: true,
    priority: 2,
    requiresAppleSupport: true,
  },
  [PAYMENT_METHODS.GOOGLE_PAY]: {
    label: 'Google Pay',
    emoji: '🔵',
    description: 'Contactless payment',
    enabled: true,
    priority: 3,
    requiresGoogleSupport: true,
  },
  [PAYMENT_METHODS.UPI]: {
    label: 'Direct UPI',
    emoji: '📱',
    description: 'GPay, PhonePe, Paytm',
    enabled: true,
    priority: 4,
  },
  [PAYMENT_METHODS.BANK_TRANSFER]: {
    label: 'Bank Transfer',
    emoji: '🏦',
    description: 'Direct account transfer',
    enabled: true,
    priority: 5,
  },
};

// Initialize Razorpay
export const initializeRazorpay = () => {
  return new Promise((resolve) => {
    if (window.Razorpay) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => resolve();
    document.body.appendChild(script);
  });
};

// Check if Apple Pay is available
export const isApplePayAvailable = async () => {
  try {
    if (window.ApplePaySession) {
      const supported = window.ApplePaySession.canMakePayments();
      return supported && window.ApplePaySession.canMakePaymentsWithActiveCard('merchant.fursday.petcare');
    }
    return false;
  } catch (e) {
    return false;
  }
};

// Check if Google Pay is available
export const isGooglePayAvailable = async () => {
  try {
    if (!window.google?.payments?.api) {
      return false;
    }
    const paymentsClient = new google.payments.api.PaymentsClient({
      environment: 'TEST',
    });
    const isReadyToPayRequest = {
      apiVersion: 2,
      apiVersionMinor: 0,
      allowedPaymentMethods: [
        {
          type: 'CARD',
          parameters: {
            allowedCardNetworks: ['VISA', 'MASTERCARD'],
            allowedAuthMethods: ['PAN_ONLY', 'CRYPTOGRAM_3DS'],
          },
        },
      ],
    };
    const result = await paymentsClient.isReadyToPay(isReadyToPayRequest);
    return result.result;
  } catch (e) {
    return false;
  }
};

// Process Razorpay payment
export const processRazorpayPayment = async (paymentDetails) => {
  await initializeRazorpay();

  if (!window.Razorpay) {
    throw new Error('Razorpay failed to load');
  }

  return new Promise((resolve, reject) => {
    const options = {
      key: RAZORPAY_KEY,
      amount: paymentDetails.amount, // in paise
      currency: 'INR',
      name: 'Fursday',
      description: `${paymentDetails.service} - ${paymentDetails.bookingRef}`,
      image: 'https://fursday.vercel.app/favicon.ico',
      handler: (response) => {
        resolve({
          success: true,
          method: PAYMENT_METHODS.RAZORPAY,
          transactionId: response.razorpay_payment_id,
          orderId: response.razorpay_order_id,
          signature: response.razorpay_signature,
          timestamp: new Date().toISOString(),
        });
      },
      prefill: {
        name: paymentDetails.name || '',
        email: paymentDetails.email || '',
        contact: paymentDetails.phone || '',
      },
      notes: {
        booking_ref: paymentDetails.bookingRef,
        service: paymentDetails.service,
      },
      theme: {
        color: paymentDetails.themeColor || '#FF6B35',
      },
      modal: {
        ondismiss: () => {
          reject(new Error('Payment cancelled by user'));
        },
      },
    };

    try {
      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', (response) => {
        reject(new Error(response.error?.description || 'Payment failed'));
      });
      rzp.open();
    } catch (e) {
      reject(e);
    }
  });
};

// Process Bank Transfer
export const generateBankTransferDetails = (bookingRef, amount) => {
  return {
    method: PAYMENT_METHODS.BANK_TRANSFER,
    bankDetails: {
      accountName: 'Fursday Pet Care',
      accountNumber: '****XXXX**1234', // Masked for security
      ifscCode: 'SBIN0001234',
      bankName: 'State Bank of India',
      branch: 'Delhi NCR',
    },
    referenceId: bookingRef,
    amount: Math.round(amount / 100),
    instructions: [
      '1. Use booking reference as payment note',
      '2. Screenshot the transaction receipt',
      '3. Upload it in the app to confirm payment',
      '4. Booking will be confirmed within 2 hours',
    ],
    timeout: 3600000, // 1 hour to complete
  };
};

// Process UPI (via Razorpay UPI)
export const processUPIPayment = async (paymentDetails) => {
  // UPI is handled via Razorpay's UPI option
  // This is a convenience wrapper
  const modifiedDetails = {
    ...paymentDetails,
    preferredMethod: 'upi',
  };
  return processRazorpayPayment(modifiedDetails);
};

// Validate payment method availability
export const validatePaymentMethodAvailability = async (method) => {
  switch (method) {
    case PAYMENT_METHODS.APPLE_PAY:
      return isApplePayAvailable();
    case PAYMENT_METHODS.GOOGLE_PAY:
      return isGooglePayAvailable();
    case PAYMENT_METHODS.RAZORPAY:
    case PAYMENT_METHODS.UPI:
    case PAYMENT_METHODS.BANK_TRANSFER:
      return true;
    default:
      return false;
  }
};

// Get available payment methods for user
export const getAvailablePaymentMethods = async () => {
  const methods = [];

  for (const [key, config] of Object.entries(PAYMENT_METHOD_CONFIG)) {
    if (!config.enabled) continue;

    const isAvailable = await validatePaymentMethodAvailability(key);
    if (isAvailable) {
      methods.push({
        id: key,
        ...config,
      });
    }
  }

  return methods.sort((a, b) => a.priority - b.priority);
};

export default {
  PAYMENT_METHODS,
  PAYMENT_METHOD_CONFIG,
  initializeRazorpay,
  isApplePayAvailable,
  isGooglePayAvailable,
  processRazorpayPayment,
  generateBankTransferDetails,
  processUPIPayment,
  validatePaymentMethodAvailability,
  getAvailablePaymentMethods,
};
