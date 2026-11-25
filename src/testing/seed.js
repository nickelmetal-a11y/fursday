// Realistic test world for the scenario tests. Dates are relative to "now" so
// refund tiers (72h / 24h) stay meaningful whenever the suite runs.
const day = 24 * 60 * 60 * 1000;
const isoDate = (offsetMs) => new Date(Date.now() + offsetMs).toISOString().split('T')[0];

export const IDS = {
  gurgaon: 'city-gurgaon', pune: 'city-pune',
  ananya: 'u-ananya', rohit: 'u-rohit', meera: 'u-meera',
  priyaUser: 'u-priya', sunitaUser: 'u-sunita', ramUser: 'u-ram', vikramUser: 'u-vikram', admin: 'u-admin',
  priya: 'sp-priya', sunita: 'sp-sunita', ram: 'sp-ram', vikram: 'sp-vikram',
  bruno: 'pet-bruno', coco: 'pet-coco', sheru: 'pet-sheru',
};

export function buildSeed() {
  const b = (id, extra) => ({
    id, booking_ref: 'FUR-' + id.toUpperCase().slice(-4), city_id: IDS.gurgaon, service_type: 'walk30',
    time_slot: '07:00 AM', gross_amount_paise: 40000, sitter_payout_paise: 40000, payment_status: 'unpaid',
    created_at: new Date(Date.now() - day).toISOString(), ...extra,
  });
  return {
    cities: [{ id: IDS.gurgaon, name: 'Gurgaon' }, { id: IDS.pune, name: 'Pune' }],
    users: [
      { id: IDS.ananya, name: 'Ananya Sharma', email: 'ananya@test.example', phone: '9810000001' },
      { id: IDS.rohit, name: 'Rohit Verma', email: 'rohit@test.example', phone: '9810000002' },
      { id: IDS.meera, name: 'Meera Iyer', email: 'meera@test.example', phone: '9810000003' },
      { id: IDS.priyaUser, name: 'Priya Kapoor', email: 'priya@test.example', phone: '9820000001' },
      { id: IDS.sunitaUser, name: 'सुनीता देवी', email: 'sunita@test.example', phone: '9820000002' },
      { id: IDS.ramUser, name: 'राम सिंह', email: 'ram@test.example', phone: '9820000003' },
      { id: IDS.vikramUser, name: 'Vikram Rao', email: 'vikram@test.example', phone: '9820000004' },
      { id: IDS.admin, name: 'Fursday Admin', email: 'admin@test.example', phone: '9830000000', is_admin: true },
    ],
    sitter_profiles: [
      { id: IDS.priya, user_id: IDS.priyaUser, city_id: IDS.gurgaon, status: 'active', bio: 'Certified walker, 4 years with large breeds.', languages: ['English', 'Hindi'], aadhaar_verified: true, avg_rating: 4.9, review_count: 12, rating: 4.9, total_bookings: 30, profile_photo_url: 'https://storage.test/p.jpg', availability_days: ['Mon','Tue','Wed','Thu','Fri'], morning_slot: true, evening_slot: true, max_dogs: 2, advance_notice: '24hrs', is_founding_sitter: false },
      { id: IDS.sunita, user_id: IDS.sunitaUser, city_id: IDS.gurgaon, status: 'active', bio: 'मुझे कुत्तों से बहुत प्यार है। सुबह और शाम की सैर।', languages: ['Hindi'], aadhaar_verified: true, avg_rating: 4.7, review_count: 5, rating: 4.7, total_bookings: 8, is_founding_sitter: true },
      { id: IDS.ram, user_id: IDS.ramUser, city_id: IDS.gurgaon, status: 'active', bio: 'दस साल का अनुभव।', languages: ['Hindi'], aadhaar_verified: true, avg_rating: 4.5, review_count: 3, rating: 4.5, total_bookings: 4 },
      { id: IDS.vikram, user_id: IDS.vikramUser, city_id: IDS.pune, status: 'pending', bio: 'New to Fursday, love dogs.', languages: ['English'], aadhaar_verified: false, created_at: new Date().toISOString() },
    ],
    sitter_pii: [
      { id: 'pii-priya', sitter_id: IDS.priya, aadhaar_number: '111122223333', upi_id: 'priya@okaxis' },
      { id: 'pii-sunita', sitter_id: IDS.sunita, aadhaar_number: '444455556666', upi_id: 'sunita@ybl' },
      { id: 'pii-ram', sitter_id: IDS.ram, aadhaar_number: '777788889999', upi_id: 'ram@paytm' },
    ],
    sitter_services: [
      { id: 'svc-1', sitter_id: IDS.priya, service_type: 'walk30', price_paise: 40000, is_active: true },
      { id: 'svc-2', sitter_id: IDS.priya, service_type: 'boarding', price_paise: 120000, is_active: true },
      { id: 'svc-3', sitter_id: IDS.sunita, service_type: 'walk30', price_paise: 30000, is_active: true },
      { id: 'svc-4', sitter_id: IDS.ram, service_type: 'walk30', price_paise: 35000, is_active: true },
      { id: 'svc-5', sitter_id: IDS.vikram, service_type: 'walk30', price_paise: 35000, is_active: true },
    ],
    pet_profiles: [
      { id: IDS.bruno, user_id: IDS.ananya, name: 'Bruno', breed: 'Labrador', age_years: 3, weight_kg: 28, gender: 'Male', vaccinated: 'yes', energy_level: 'high', behavior_strangers: 'friendly', behavior_leash: 'pulls' },
      { id: IDS.coco, user_id: IDS.rohit, name: 'Coco', breed: 'Shih Tzu', age_years: 5, weight_kg: 6, gender: 'Female', vaccinated: 'yes', energy_level: 'low', behavior_strangers: 'shy', behavior_leash: 'good' },
      { id: IDS.sheru, user_id: IDS.meera, name: 'Sheru', breed: 'Indie/Mixed', age_years: 2, weight_kg: 18, gender: 'Male', vaccinated: 'yes', energy_level: 'medium', behavior_strangers: 'friendly', behavior_leash: 'good' },
    ],
    bookings: [
      b('bk-far', { pet_parent_id: IDS.ananya, sitter_id: IDS.priya, pet_id: IDS.bruno, status: 'confirmed', payment_status: 'paid', booking_date: isoDate(5 * day) }),
      b('bk-mid', { pet_parent_id: IDS.ananya, sitter_id: IDS.sunita, pet_id: IDS.bruno, status: 'confirmed', payment_status: 'paid', booking_date: isoDate(2 * day) }),
      b('bk-soon', { pet_parent_id: IDS.rohit, sitter_id: IDS.ram, pet_id: IDS.coco, status: 'confirmed', payment_status: 'paid', booking_date: isoDate(0.4 * day) }),
      b('bk-unpaid', { pet_parent_id: IDS.rohit, sitter_id: IDS.priya, pet_id: IDS.coco, status: 'confirmed', payment_status: 'unpaid', booking_date: isoDate(3 * day) }),
      b('bk-pending', { pet_parent_id: IDS.meera, sitter_id: IDS.sunita, pet_id: IDS.sheru, status: 'pending', booking_date: isoDate(4 * day) }),
      b('bk-done', { pet_parent_id: IDS.ananya, sitter_id: IDS.priya, pet_id: IDS.bruno, status: 'completed', payment_status: 'paid', booking_date: isoDate(-3 * day), completed_at: new Date(Date.now() - 3 * day).toISOString() }),
      b('bk-done-hi', { pet_parent_id: IDS.meera, sitter_id: IDS.ram, pet_id: IDS.sheru, status: 'completed', payment_status: 'paid', booking_date: isoDate(-2 * day), completed_at: new Date(Date.now() - 2 * day).toISOString() }),
    ],
    messages: [],
    reviews: [],
    notifications: [],
    notification_preferences: [],
    disputes: [],
    sitter_reports: [],
    admin_audit_logs: [],
    app_settings: [{ key: 'support_phone', value: '919315578325' }, { key: 'support_whatsapp', value: '919315578325' }],
    promo_codes: [{ id: 'promo-welcome', code: 'WELCOME100', discount_amount: 100, max_discount_amount: 100, status: 'active', featured_home: true, valid_from: new Date(Date.now() - day).toISOString(), valid_until: new Date(Date.now() + 300 * day).toISOString(), times_used: 0 }],
    promo_usage: [],
    walk_photo_reports: [],
  };
}
