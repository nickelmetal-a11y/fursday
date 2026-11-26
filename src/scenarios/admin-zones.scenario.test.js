import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { db } from '../testing/fakeSupabase';
import { buildSeed, IDS } from '../testing/seed';
import AdminZones, { parsePincodes, localityCity } from '../AdminZones';

jest.mock('../supabase', () => require('../testing/fakeSupabase'));

beforeEach(() => {
  db.reset(buildSeed());
  db.signInAs(IDS.admin);
});

const waitlist = (area, pincode, city = IDS.gurgaon) => db.insert('zone_waitlist', { user_id: IDS.ananya, city_id: city, area, pincode });

describe('Admin: service zones', () => {
  test('Z1: a city with no zones is shown as fully open', async () => {
    render(<AdminZones />);
    expect(await screen.findByText(/Gurgaon has no zones, so the whole city is open for booking/)).toBeInTheDocument();
    expect(screen.getByText(/Pune has no zones, so the whole city is open for booking/)).toBeInTheDocument();
  });

  test('Z2: admin creates a zone from pincodes plus a locality centre and radius', async () => {
    render(<AdminZones />);
    fireEvent.click(await screen.findByRole('button', { name: 'Add zone in Gurgaon' }));
    fireEvent.change(screen.getByLabelText('Zone name'), { target: { value: 'Golf Course cluster' } });
    fireEvent.change(screen.getByLabelText('Pincodes'), { target: { value: '122002 122011' } });
    fireEvent.change(screen.getByLabelText('Search a locality for the centre'), { target: { value: 'Sector 56' } });
    fireEvent.click(screen.getAllByRole('option', { name: /Sector 56/ })[0]);
    expect(screen.getByText(/Centre: Sector 56/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Radius (km)'), { target: { value: '4' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create zone' }));

    await waitFor(() => expect(db.rows('service_zones')).toHaveLength(1));
    expect(db.rows('service_zones')[0]).toMatchObject({
      city_id: IDS.gurgaon, name: 'Golf Course cluster', pincodes: ['122002', '122011'], radius_km: 4, is_open: true, center_lat: 28.4237, center_lng: 77.0981,
    });
    expect(await screen.findByText('Golf Course cluster')).toBeInTheDocument();
    expect(screen.queryByText(/Gurgaon has no zones/)).toBeNull();
    expect(screen.getByText(/Pune has no zones/)).toBeInTheDocument();
    expect(db.rows('admin_audit_logs', { action: 'zone_created' })).toHaveLength(1);
  });

  test('Z2b: a zone needs a name and some area, and pincodes must be 6 digits', async () => {
    render(<AdminZones />);
    fireEvent.click(await screen.findByRole('button', { name: 'Add zone in Pune' }));
    fireEvent.click(screen.getByRole('button', { name: 'Create zone' }));
    expect(screen.getByText('Give the zone a name')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Zone name'), { target: { value: 'Baner' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create zone' }));
    expect(screen.getByText('Add at least one pincode, or pick a centre and radius')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Pincodes'), { target: { value: '41104' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create zone' }));
    expect(screen.getByText('Pincodes must be 6 digits')).toBeInTheDocument();
    expect(db.rows('service_zones')).toHaveLength(0);
  });

  test('Z3: admin closes a zone with the toggle, and can open it again', async () => {
    db.insert('service_zones', { id: 'z-dlf', city_id: IDS.gurgaon, name: 'DLF cluster', pincodes: ['122002'], is_open: true });
    render(<AdminZones />);
    const toggle = await screen.findByRole('switch', { name: 'Zone DLF cluster open' });
    expect(toggle).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(toggle);
    await waitFor(() => expect(db.one('service_zones', { id: 'z-dlf' }).is_open).toBe(false));
    expect(screen.getByRole('switch', { name: 'Zone DLF cluster open' })).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByText('Closed')).toBeInTheDocument();
    expect(db.rows('admin_audit_logs', { action: 'zone_closed', resource_id: 'z-dlf' })).toHaveLength(1);

    fireEvent.click(screen.getByRole('switch', { name: 'Zone DLF cluster open' }));
    await waitFor(() => expect(db.one('service_zones', { id: 'z-dlf' }).is_open).toBe(true));
  });

  test('Z4: waitlist demand is grouped by area and pincode, busiest first, per city', async () => {
    db.insert('service_zones', { id: 'z-dlf', city_id: IDS.gurgaon, name: 'DLF cluster', pincodes: ['122002'], is_open: false });
    waitlist('Sector 56', '122011');
    waitlist('Sector 56', '122011');
    waitlist('sector 56 ', '122011');
    waitlist('DLF Phase 1', '122002');
    waitlist('Baner', '411045', IDS.pune);
    render(<AdminZones />);

    const gurgaon = await screen.findByRole('table', { name: 'Waitlist demand in Gurgaon' });
    const rows = within(gurgaon).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByText(/sector 56/i)).toBeInTheDocument();
    expect(within(rows[0]).getByText('3')).toBeInTheDocument();
    expect(within(rows[0]).getByText('Not in any zone')).toBeInTheDocument();
    expect(within(rows[1]).getByText('DLF Phase 1')).toBeInTheDocument();
    expect(within(rows[1]).getByText('DLF cluster (closed)')).toBeInTheDocument();

    const pune = screen.getByRole('table', { name: 'Waitlist demand in Pune' });
    expect(within(pune).getByText('Baner')).toBeInTheDocument();
    expect(within(pune).getByText('City open')).toBeInTheDocument();

    // The zone row counts the people waiting inside it.
    const zoneRow = within(screen.getByRole('table', { name: 'Gurgaon zones' })).getByText('DLF cluster').closest('tr');
    expect(within(zoneRow).getByText('1')).toBeInTheDocument();
  });

  test('Z5: the city filter shows one city at a time', async () => {
    render(<AdminZones />);
    await screen.findByText(/Gurgaon has no zones/);
    fireEvent.click(screen.getByRole('button', { name: 'Pune' }));
    expect(screen.queryByText(/Gurgaon has no zones/)).toBeNull();
    expect(screen.getByText(/Pune has no zones/)).toBeInTheDocument();
  });

  test('helpers: pincodes parse from free text; city names map to locality keys', () => {
    expect(parsePincodes('122002, 122011 122002')).toEqual(['122002', '122011']);
    expect(localityCity('Pune')).toBe('Pune');
    expect(localityCity('Delhi NCR')).toBe('Gurgaon');
    expect(localityCity('Gurgaon')).toBe('Gurgaon');
  });
});
