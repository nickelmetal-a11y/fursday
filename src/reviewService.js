// Enhanced review system with categories, badges, and reputation tracking

export const REVIEW_CATEGORIES = {
  COMMUNICATION: 'communication',
  RELIABILITY: 'reliability',
  SAFETY: 'safety',
  PET_CARE: 'pet_care',
  VALUE: 'value',
};

export const CATEGORY_LABELS = {
  [REVIEW_CATEGORIES.COMMUNICATION]: {
    label: 'Communication',
    emoji: '💬',
    description: 'Responsiveness and clarity',
  },
  [REVIEW_CATEGORIES.RELIABILITY]: {
    label: 'Reliability',
    emoji: '⏰',
    description: 'Punctuality and dependability',
  },
  [REVIEW_CATEGORIES.SAFETY]: {
    label: 'Safety',
    emoji: '🛡️',
    description: 'Pet safety and well-being',
  },
  [REVIEW_CATEGORIES.PET_CARE]: {
    label: 'Pet Care',
    emoji: '🐾',
    description: 'Quality of care provided',
  },
  [REVIEW_CATEGORIES.VALUE]: {
    label: 'Value',
    emoji: '💰',
    description: 'Worth for the price',
  },
};

export const SITTER_BADGES = {
  VERIFIED: 'verified',
  TRUSTED: 'trusted',
  SUPER: 'super',
  TOP: 'top',
  CERTIFIED: 'certified',
};

export const BADGE_CONFIG = {
  [SITTER_BADGES.VERIFIED]: {
    label: 'Verified',
    emoji: '✓',
    requirements: { minReviews: 1 },
    color: '#4CAF50',
    description: 'Background checked & verified',
  },
  [SITTER_BADGES.TRUSTED]: {
    label: 'Trusted',
    emoji: '⭐',
    requirements: { minReviews: 3, minRating: 4.8 },
    color: '#2196F3',
    description: 'Highly rated by pet parents',
  },
  [SITTER_BADGES.SUPER]: {
    label: 'Super',
    emoji: '🌟',
    requirements: { minReviews: 10, minRating: 4.9, consistency: 0.95 },
    color: '#FF9800',
    description: 'Consistently excellent service',
  },
  [SITTER_BADGES.TOP]: {
    label: 'Top Sitter',
    emoji: '🏆',
    requirements: { minReviews: 20, minRating: 4.95, topPercentile: 0.05 },
    color: '#FFD700',
    description: 'Top 5% of sitters',
  },
  [SITTER_BADGES.CERTIFIED]: {
    label: 'Certified',
    emoji: '🎓',
    requirements: { certification: 'pet_first_aid' },
    color: '#9C27B0',
    description: 'Pet first aid certified',
  },
};

// Calculate earned badges for a sitter
export const calculateSitterBadges = (sitterStats) => {
  const badges = [];

  if (sitterStats.verified) {
    badges.push(SITTER_BADGES.VERIFIED);
  }

  if (
    sitterStats.totalReviews >= BADGE_CONFIG[SITTER_BADGES.TRUSTED].requirements.minReviews &&
    sitterStats.averageRating >= BADGE_CONFIG[SITTER_BADGES.TRUSTED].requirements.minRating
  ) {
    badges.push(SITTER_BADGES.TRUSTED);
  }

  if (
    sitterStats.totalReviews >= BADGE_CONFIG[SITTER_BADGES.SUPER].requirements.minReviews &&
    sitterStats.averageRating >= BADGE_CONFIG[SITTER_BADGES.SUPER].requirements.minRating &&
    sitterStats.consistencyScore >= BADGE_CONFIG[SITTER_BADGES.SUPER].requirements.consistency
  ) {
    badges.push(SITTER_BADGES.SUPER);
  }

  if (
    sitterStats.totalReviews >= BADGE_CONFIG[SITTER_BADGES.TOP].requirements.minReviews &&
    sitterStats.averageRating >= BADGE_CONFIG[SITTER_BADGES.TOP].requirements.minRating &&
    sitterStats.percentile <= BADGE_CONFIG[SITTER_BADGES.TOP].requirements.topPercentile
  ) {
    badges.push(SITTER_BADGES.TOP);
  }

  if (sitterStats.petFirstAidCertified) {
    badges.push(SITTER_BADGES.CERTIFIED);
  }

  return badges;
};

