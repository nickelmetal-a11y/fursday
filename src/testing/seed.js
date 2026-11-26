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

// ── Pune world ──────────────────────────────────────────────────────────────
// Everything in buildSeed() (the NCR world) plus a parallel Pune world, so the
// Pune suite can prove both the flows and that the two cities never mix.
export const PUNE = {
  aditi: 'u-aditi', rahul: 'u-rahul-d', sneha: 'u-sneha-p',
  omkarUser: 'u-omkar', savitaUser: 'u-savita', ganeshUser: 'u-ganesh', poojaUser: 'u-pooja',
  omkar: 'sp-omkar', savita: 'sp-savita', ganesh: 'sp-ganesh', pooja: 'sp-pooja',
  simba: 'pet-simba', leo: 'pet-leo', moti: 'pet-moti',
};

export function buildPuneSeed() {
  const s = buildSeed();
  const day = 24 * 60 * 60 * 1000;
  const isoDate = (offsetMs) => new Date(Date.now() + offsetMs).toISOString().split('T')[0];
  const P = PUNE, pune = IDS.pune;
  s.users.push(
    { id: P.aditi, name: 'Aditi Kulkarni', email: 'aditi@test.example', phone: '9850000001', city_id: pune },
    { id: P.rahul, name: 'Rahul Deshpande', email: 'rahul.d@test.example', phone: '9850000002', city_id: pune },
    { id: P.sneha, name: 'Sneha Patil', email: 'sneha.p@test.example', phone: '9850000003', city_id: pune },
    { id: P.omkarUser, name: 'Omkar Joshi', email: 'omkar@test.example', phone: '9860000001', city_id: pune },
    { id: P.savitaUser, name: 'सविता पवार', email: 'savita@test.example', phone: '9860000002', city_id: pune },
    { id: P.ganeshUser, name: 'गणेश मोरे', email: 'ganesh@test.example', phone: '9860000003', city_id: pune },
    { id: P.poojaUser, name: 'Pooja Shinde', email: 'pooja@test.example', phone: '9860000004', city_id: pune },
  );
  s.sitter_profiles.push(
    { id: P.omkar, user_id: P.omkarUser, city_id: pune, status: 'active', bio: 'Koregaon Park walker, 5 years with big breeds.', languages: ['English', 'Marathi'], aadhaar_verified: true, avg_rating: 4.8, review_count: 9, rating: 4.8, total_bookings: 22, is_founding_sitter: false },
    { id: P.savita, user_id: P.savitaUser, city_id: pune, status: 'active', bio: 'बानेर में सुबह-शाम की सैर।', languages: ['Marathi', 'Hindi'], aadhaar_verified: true, avg_rating: 4.9, review_count: 6, rating: 4.9, total_bookings: 11, is_founding_sitter: true },
    { id: P.ganesh, user_id: P.ganeshUser, city_id: pune, status: 'active', bio: 'विमान नगर, बोर्डिंग भी।', languages: ['Hindi', 'Marathi'], aadhaar_verified: true, avg_rating: 4.6, review_count: 4, rating: 4.6, total_bookings: 7 },
    { id: P.pooja, user_id: P.poojaUser, city_id: pune, status: 'pending', bio: 'New sitter in Hinjewadi.', languages: ['English', 'Marathi'], aadhaar_verified: false, created_at: new Date().toISOString() },
  );
  s.sitter_pii.push(
    { id: 'pii-omkar', sitter_id: P.omkar, aadhaar_number: '222233334444', upi_id: 'omkar@okhdfc' },
    { id: 'pii-savita', sitter_id: P.savita, aadhaar_number: '555566667777', upi_id: 'savita@ybl' },
    { id: 'pii-ganesh', sitter_id: P.ganesh, aadhaar_number: '888899990000', upi_id: 'ganesh@paytm' },
  );
  s.sitter_services.push(
    { id: 'svc-p1', sitter_id: P.omkar, service_type: 'walk30', price_paise: 45000, is_active: true },
    { id: 'svc-p2', sitter_id: P.omkar, service_type: 'boarding', price_paise: 110000, is_active: true },
    { id: 'svc-p3', sitter_id: P.savita, service_type: 'walk30', price_paise: 32000, is_active: true },
    { id: 'svc-p4', sitter_id: P.ganesh, service_type: 'walk30', price_paise: 38000, is_active: true },
    { id: 'svc-p5', sitter_id: P.pooja, service_type: 'walk30', price_paise: 30000, is_active: true },
  );
  s.pet_profiles.push(
    { id: P.simba, user_id: P.aditi, name: 'Simba', breed: 'Golden Retriever', age_years: 4, weight_kg: 30, gender: 'Male', vaccinated: 'yes', energy_level: 'high', behavior_strangers: 'friendly', behavior_leash: 'pulls' },
    { id: P.leo, user_id: P.rahul, name: 'Leo', breed: 'Beagle', age_years: 2, weight_kg: 11, gender: 'Male', vaccinated: 'yes', energy_level: 'high', behavior_strangers: 'friendly', behavior_leash: 'good' },
    { id: P.moti, user_id: P.sneha, name: 'Moti', breed: 'Indie/Mixed', age_years: 6, weight_kg: 16, gender: 'Female', vaccinated: 'yes', energy_level: 'low', behavior_strangers: 'shy', behavior_leash: 'good' },
  );
  const b = (id, extra) => ({ id, booking_ref: 'PUN-' + id.toUpperCase().slice(-4), city_id: pune, service_type: 'walk30', time_slot: '7:00 AM', payment_status: 'unpaid', created_at: new Date(Date.now() - day).toISOString(), ...extra });
  s.bookings.push(
    b('pn-far', { pet_parent_id: P.aditi, sitter_id: P.omkar, pet_id: P.simba, status: 'confirmed', payment_status: 'paid', booking_date: isoDate(6 * day), gross_amount_paise: 45000, sitter_payout_paise: 45000 }),
    b('pn-mid', { pet_parent_id: P.aditi, sitter_id: P.savita, pet_id: P.simba, status: 'confirmed', payment_status: 'paid', booking_date: isoDate(2 * day), gross_amount_paise: 32000, sitter_payout_paise: 32000 }),
    b('pn-soon', { pet_parent_id: P.rahul, sitter_id: P.ganesh, pet_id: P.leo, status: 'confirmed', payment_status: 'paid', booking_date: isoDate(0.4 * day), gross_amount_paise: 38000, sitter_payout_paise: 38000 }),
    b('pn-pending', { pet_parent_id: P.sneha, sitter_id: P.savita, pet_id: P.moti, status: 'pending', booking_date: isoDate(4 * day), gross_amount_paise: 32000, sitter_payout_paise: 32000 }),
    b('pn-done', { pet_parent_id: P.aditi, sitter_id: P.omkar, pet_id: P.simba, status: 'completed', payment_status: 'paid', booking_date: isoDate(-3 * day), completed_at: new Date(Date.now() - 3 * day).toISOString(), gross_amount_paise: 45000, sitter_payout_paise: 45000 }),
    b('pn-done-2', { pet_parent_id: P.rahul, sitter_id: P.savita, pet_id: P.leo, status: 'completed', payment_status: 'paid', booking_date: isoDate(-1 * day), completed_at: new Date(Date.now() - day).toISOString(), gross_amount_paise: 32000, sitter_payout_paise: 32000 }),
  );
  return s;
}
