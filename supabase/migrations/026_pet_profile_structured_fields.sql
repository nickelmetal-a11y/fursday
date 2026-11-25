-- PetProfile.js's edit-load path already reads data.vaccinated,
-- data.energy_level, data.behavior_strangers, data.behavior_leash, and
-- data.emergency_contact as if they were real columns, but pet_profiles
-- never had them -- the save path instead folded all of this into the
-- free-text `notes` column. Net effect: editing an existing pet always
-- showed these as unanswered, forcing the user to redo them (and, since
-- step 2 requires re-selecting energy/strangers/leash to even proceed,
-- not silent data loss -- but still a real bug). Adding the columns the
-- read path already expects, rather than parsing them back out of notes.
alter table public.pet_profiles
  add column if not exists vaccinated text,
  add column if not exists energy_level text,
  add column if not exists behavior_strangers text,
  add column if not exists behavior_leash text,
  add column if not exists emergency_contact text;
