import { cityForCoords } from './App';

jest.mock('./supabase', () => require('./testing/fakeSupabase'));

test('GPS in Gurugram, Delhi, Noida or Faridabad picks Delhi NCR', () => {
  for (const [lat, lng] of [[28.46, 77.03], [28.61, 77.21], [28.57, 77.32], [28.41, 77.32], [28.67, 77.45]]) {
    expect(cityForCoords(lat, lng)).toBe('Gurgaon');
  }
});

test('GPS anywhere in Pune, including Pimpri-Chinchwad and Hinjewadi, picks Pune', () => {
  for (const [lat, lng] of [[18.52, 73.86], [18.63, 73.80], [18.59, 73.74], [18.56, 73.92]]) {
    expect(cityForCoords(lat, lng)).toBe('Pune');
  }
});

test('outside both cities returns null', () => {
  expect(cityForCoords(19.07, 72.87)).toBeNull(); // Mumbai
  expect(cityForCoords(12.97, 77.59)).toBeNull(); // Bengaluru
  expect(cityForCoords(undefined, undefined)).toBeNull();
});
