const fs = require('fs');
let s = fs.readFileSync('src/SitterEditProfile.js', 'utf8');
let log = [];
const L = x => { log.push(x); console.log(x); };

// Fix the upload block: no .name on compressed blob, no doubled path, save to DB
const oldBlock = `    setUploadingPhoto(true);
    file = await compressImage(file);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const ext = file.name.split('.').pop();
      const path = \`sitter-photos/\${user.id}.\${ext}\`;
      const { error: uploadError } = await supabase.storage.from('sitter-photos').upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('sitter-photos').getPublicUrl(path);
      setPhotoUrl(publicUrl);
    } catch (e) { alert('Upload failed: ' + e.message); }
    setUploadingPhoto(false);`;

const newBlock = `    setUploadingPhoto(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const compressed = await compressImage(file);
      const path = user.id + '-' + Date.now() + '.jpg';
      const { error: uploadError } = await supabase.storage.from('sitter-photos').upload(path, compressed, { contentType: 'image/jpeg', upsert: true });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('sitter-photos').getPublicUrl(path);
      setPhotoUrl(publicUrl);
      // Persist immediately to the sitter profile
      const { data: prof } = await supabase.from('sitter_profiles').select('id').eq('user_id', user.id).single();
      if (prof) await supabase.from('sitter_profiles').update({ profile_photo_url: publicUrl }).eq('id', prof.id);
    } catch (e) { alert('Upload failed: ' + (e.message || e)); }
    setUploadingPhoto(false);`;

if (s.includes(oldBlock)) {
  s = s.replace(oldBlock, newBlock);
  fs.writeFileSync('src/SitterEditProfile.js', s, 'utf8');
  L('FIXED: sitter photo upload (no .name crash, correct path, saves to DB)');
} else {
  L('PATTERN NOT MATCHED — trying looser replacement');
  // Fallback: just fix the two breaking lines
  let changed = false;
  if (s.includes('const ext = file.name.split')) {
    s = s.replace(/file = await compressImage\(file\);/, '');
    s = s.replace(/const ext = file\.name\.split\('\.'\)\.pop\(\);\s*/, '');
    s = s.replace(/const path = \`sitter-photos\/\$\{user\.id\}\.\$\{ext\}\`;/, "const compressed = await compressImage(file);\n      const path = user.id + '-' + Date.now() + '.jpg';");
    s = s.replace(/\.upload\(path, file, \{ upsert: true \}\)/, ".upload(path, compressed, { contentType: 'image/jpeg', upsert: true })");
    changed = true;
  }
  if (changed) { fs.writeFileSync('src/SitterEditProfile.js', s, 'utf8'); L('FIXED via fallback'); }
  else L('COULD NOT FIX — paste the exact block');
}
