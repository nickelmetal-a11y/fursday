// Subscription and loyalty program management

export const SUBSCRIPTION_TIERS = {
  FREE: 'free',
  BASIC: 'basic',
  PREMIUM: 'premium',
  VIP: 'vip',
};

export const SUBSCRIPTION_CONFIG = {
  [SUBSCRIPTION_TIERS.FREE]: {
    label: 'Free',
    monthlyPrice: 0,
    discount: 0,
    features: [
      'Book sitters',
      'View reviews',
      'In-app messaging',
      'Standard support',
    ],
    benefits: {},
  },
  [SUBSCRIPTION_TIERS.BASIC]: {
    label: 'Basic',
    monthlyPrice: 49,
    annualPrice: 490,
    discount: 10,
    features: [
      'All Free features',
      '10% discount on all bookings',
      'Priority sitter matching',
      'Email support',
      'Monthly points (100 pts)',
    ],
    benefits: {
      bookingDiscount: 0.10,
      points: 100,
      priorityMatching: true,
    },
  },
  [SUBSCRIPTION_TIERS.PREMIUM]: {
    label: 'Premium',
    monthlyPrice: 99,
    annualPrice: 990,
    discount: 20,
    features: [
      'All Basic features',
      '20% discount on all bookings',
      'Free cancellation (24h before)',
      'Dedicated support line',
      'Monthly points (250 pts)',
      'Exclusive sitters',
      'GPS tracking included',
    ],
    benefits: {
      bookingDiscount: 0.20,
      points: 250,
      freeCancellation: true,
      priorityMatching: true,
      gpsTracking: true,
      exclusiveSitters: true,
    },
  },
  [SUBSCRIPTION_TIERS.VIP]: {
    label: 'VIP',
    monthlyPrice: 199,
    annualPrice: 1990,
    discount: 30,
    features: [
      'All Premium features',
      '30% discount on all bookings',
      'Unlimited free cancellations',
      'Priority 24/7 phone support',
      'Monthly points (500 pts)',
      'VIP sitter access',
      'Concierge service',
      'Family plan (up to 5 pets)',
    ],
    benefits: {
      bookingDiscount: 0.30,
      points: 500,
      freeCancellation: true,
      priorityMatching: true,
      gpsTracking: true,
      exclusiveSitters: true,
      concierge: true,
      familyPlan: 5,
    },
  },
};

export const LOYALTY_POINTS_RULES = {
  BOOKING_COMPLETION: 10, // 1 point per Rs. 100 spent
  REVIEW_SUBMISSION: 25,
  REFERRAL_REWARD: 100,
  BIRTHDAY_BONUS: 50,
  ANNIVERSARY_BONUS: 100,
  POINTS_EXPIRY_DAYS: 365, // 1 year
};

export const POINTS_REDEMPTION = {
  1: 10, // 1 Rs. off per 10 points
};

// Calculate subscription pricing
export const calculateSubscriptionPrice = (tier, billingPeriod = 'monthly') => {
  const config = SUBSCRIPTION_CONFIG[tier];
  if (!config) return null;

  const period = billingPeriod === 'annual' ? 'annualPrice' : 'monthlyPrice';
  const price = config[period] || 0;
  const savings = config[period] > 0
    ? Math.round((config[period] * config.discount) / 100)
    : 0;

  return {
    amount: price,
    currency: 'INR',
    billingPeriod,
    discount: config.discount,
    savings,
    effectivePrice: price - savings,
  };
};

// Calculate points earned
export const calculatePointsEarned = (amount, subscription) => {
  const config = SUBSCRIPTION_CONFIG[subscription];
  if (!config) return 0;

  const basePoints = Math.floor(amount / 100);
  const bonus = config.benefits.points ? Math.round((config.benefits.points * basePoints) / 100) : 0;

  return basePoints + bonus;
};

// Calculate booking discount
export const applySubscriptionDiscount = (amount, subscription) => {
  const config = SUBSCRIPTION_CONFIG[subscription];
  if (!config || subscription === SUBSCRIPTION_TIERS.FREE) return { discountedAmount: amount, discount: 0 };

  const discount = Math.round(amount * config.benefits.bookingDiscount);
  return {
    originalAmount: amount,
    discountedAmount: amount - discount,
    discount,
    discountPercent: config.benefits.bookingDiscount * 100,
  };
};

// Calculate points value
export const calculatePointsValue = (points) => {
  const rupees = (points / 10) || 0;
  return {
    points,
    rupees: Math.floor(rupees),
    paise: Math.round((rupees % 1) * 100),
  };
};

// Get subscription features
export const getSubscriptionFeatures = (tier) => {
  return SUBSCRIPTION_CONFIG[tier]?.features || [];
};

// Get subscription benefits
export const getSubscriptionBenefits = (tier) => {
  return SUBSCRIPTION_CONFIG[tier]?.benefits || {};
};

// Create subscription plan object
export const createSubscriptionPlan = (tier, billingPeriod = 'monthly') => {
  const config = SUBSCRIPTION_CONFIG[tier];
  const pricing = calculateSubscriptionPrice(tier, billingPeriod);

  if (!config) return null;

  return {
    tier,
    label: config.label,
    billing: {
      period: billingPeriod,
      amount: pricing.amount,
      effectivePrice: pricing.effectivePrice,
      discount: pricing.discount,
      savings: pricing.savings,
    },
    features: config.features,
    benefits: config.benefits,
  };
};

// Points expiry calculator
export const calculatePointsExpiry = (earnedDate) => {
  const expiryDate = new Date(earnedDate);
  expiryDate.setDate(expiryDate.getDate() + LOYALTY_POINTS_RULES.POINTS_EXPIRY_DAYS);
  return {
    expiryDate,
    daysRemaining: Math.ceil((expiryDate - new Date()) / (1000 * 60 * 60 * 24)),
    expired: expiryDate < new Date(),
  };
};

// Format subscription display
export const formatSubscriptionInfo = (subscription) => {
  const config = SUBSCRIPTION_CONFIG[subscription];
  if (!config) return null;

  return {
    name: config.label,
    discount: `${config.discount}% off bookings`,
    features: config.features.slice(0, 3),
    cta: subscription === SUBSCRIPTION_TIERS.FREE ? 'Upgrade' : 'Manage',
  };
};

// Check feature availability
export const hasFeature = (subscription, featureKey) => {
  const benefits = getSubscriptionBenefits(subscription);
  return !!benefits[featureKey];
};

export default {
  SUBSCRIPTION_TIERS,
  SUBSCRIPTION_CONFIG,
  LOYALTY_POINTS_RULES,
  POINTS_REDEMPTION,
  calculateSubscriptionPrice,
  calculatePointsEarned,
  applySubscriptionDiscount,
  calculatePointsValue,
  getSubscriptionFeatures,
  getSubscriptionBenefits,
  createSubscriptionPlan,
  calculatePointsExpiry,
  formatSubscriptionInfo,
  hasFeature,
};
