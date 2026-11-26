// Content for api/seed-test-data.js. Every email is @example.com (reserved, so
// no real person can own it). Faces are illustrated avatars, not real people.
// Files starting with "_" in /api are not deployed as endpoints.
const area = (name, pincode, lat, lng) => ({ name, pincode, lat, lng });
const face = (seed) => 'https://api.dicebear.com/9.x/notionists/png?size=512&backgroundColor=f3eee5&seed=' + encodeURIComponent(seed);

const PUNE_PEOPLE = [
  { key: 'aditi', role: 'parent', name: 'Aditi Kulkarni (TEST)', email: 'fursday.test.aditi@example.com', phone: '9850000001',
    area: area('Baner', '411045', 18.5590, 73.7868), address: { flat: 'B-702', society: 'Baner Greens' }, bookWith: 'omkar',
    pet: { name: 'Simba', breed: 'Golden Retriever', age_years: 4, weight_kg: 30, gender: 'Male', vaccinated: 'yes', energy_level: 'high', behavior_strangers: 'friendly', behavior_leash: 'pulls', notes: 'Loves the park, pulls towards other dogs.' } },
  { key: 'rahul', role: 'parent', name: 'Rahul Deshpande (TEST)', email: 'fursday.test.rahul.d@example.com', phone: '9850000002',
    area: area('Kothrud', '411038', 18.5074, 73.8077), address: { flat: '12', society: 'Mayur Colony' }, bookWith: 'savita',
    pet: { name: 'Leo', breed: 'Beagle', age_years: 2, weight_kg: 11, gender: 'Male', vaccinated: 'yes', energy_level: 'high', behavior_strangers: 'friendly', behavior_leash: 'good', notes: 'Follows his nose. Keep on the lead.' } },
  { key: 'sneha', role: 'parent', name: 'Sneha Patil (TEST)', email: 'fursday.test.sneha.p@example.com', phone: '9850000003',
    area: area('Viman Nagar', '411014', 18.5679, 73.9143), address: { flat: 'C-1104', society: 'Konark Campus' }, bookWith: 'ganesh',
    pet: { name: 'Moti', breed: 'Indie/Mixed', age_years: 6, weight_kg: 16, gender: 'Female', vaccinated: 'yes', energy_level: 'low', behavior_strangers: 'shy', behavior_leash: 'good', notes: 'Shy at first, warms up with treats.' } },
  { key: 'omkar', role: 'sitter', status: 'active', name: 'Omkar Joshi (TEST)', email: 'fursday.test.omkar@example.com', phone: '9860000001',
    area: area('Koregaon Park', '411001', 18.5362, 73.8939), radiusKm: 6, experienceYears: 5, rating: 4.8, reviews: 9,
    languages: ['English', 'Marathi', 'Hindi'], aadhaar: '222233334444', upi: 'omkar.test@okhdfc',
    headline: 'Calm, strong walker for big and energetic dogs',
    highlights: ['Large breeds', 'First-aid trained', 'Has own transport'],
    bio: 'I have walked and boarded dogs in Koregaon Park and Kalyani Nagar for five years, mostly Labradors, Goldens and German Shepherds. I keep walks on a steady pace with plenty of sniff breaks, send a photo and route after every walk, and I am pet first-aid trained. Happy to give medicines and follow feeding notes exactly.',
    services: [['walk30', 450], ['daycare', 700], ['boarding', 1100]] },
  { key: 'savita', role: 'sitter', status: 'active', founding: true, name: 'सविता पवार (TEST)', email: 'fursday.test.savita@example.com', phone: '9860000002',
    area: area('Kothrud', '411038', 18.5074, 73.8077), radiusKm: 4, experienceYears: 8, rating: 4.9, reviews: 6,
    languages: ['Marathi', 'Hindi'], aadhaar: '555566667777', upi: 'savita.test@ybl',
    headline: 'कोथरूड में सुबह-शाम की भरोसेमंद सैर',
    highlights: ['Senior dogs', 'Puppies', 'Medication'],
    bio: 'मैं आठ साल से कोथरूड और बावधन में कुत्तों की देखभाल कर रही हूँ। बूढ़े और छोटे पिल्लों के साथ धीरे और प्यार से चलती हूँ। हर सैर के बाद फोटो भेजती हूँ, समय की पाबंद हूँ, और दवा या खाने के निर्देश ध्यान से मानती हूँ।',
    services: [['walk30', 320], ['daycare', 600]] },
  { key: 'ganesh', role: 'sitter', status: 'active', name: 'गणेश मोरे (TEST)', email: 'fursday.test.ganesh@example.com', phone: '9860000003',
    area: area('Viman Nagar', '411014', 18.5679, 73.9143), radiusKm: 5, experienceYears: 6, rating: 4.6, reviews: 4,
    languages: ['Hindi', 'Marathi'], aadhaar: '888899990000', upi: 'ganesh.test@paytm',
    headline: 'विमान नगर और खराड़ी में सैर और बोर्डिंग',
    highlights: ['Multiple dogs', 'Night stays', 'Large breeds'],
    bio: 'छह साल का अनुभव, विमान नगर, खराड़ी और कल्याणी नगर में। एक साथ दो कुत्तों को संभाल लेता हूँ। घर पर बोर्डिंग के लिए बड़ा आँगन है। रोज़ फोटो और वीडियो भेजता हूँ ताकि आप निश्चिंत रहें।',
    services: [['walk30', 380], ['boarding', 900]] },
  { key: 'pooja', role: 'sitter', status: 'pending', name: 'Pooja Shinde (TEST)', email: 'fursday.test.pooja@example.com', phone: '9860000004',
    area: area('Hinjewadi', '411057', 18.5913, 73.7389), radiusKm: 5, experienceYears: 1,
    languages: ['English', 'Marathi'], headline: 'New sitter in Hinjewadi and Wakad', highlights: ['Puppies'],
    bio: 'I grew up with dogs and have been walking my neighbours’ dogs in Hinjewadi Phase 1 for a year. Applying to Fursday to do it properly, with photos and updates after every visit.',
    services: [['walk30', 300]] },
];

