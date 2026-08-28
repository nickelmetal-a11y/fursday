const fs = require('fs');
const p = 'C:\\Users\\nikhil.a.mathur\\SynologyDrive\\Home Project\\fursday\\src\\PetProfile.js';
let c = fs.readFileSync(p, 'utf8');

// Add supabase import after the first import line
c = c.replace(
  "import { ArrowLeft, CheckCircle, AlertTriangle, Phone, Heart } from 'lucide-react';",
  "import { ArrowLeft, CheckCircle, AlertTriangle, Phone, Heart } from 'lucide-react';\nimport { supabase } from './supabase';"
);

// Replace the onSave call with a real Supabase save
c = c.replace(
  "else if (onSave) onSave(pet);",
  `else {
      const savePet = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { error } = await supabase.from('pets').insert({
            owner_id: user.id,
            name: pet.name,
            breed: pet.breed,
            age_years: parseInt(pet.age_years) || 0,
            weight_kg: parseFloat(pet.weight_kg) || 0,
            gender: pet.gender,
            is_vaccinated: pet.is_vaccinated,
            is_neutered: pet.is_neutered,
            feeding_schedule: pet.feeding_times,
            vet_name: pet.vet_clinic,
            vet_phone: pet.vet_phone,
            notes: pet.special_care,
            health_flags: [
              pet.heat_sensitive ? 'heat_sensitive' : null,
              pet.festival_anxiety ? 'festival_anxiety' : null,
              pet.stray_dog_aggression === 'high' ? 'stray_aggression_high' : null,
            ].filter(Boolean),
          });
          if (!error && onSave) onSave(pet);
          else if (error) alert('Error saving pet: ' + error.message);
        } else {
          if (onSave) onSave(pet);
        }
      };
      savePet();
    }`
);

fs.writeFileSync(p, c, 'utf8');
console.log('Done, bytes:', fs.readFileSync(p).length);