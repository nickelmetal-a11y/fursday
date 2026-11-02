// Fursday services configuration - all available pet care services

export const SERVICES = {
  WALK: 'walk',
  DAYCARE: 'daycare',
  BOARDING: 'boarding',
  GROOMING: 'grooming',
  TRAINING: 'training',
  EMERGENCY: 'emergency',
};

export const SERVICE_CONFIG = {
  [SERVICES.WALK]: {
    id: SERVICES.WALK,
    name: 'Dog Walking',
    emoji: '🚶',
    color: '#FF6B35',
    icon: 'Footprints',
    description: 'Professional dog walking service',
    details: 'Your dog gets a fun and energetic walk with a verified sitter',
    durations: [
      { label: '30 mins', value: 30, basePrice: 29900 },
      { label: '1 hour', value: 60, basePrice: 49900 },
      { label: '2 hours', value: 120, basePrice: 89900 },
    ],
    features: [
      '🐾 Professional walker',
      '📱 Real-time updates',
      '📸 Walk photos',
      '🛡️ GPS tracking',
      '⚠️ Pet liability insurance',
    ],
    requirements: [
      'Basic health check',
      'Vaccination records',
      'Emergency contact',
    ],
    minAge: 'All ages welcome',
    bestFor: 'Energetic dogs, exercise, socialization',
    safetyFeatures: ['GPS Tracking', 'Live Updates', 'Emergency Protocol'],
  },

  [SERVICES.DAYCARE]: {
    id: SERVICES.DAYCARE,
    name: 'Dog Daycare',
    emoji: '🏫',
    color: '#6C5CE7',
    icon: 'Users',
    description: 'Safe daycare with supervision',
    details: 'Full-day care with play, rest, and meals in a safe environment',
    durations: [
      { label: 'Half day (4h)', value: 4, basePrice: 59900 },
      { label: 'Full day (8h)', value: 8, basePrice: 99900 },
    ],
    features: [
      '👥 Group play time',
      '🍖 Meals provided',
      '😴 Rest time',
      '📹 Webcam access',
      '🎮 Activities & enrichment',
      '🛡️ Accident coverage',
    ],
    requirements: [
      'Vaccination records',
      'Behavior assessment',
      'Feeding preferences',
    ],
    minAge: '3+ months',
    bestFor: 'Social dogs, working professionals, senior dogs',
    safetyFeatures: ['Webcam Monitoring', 'Staff Supervision', 'Behavioral Screening'],
  },

  [SERVICES.BOARDING]: {
    id: SERVICES.BOARDING,
    name: 'Dog Boarding',
    emoji: '🏡',
    color: '#00B894',
    icon: 'Home',
    description: 'Overnight home-based boarding',
    details: 'Your dog stays at sitter\'s home with full care and attention',
    durations: [
      { label: 'One night', value: 1, basePrice: 129900 },
      { label: '2-3 nights', value: 3, basePrice: 349900 },
      { label: 'One week', value: 7, basePrice: 749900 },
    ],
    features: [
      '🛏️ Comfortable bed',
      '🍖 Premium meals',
      '🎾 Play & exercise',
      '💊 Medication support',
      '📸 Daily photos',
      '📞 24/7 support',
      '🌙 Overnight supervision',
    ],
    requirements: [
      'Complete medical history',
      'Behavior assessment call',
      'Vaccination records',
      'Feeding schedule',
    ],
    minAge: '6+ months',
    bestFor: 'Longer trips, anxious dogs, dogs needing special care',
    safetyFeatures: ['24/7 Supervision', 'Medical Support', 'Emergency Vet Access'],
  },

  [SERVICES.GROOMING]: {
    id: SERVICES.GROOMING,
    name: 'Pet Grooming',
    emoji: '✂️',
    color: '#FD79A8',
    icon: 'Scissors',
    description: 'Professional grooming services',
    details: 'Haircut, bath, nail trim, and grooming at sitter\'s place or home visit',
    durations: [
      { label: 'Bath & trim', value: 60, basePrice: 39900 },
      { label: 'Full grooming', value: 120, basePrice: 79900 },
      { label: 'Show prep', value: 180, basePrice: 149900 },
    ],
    features: [
      '🛁 Professional bath',
      '✂️ Breed-specific cut',
      '💅 Nail trimming',
      '👂 Ear cleaning',
      '🦷 Teeth brushing option',
      '🧴 Premium products',
      '📸 Before & after photos',
    ],
    requirements: [
      'Recent vaccines',
      'No open wounds',
      'Behavior notes',
    ],
    minAge: '3+ months',
    bestFor: 'Regular grooming, show prep, matted coats',
    safetyFeatures: ['Gentle Handling', 'Quality Products', 'Anxiety-Free Process'],
  },

  [SERVICES.TRAINING]: {
    id: SERVICES.TRAINING,
    name: 'Pet Training',
    emoji: '🎓',
    color: '#FDCB6E',
    icon: 'BookOpen',
    description: 'Professional behavior & obedience training',
    details: 'One-on-one or group training sessions for obedience and behavior',
    durations: [
      { label: 'Single session', value: 60, basePrice: 49900 },
      { label: '5-session package', value: 300, basePrice: 199900 },
      { label: 'Monthly program', value: 1440, basePrice: 399900 },
    ],
    features: [
      '👨‍🏫 Certified trainer',
      '📋 Custom plan',
      '🐕‍🦺 Behavior assessment',
      '📱 Progress tracking',
      '👥 Family training included',
      '📖 Training guide',
      '🏆 Certification option',
    ],
    requirements: [
      'Behavior questionnaire',
      'Initial assessment',
      'Owner commitment',
    ],
    minAge: '6+ months',
    bestFor: 'Puppies, behavior issues, obedience, aggression management',
    safetyFeatures: ['Certified Trainers', 'Positive Reinforcement', 'Gradual Progression'],
  },

  [SERVICES.EMERGENCY]: {
    id: SERVICES.EMERGENCY,
    name: 'Emergency Pet Care',
    emoji: '🚨',
    color: '#E74C3C',
    icon: 'AlertCircle',
    description: 'Urgent pet care assistance',
    details: 'Immediate help for pets with unexpected care needs',
    durations: [
      { label: '1 hour', value: 60, basePrice: 99900 },
      { label: '4 hours', value: 240, basePrice: 249900 },
      { label: '24 hours', value: 1440, basePrice: 499900 },
    ],
    features: [
      '🚗 Quick response',
      '💊 Basic first aid',
      '📞 Vet coordination',
      '🏥 Hospital transport',
      '24/7 availability',
      '📋 Incident documentation',
      '🚑 Emergency protocols',
    ],
    requirements: [
      'Immediate phone contact',
      'Pet medical history',
      'Emergency contact info',
    ],
    minAge: 'Any age',
    bestFor: 'Sudden illness, injury, post-surgery care, behavioral emergencies',
    safetyFeatures: ['24/7 Response', 'Vet Collaboration', 'Emergency Protocols'],
    urgent: true,
  },
};

