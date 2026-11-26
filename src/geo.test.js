import { distanceKm, formatKm, nearestLocality, searchLocalities, localityByPincode, serviceability, sitterCovers, pointFor } from './geo';

test('distance between Sector 56 and DLF Phase 1 is a few km', () => {
  const d = distanceKm({ lat: 28.4237, lng: 77.0981 }, { lat: 28.4722, lng: 77.0981 });
  expect(d).toBeGreaterThan(5);
  expect(d).toBeLessThan(6);
  expect(formatKm(0.4)).toBe('<1 km');
  expect(formatKm(5.38)).toBe('5.4 km');
});

test('GPS gives a real neighbourhood name in both cities', () => {
  expect(nearestLocality(28.4240, 77.0985, 'Gurgaon').name).toBe('Sector 56');
  expect(nearestLocality(18.5595, 73.7870, 'Pune').name).toBe('Baner');
  expect(nearestLocality(19.07, 72.87, 'Pune')).toBeNull(); // Mumbai is too far from any Pune area
});

test('address search matches name, district and pincode, starts-with first', () => {
  expect(searchLocalities('dlf', 'Gurgaon').map(l => l.name)).toEqual(['DLF Phase 1', 'DLF Phase 2', 'DLF Phase 3', 'DLF Phase 4', 'DLF Phase 5']);
  expect(searchLocalities('4110', 'Pune').every(l => l.city === 'Pune')).toBe(true);
  expect(searchLocalities('noida', 'Gurgaon').length).toBeGreaterThan(2);
  expect(searchLocalities('baner', 'Gurgaon')).toEqual([]);
  expect(localityByPincode('411045').city).toBe('Pune');
});

test('serviceability: open when no zones, by pincode, by radius, closed zone, outside', () => {
  const addr = { area: 'Sector 56', pincode: '122011' };
  expect(serviceability(addr, [], 'c1').serviceable).toBe(true);
  const zones = [
    { city_id: 'c1', name: 'Sector 50–57', pincodes: ['122011', '122018'], is_open: true },
    { city_id: 'c1', name: 'DLF', center_lat: 28.4722, center_lng: 77.0981, radius_km: 2, is_open: false },
  ];
  expect(serviceability(addr, zones, 'c1')).toMatchObject({ serviceable: true, reason: 'open' });
  expect(serviceability({ area: 'DLF Phase 1', pincode: '122002' }, zones, 'c1')).toMatchObject({ serviceable: false, reason: 'closed' });
  expect(serviceability({ area: 'Palam Vihar', pincode: '122017' }, zones, 'c1')).toMatchObject({ serviceable: false, reason: 'outside' });
  expect(serviceability({ pincode: '411045' }, zones, 'c2').serviceable).toBe(true); // other city has no zones
});

test('sitter radius decides who travels to you; unknown base is allowed', () => {
  const home = pointFor({ area: 'Sector 56' });
  expect(sitterCovers({ base_area: 'Sector 54', service_radius_km: 3 }, home).covers).toBe(true);
  expect(sitterCovers({ base_area: 'Palam Vihar', service_radius_km: 5 }, home).covers).toBe(false);
  expect(sitterCovers({}, home)).toEqual({ covers: true, km: null });
});
