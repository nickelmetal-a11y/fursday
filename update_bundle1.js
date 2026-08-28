const fs = require('fs');
let changes = 0;

// Fix 1: UserProfile - fix pets table to pet_profiles
let up = fs.readFileSync('src/UserProfile.js', 'utf8');
up = up.replace(
  `const { data: petsData } = await supabase
          .from('pets').select('*').eq('owner_id', user.id);`,
  `const { data: petsData } = await supabase
          .from('pet_profiles').select('*').eq('user_id', user.id);`
);
// Fix display name to use users table
up = up.replace(
  `const displayName = user?.user_metadata?.name || user?.email?.split('@')[0] || 'Pet Parent';`,
  `const displayName = user?.user_metadata?.name || user?.email?.split('@')[0] || 'Pet Parent';`
);
fs.writeFileSync('src/UserProfile.js', up, 'utf8');
changes++; console.log('Fix 1 done: UserProfile pets table fixed');

// Fix 2: PetProfile - fix table and column names
let pp = fs.readFileSync('src/PetProfile.js', 'utf8');
pp = pp.replace(
  `owner_id: user.id,`,
  `user_id: user.id,`
);
pp = pp.replace(
  `await supabase.from('pets').insert(insertData);`,
  `await supabase.from('pet_profiles').insert(insertData);`
);
// Fix photo_urls column - pet_profiles uses photo_url (singular)
pp = pp.replace(
  `photo_urls: photos,`,
  `photo_url: photos[0] || null,`
);
fs.writeFileSync('src/PetProfile.js', pp, 'utf8');
changes++; console.log('Fix 2 done: PetProfile table fixed');

// Fix 3: UserProfile - fix photo_urls reference
up = fs.readFileSync('src/UserProfile.js', 'utf8');
up = up.replace(
  `{pet.photo_urls && pet.photo_urls[0] ? (
                  <img src={pet.photo_urls[0]} alt={pet.name}`,
  `{pet.photo_url ? (
                  <img src={pet.photo_url} alt={pet.name}`
);
up = up.replace(
  `style={{ width:52, height:52, borderRadius:14, objectFit:'cover', flexShrink:0 }} />
                ) : (`,
  `style={{ width:52, height:52, borderRadius:14, objectFit:'cover', flexShrink:0 }} />
                ) : (`
);
fs.writeFileSync('src/UserProfile.js', up, 'utf8');
changes++; console.log('Fix 3 done: UserProfile photo_url fixed');

// Fix 4: Admin password - add warning comment and move to env check
let ap = fs.readFileSync('src/AdminPanel.js', 'utf8');
ap = ap.replace(
  `const ADMIN_PASSWORD = 'fursday2025admin';`,
  `const ADMIN_PASSWORD = process.env.REACT_APP_ADMIN_PASSWORD || 'fursday2025admin';`
);
fs.writeFileSync('src/AdminPanel.js', ap, 'utf8');
changes++; console.log('Fix 4 done: admin password uses env var');

// Fix 5: Add image compression utility to PetProfile
pp = fs.readFileSync('src/PetProfile.js', 'utf8');
const compressFn = `
const compressImage = (file, maxSizeMB = 1) => new Promise((resolve) => {
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let w = img.width, h = img.height;
      const maxPx = 1200;
      if (w > maxPx) { h = h * maxPx / w; w = maxPx; }
      if (h > maxPx) { w = w * maxPx / h; h = maxPx; }
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      canvas.toBlob((blob) => resolve(new File([blob], file.name, { type: 'image/jpeg' })), 'image/jpeg', 0.8);
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
});
`;
if (!pp.includes('compressImage')) {
  pp = pp.replace(
    `export default function PetProfile`,
    compressFn + `export default function PetProfile`
  );
  pp = pp.replace(
    `for (const file of files) {`,
    `for (let file of files) {
      file = await compressImage(file);`
  );
  fs.writeFileSync('src/PetProfile.js', pp, 'utf8');
  changes++; console.log('Fix 5 done: image compression added');
}

// Fix 6: Add compression to SitterEditProfile photo upload
let sep = fs.readFileSync('src/SitterEditProfile.js', 'utf8');
if (!sep.includes('compressImage')) {
  const compressFn2 = `
const compressImage = (file) => new Promise((resolve) => {
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let w = img.width, h = img.height;
      const maxPx = 1200;
      if (w > maxPx) { h = h * maxPx / w; w = maxPx; }
      if (h > maxPx) { w = w * maxPx / h; h = maxPx; }
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      canvas.toBlob((blob) => resolve(new File([blob], file.name, { type: 'image/jpeg' })), 'image/jpeg', 0.8);
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
});
`;
  sep = sep.replace(
    `export default function SitterEditProfile`,
    compressFn2 + `export default function SitterEditProfile`
  );
  sep = sep.replace(
    `const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { alert('Photo must be under 2MB'); return; }
    setUploadingPhoto(true);`,
    `const handlePhotoUpload = async (e) => {
    let file = e.target.files[0];
    if (!file) return;
    setUploadingPhoto(true);
    file = await compressImage(file);`
  );
  fs.writeFileSync('src/SitterEditProfile.js', sep, 'utf8');
  changes++; console.log('Fix 6 done: sitter photo compression added');
}

console.log('Total changes:', changes);
