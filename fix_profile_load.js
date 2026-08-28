const fs = require('fs');
let log = [];
const L = s => { log.push(s); console.log(s); };

// ═══ SQL needed: add experience_text + availability columns ═══
// (user runs separately)

// ═══ FIX 1: SitterOnboarding — save experience as text + save availability ═══
let so = fs.readFileSync('src/SitterOnboarding.js', 'utf8');

so = so.replace(
  `          bio, experience_years: parseInt(experience) || 0,
          languages, status: 'pending',
          upi_id: upiId || null,
          aadhaar_number: aadhaar || null,
        }).select().single();`,
  `          bio, experience_years: parseInt(experience) || 0,
          experience_text: experience || null,
          languages, status: 'pending',
          upi_id: upiId || null,
          aadhaar_number: aadhaar || null,
          availability_days: availableDays,
          morning_slot: morningSlot,
          afternoon_slot: afternoonSlot,
          evening_slot: eveningSlot,
          max_dogs: parseInt(maxDogs) || 1,
          advance_notice: advanceNotice,
        }).select().single();`
);
fs.writeFileSync('src/SitterOnboarding.js', so, 'utf8');
L('FIXED: SitterOnboarding now saves experience_text + availability');

// ═══ FIX 2: SitterEditProfile — read experience_text (fallback to years) ═══
let se = fs.readFileSync('src/SitterEditProfile.js', 'utf8');

se = se.replace(
  `      setExperience(profile.experience_years ? profile.experience_years + ' years' : '');`,
  `      setExperience(profile.experience_text || (profile.experience_years ? profile.experience_years + ' years' : ''));`
);
L('FIXED: SitterEditProfile reads experience_text');

// ═══ FIX 3: SitterEditProfile save — also write experience_text ═══
// Find the save/upsert in SitterEditProfile
const saveIdx = se.indexOf('experience_years');
if (saveIdx > -1) {
  // there may be a save function that writes experience_years
  se = se.replace(
    /experience_years: parseInt\(experience\)[^,]*,/g,
    "experience_years: parseInt(experience) || 0, experience_text: experience || null,"
  );
  L('FIXED: SitterEditProfile save writes experience_text');
}

fs.writeFileSync('src/SitterEditProfile.js', se, 'utf8');

L('\\nDONE — run the SQL then deploy');