// Calculate consistency score (variance in ratings)
export const calculateConsistencyScore = (categoryRatings) => {
  if (!categoryRatings || categoryRatings.length === 0) return 1.0;

  const avg = categoryRatings.reduce((a, b) => a + b) / categoryRatings.length;
  const variance = categoryRatings.reduce((sum, rating) => sum + Math.pow(rating - avg, 2), 0) / categoryRatings.length;
  const stdDev = Math.sqrt(variance);

  // Convert to 0-1 score (lower stdDev = higher score)
  return Math.max(0, 1 - (stdDev / 5));
};

// Calculate sitter stats from reviews
export const calculateSitterStats = (reviews, sitterProfile) => {
  if (!reviews || reviews.length === 0) {
    return {
      totalReviews: 0,
      averageRating: 0,
      categoryAverages: {},
      consistencyScore: 1.0,
      percentile: 1.0,
      verified: sitterProfile?.verified || false,
      petFirstAidCertified: sitterProfile?.certifications?.includes('pet_first_aid') || false,
    };
  }

  // Calculate overall rating
  const totalRating = reviews.reduce((sum, r) => sum + r.overall_rating, 0);
  const averageRating = totalRating / reviews.length;

  // Calculate category averages
  const categoryAverages = {};
  Object.keys(REVIEW_CATEGORIES).forEach((key) => {
    const categoryRatings = reviews
      .filter((r) => r.category_ratings && r.category_ratings[REVIEW_CATEGORIES[key]])
      .map((r) => r.category_ratings[REVIEW_CATEGORIES[key]]);

    if (categoryRatings.length > 0) {
      categoryAverages[REVIEW_CATEGORIES[key]] =
        categoryRatings.reduce((a, b) => a + b) / categoryRatings.length;
    }
  });

  // Calculate consistency score
  const allCategoryRatings = Object.values(categoryAverages);
  const consistencyScore = calculateConsistencyScore(allCategoryRatings);

  return {
    totalReviews: reviews.length,
    averageRating: parseFloat(averageRating.toFixed(2)),
    categoryAverages,
    consistencyScore: parseFloat(consistencyScore.toFixed(2)),
    percentile: calculatePercentile(averageRating, reviews.length),
    verified: sitterProfile?.verified || false,
    petFirstAidCertified: sitterProfile?.certifications?.includes('pet_first_aid') || false,
  };
};

// Calculate percentile ranking
export const calculatePercentile = (rating, reviewCount) => {
  // Mock calculation - in production, would compare against all sitters
  // For now: rating of 4.95 with 20+ reviews = top 5%
  if (reviewCount < 3) return 0.8;
  if (reviewCount < 10) return Math.min(0.7, 1 - (rating / 5) * 0.3);
  if (reviewCount < 20) return Math.min(0.15, 1 - (rating / 5) * 0.2);
  return Math.min(0.05, 1 - (rating / 5) * 0.1);
};

// Format review for display
export const formatReview = (review) => {
  return {
    id: review.id,
    authorName: review.pet_parent?.name || 'Pet Parent',
    authorAvatar: review.pet_parent?.avatar_url,
    overallRating: review.overall_rating,
    categoryRatings: review.category_ratings || {},
    text: review.review_text,
    date: new Date(review.created_at).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }),
    petName: review.pet_name,
    serviceType: review.service_type,
    verified: review.verified_booking,
    petImage: review.pet_image_url,
  };
};

// Get badge display info
export const getBadgeInfo = (badgeId) => {
  return BADGE_CONFIG[badgeId];
};

// Filter and sort reviews
export const filterReviews = (reviews, filters = {}) => {
  let filtered = [...reviews];

  if (filters.minRating) {
    filtered = filtered.filter((r) => r.overall_rating >= filters.minRating);
  }

  if (filters.serviceType) {
    filtered = filtered.filter((r) => r.service_type === filters.serviceType);
  }

  if (filters.petType) {
    filtered = filtered.filter((r) => r.pet_type === filters.petType);
  }

  if (filters.sortBy === 'recent') {
    filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  } else if (filters.sortBy === 'highest') {
    filtered.sort((a, b) => b.overall_rating - a.overall_rating);
  } else if (filters.sortBy === 'lowest') {
    filtered.sort((a, b) => a.overall_rating - b.overall_rating);
  }

  return filtered;
};

export default {
  REVIEW_CATEGORIES,
  CATEGORY_LABELS,
  SITTER_BADGES,
  BADGE_CONFIG,
  calculateSitterBadges,
  calculateConsistencyScore,
  calculateSitterStats,
  calculatePercentile,
  formatReview,
  getBadgeInfo,
  filterReviews,
};