// Get service by ID
export const getService = (serviceId) => {
  return SERVICE_CONFIG[serviceId];
};

// Get all services
export const getAllServices = () => {
  return Object.values(SERVICE_CONFIG);
};

// Get service category
export const getServiceCategory = (serviceId) => {
  const service = SERVICE_CONFIG[serviceId];
  if (!service) return null;

  if ([SERVICES.WALK, SERVICES.DAYCARE].includes(serviceId)) {
    return 'daycare';
  }
  if (serviceId === SERVICES.BOARDING) {
    return 'boarding';
  }
  if (serviceId === SERVICES.GROOMING) {
    return 'grooming';
  }
  if (serviceId === SERVICES.TRAINING) {
    return 'training';
  }
  if (serviceId === SERVICES.EMERGENCY) {
    return 'emergency';
  }

  return 'other';
};

// Calculate service price
export const calculateServicePrice = (serviceId, durationLabel) => {
  const service = SERVICE_CONFIG[serviceId];
  if (!service) return null;

  const duration = service.durations.find((d) => d.label === durationLabel);
  return duration ? duration.basePrice : null;
};

// Get service recommendations for pet
export const recommendServices = (petProfile) => {
  const recommendations = [];

  if (petProfile.age >= 3 && petProfile.energyLevel === 'high') {
    recommendations.push(SERVICES.WALK);
  }

  if (petProfile.behavioral_issues && petProfile.behavioral_issues.length > 0) {
    recommendations.push(SERVICES.TRAINING);
  }

  if (petProfile.grooming_frequency === 'regular') {
    recommendations.push(SERVICES.GROOMING);
  }

  if (petProfile.social_with_dogs === true) {
    recommendations.push(SERVICES.DAYCARE);
  }

  recommendations.push(SERVICES.BOARDING);

  return recommendations.map((serviceId) => SERVICE_CONFIG[serviceId]).filter(Boolean);
};

export default {
  SERVICES,
  SERVICE_CONFIG,
  getService,
  getAllServices,
  getServiceCategory,
  calculateServicePrice,
  recommendServices,
};
