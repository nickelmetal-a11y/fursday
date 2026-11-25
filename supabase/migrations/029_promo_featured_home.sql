-- Lets an admin mark a single promo_codes row to surface on the app's
-- home screen banner (AdminPanel's new Promotions tab writes this).
alter table promo_codes add column if not exists featured_home boolean not null default false;

create index if not exists idx_promo_codes_featured_home on promo_codes(featured_home);

-- Keep the original WELCOME100 banner live by default once this column
-- exists; an admin can swap it out any time from AdminPanel's Promotions tab.
update promo_codes set featured_home = true where code = 'WELCOME100';