// Rich profiles handed out to existing TEST sitters that are missing them.
const PROFILE_POOL = {
  Gurgaon: {
    en: [
      { years: 4, face: face('fursday-ncr-1'), area: area('Sector 56', '122011', 28.4237, 77.0981),
        headline: 'Certified walker for big, bouncy breeds',
        highlights: ['Large breeds', 'First-aid trained', 'Medication'],
        bio: 'Four years walking Labradors, Huskies and Goldens around Sector 54 to 57 and Golf Course Road. I keep a steady pace with sniff breaks, avoid the midday heat in summer, and send a photo and the route after every walk. Pet first-aid certified, comfortable giving tablets and eye drops.' },
      { years: 3, face: face('fursday-ncr-2'), area: area('DLF Phase 4', '122009', 28.4646, 77.0841),
        headline: 'Patient with puppies and nervous rescues',
        highlights: ['Puppies', 'Senior dogs', 'Multiple dogs'],
        bio: 'I foster rescues with a DLF animal group and spend most of my time with puppies and shy dogs. Short, calm walks, lots of praise, and I always follow your feeding and lead instructions. I live nearby, so I can cover early mornings and late evenings.' },
      { years: 6, face: face('fursday-ncr-3'), area: area('Sushant Lok 1', '122009', 28.4632, 77.0735),
        headline: 'Home boarding with a garden, six years in',
        highlights: ['Night stays', 'Large breeds', 'Has own transport'],
        bio: 'Six years of home boarding in Sushant Lok. Dogs stay in my home, not a kennel, with a shaded garden and a strict two-dog limit. I can pick up and drop off in my car, and I send updates morning and night.' },
    ],
    hi: [
      { years: 10, face: face('fursday-ncr-hi-1'), area: area('Sector 46', '122003', 28.4378, 77.0570),
        headline: 'दस साल का अनुभव, समय की पाबंदी',
        highlights: ['Large breeds', 'Senior dogs', 'Multiple dogs'],
        bio: 'मैं दस साल से सेक्टर 45, 46 और साउथ सिटी में कुत्तों को घुमा रहा हूँ। बड़े और बूढ़े कुत्तों के साथ आराम से चलता हूँ। गर्मी में सुबह जल्दी और शाम को देर से ही सैर करवाता हूँ। हर सैर के बाद फोटो भेजता हूँ।' },
      { years: 5, face: face('fursday-ncr-hi-2'), area: area('Sector 50', '122018', 28.4189, 77.0674),
        headline: 'प्यार से देखभाल, सुबह और शाम की सैर',
        highlights: ['Puppies', 'Medication', 'Senior dogs'],
        bio: 'मुझे कुत्तों से बहुत प्यार है। पाँच साल से सेक्टर 50 और निर्वाणा कंट्री में सैर और देखभाल कर रही हूँ। दवा देना, खाने का ध्यान रखना और पिल्लों को सिखाना मुझे अच्छे से आता है। हर बार फोटो के साथ अपडेट भेजती हूँ।' },
    ],
  },
  Pune: {
    en: PUNE_PEOPLE.filter(p => p.role === 'sitter' && !/[ऀ-ॿ]/.test(p.name)).map(p => ({ years: p.experienceYears, face: face('fursday-' + p.key), area: p.area, headline: p.headline, highlights: p.highlights, bio: p.bio })),
    hi: PUNE_PEOPLE.filter(p => p.role === 'sitter' && /[ऀ-ॿ]/.test(p.name)).map(p => ({ years: p.experienceYears, face: face('fursday-' + p.key), area: p.area, headline: p.headline, highlights: p.highlights, bio: p.bio })),
  },
};

module.exports = { PUNE_PEOPLE, PROFILE_POOL };
