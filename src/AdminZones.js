import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from './supabase';
import { color, font, radius, ui } from './theme';
import Icon from './ui/Icon';
import { searchLocalities, nearestLocality, serviceability } from './geo';
import {
  A, Badge, ChipGroup, ConfirmDialog, DataTable, Drawer, EmptyState, Field, KpiTile, Notice, SectionHeader, Skeleton, Toast, fmtDate,
} from './AdminUI';

// localities.js keys the NCR service city as 'Gurgaon'.
export const localityCity = (cityName) => {
  const n = String(cityName || '');
  if (/pune/i.test(n)) return 'Pune';
  if (/gur|ncr|delhi|noida/i.test(n)) return 'Gurgaon';
  return undefined;
};
export const parsePincodes = (text) => [...new Set((String(text || '').match(/\d+/g) || []))];

const audit = async (action, zoneId, reason) => {
  const { data: { user } } = await supabase.auth.getUser();
  if (user) await supabase.from('admin_audit_logs').insert({ admin_id: user.id, action, resource_type: 'service_zones', resource_id: zoneId, reason, status: 'success' });
};

const coverage = (z) => {
  const parts = [];
  if (z.pincodes?.length) parts.push(z.pincodes.length + ' pincode' + (z.pincodes.length > 1 ? 's' : ''));
  if (z.center_lat != null && z.radius_km) parts.push(Number(z.radius_km) + ' km radius');
  return parts.join(' + ') || 'No area set';
};

// Waitlist rows grouped by area + pincode, with the zone (if any) each falls in.
export function waitlistDemand(waitlist, zones, cityId) {
  const groups = {};
  waitlist.filter(w => !cityId || w.city_id === cityId).forEach(w => {
    const key = (w.area || '').trim().toLowerCase() + '|' + (w.pincode || '').trim();
    if (!groups[key]) {
      const res = serviceability({ area: w.area, pincode: w.pincode }, zones, w.city_id);
      groups[key] = { id: key, area: (w.area || '').trim() || 'Area not given', pincode: (w.pincode || '').trim(), cityId: w.city_id, count: 0, latest: w.created_at, zone: res.zone, reason: res.reason };
    }
    groups[key].count += 1;
    if (w.created_at > groups[key].latest) groups[key].latest = w.created_at;
  });
  return Object.values(groups).sort((a, b) => b.count - a.count || a.area.localeCompare(b.area));
}

export default function AdminZones() {
  const [cities, setCities] = useState([]);
  const [zones, setZones] = useState([]);
  const [waitlist, setWaitlist] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cityId, setCityId] = useState('all');
  const [editing, setEditing] = useState(null); // null | {} (new) | zone
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [toast, setToast] = useState(null);

  const flash = (text, tone = 'success') => { setToast({ text, tone }); setTimeout(() => setToast(null), 2500); };

  const load = useCallback(async () => {
    const [{ data: c }, { data: z, error: zErr }, { data: w }] = await Promise.all([
      supabase.from('cities').select('id, name').order('name'),
      supabase.from('service_zones').select('*').order('created_at', { ascending: true }),
      supabase.from('zone_waitlist').select('*').order('created_at', { ascending: false }),
    ]);
    setCities(c || []);
    setZones(z || []);
    setWaitlist(w || []);
    if (zErr) setToast({ text: 'Could not load zones: ' + zErr.message + ' (has migration 035 been run?)', tone: 'error' });
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const cityName = (id) => cities.find(c => c.id === id)?.name || 'Unknown city';
  const shownCities = cityId === 'all' ? cities : cities.filter(c => c.id === cityId);
  const demandAll = useMemo(() => waitlistDemand(waitlist, zones, null), [waitlist, zones]);
  const zoneDemand = useMemo(() => {
    const m = {};
    demandAll.forEach(g => { if (g.zone) m[g.zone.id] = (m[g.zone.id] || 0) + g.count; });
    return m;
  }, [demandAll]);

  const toggleOpen = async (z) => {
    const next = !z.is_open;
    const { error } = await supabase.from('service_zones').update({ is_open: next }).eq('id', z.id);
    if (error) { flash('Could not update: ' + error.message, 'error'); return; }
    await audit(next ? 'zone_opened' : 'zone_closed', z.id, z.name);
    setZones(list => list.map(x => (x.id === z.id ? { ...x, is_open: next } : x)));
    flash(z.name + (next ? ' is open for bookings' : ' is closed to new bookings'));
  };

  const remove = async (z) => {
    setConfirmDelete(null);
    const { error } = await supabase.from('service_zones').delete().eq('id', z.id);
    if (error) { flash('Could not delete: ' + error.message, 'error'); return; }
    await audit('zone_deleted', z.id, z.name);
    setZones(list => list.filter(x => x.id !== z.id));
    flash(z.name + ' deleted');
  };

  const saved = (zone, isNew) => {
    setEditing(null);
    flash(isNew ? zone.name + ' created' : zone.name + ' saved');
    load();
  };

  if (loading) return <Skeleton rows={5} label="Loading zones..." />;

  const openZones = zones.filter(z => z.is_open).length;

  return (
    <div style={A.stack(20)}>
      {toast && <Toast message={toast.text} tone={toast.tone} />}
      <div style={A.grid(170)}>
        <KpiTile label="Zones" value={zones.length} />
        <KpiTile label="Open zones" value={openZones} tone={openZones ? 'success' : undefined} />
        <KpiTile label="People waiting" value={waitlist.length} tone={waitlist.length ? 'warning' : undefined} />
      </div>

      <div style={{ ...A.row(8), justifyContent: 'space-between' }}>
        <ChipGroup label="Filter zones by city" value={cityId} onChange={setCityId}
          options={[{ id: 'all', label: 'All cities' }, ...cities.map(c => ({ id: c.id, label: c.name }))]} />
        <button onClick={() => setEditing({ city_id: cityId !== 'all' ? cityId : cities[0]?.id })} style={A.primary}><Icon name="plus" size={18} />New zone</button>
      </div>

      {shownCities.length === 0 && <EmptyState icon="map" title="No cities yet" text="Add cities in the database first." />}

      {shownCities.map(c => {
        const cz = zones.filter(z => z.city_id === c.id);
        const demand = waitlistDemand(waitlist, zones, c.id);
        const waiting = demand.reduce((a, g) => a + g.count, 0);
        return (
          <section key={c.id} aria-label={c.name + ' zones'} style={A.stack(12)}>
            <SectionHeader title={c.name}
              subtitle={cz.length === 0 ? null : cz.filter(z => z.is_open).length + ' of ' + cz.length + ' zones open · ' + waiting + ' waiting'}
              action={<button onClick={() => setEditing({ city_id: c.id })} style={A.small}><Icon name="plus" size={14} />Add zone in {c.name}</button>} />
            {cz.length === 0 ? (
              <Notice tone="info" icon="info">
                {c.name} has no zones, so the whole city is open for booking. Add a zone to limit bookings to specific areas; once a city has zones, only addresses inside an open zone can book.
              </Notice>
            ) : (
              <DataTable label={c.name + ' zones'} rowKey={z => z.id} rows={cz} columns={[
                { key: 'name', label: 'Zone', render: z => (
                  <div style={{ minWidth: 160 }}>
                    <div style={{ fontWeight: 600 }}>{z.name}</div>
                    <div style={{ ...A.muted, fontSize: font.xs }}>{coverage(z)}</div>
                  </div>
                ) },
                { key: 'area', label: 'Pincodes and centre', render: z => {
                  const centre = z.center_lat != null ? nearestLocality(z.center_lat, z.center_lng, localityCity(c.name)) : null;
                  return (
                    <div style={{ ...A.stack(4), minWidth: 180 }}>
                      {z.pincodes?.length > 0 && <div style={A.row(4)}>{z.pincodes.map(p => <Badge key={p} tone="neutral">{p}</Badge>)}</div>}
                      {z.center_lat != null && <div style={A.muted}>Within {Number(z.radius_km) || 0} km of {centre ? centre.name : z.center_lat.toFixed(3) + ', ' + z.center_lng.toFixed(3)}</div>}
                    </div>
                  );
                } },
                { key: 'waiting', label: 'Waiting', align: 'right', render: z => zoneDemand[z.id] || 0 },
                { key: 'status', label: 'Status', render: z => <Badge tone={z.is_open ? 'success' : 'danger'}>{z.is_open ? 'Open' : 'Closed'}</Badge> },
                { key: 'actions', label: 'Actions', render: z => (
                  <div style={{ ...A.row(6), flexWrap: 'nowrap' }}>
                    <button role="switch" aria-checked={!!z.is_open} aria-label={'Zone ' + z.name + ' open'} onClick={() => toggleOpen(z)}
                      style={{ ...A.small, gap: 8 }}>
                      <span aria-hidden="true" style={{ width: 32, height: 18, borderRadius: radius.pill, background: z.is_open ? color.success : color.faint, position: 'relative', flexShrink: 0 }}>
                        <span style={{ position: 'absolute', top: 2, left: z.is_open ? 16 : 2, width: 14, height: 14, borderRadius: radius.pill, background: color.surface }} />
                      </span>
                      {z.is_open ? 'Close' : 'Open'}
                    </button>
                    <button onClick={() => setEditing(z)} style={A.small} aria-label={'Edit ' + z.name}><Icon name="edit" size={14} />Edit</button>
                    <button onClick={() => setConfirmDelete(z)} style={A.smallDanger} aria-label={'Delete ' + z.name}><Icon name="trash" size={14} /></button>
                  </div>
                ) },
              ]} />
            )}

            <div style={ui.card}>
              <SectionHeader title={'Where people are waiting in ' + c.name} subtitle="From the waitlist shown when an address is outside an open zone. The top rows are the best places to open next." />
              {demand.length === 0 ? <div style={A.muted}>Nobody is on the waitlist in {c.name}.</div> : (
                <DataTable label={'Waitlist demand in ' + c.name} rowKey={g => g.id} rows={demand} maxHeight="50vh" columns={[
                  { key: 'area', label: 'Area', render: g => <span style={{ fontWeight: 600 }}>{g.area}</span> },
                  { key: 'pincode', label: 'Pincode', render: g => g.pincode || '—' },
                  { key: 'count', label: 'Waiting', align: 'right', render: g => g.count },
                  { key: 'zone', label: 'Zone', render: g => (g.zone
                    ? <Badge tone={g.zone.is_open ? 'success' : 'warning'}>{g.zone.name + (g.zone.is_open ? '' : ' (closed)')}</Badge>
                    : <Badge tone="info">{g.reason === 'no_zones' ? 'City open' : 'Not in any zone'}</Badge>) },
                  { key: 'latest', label: 'Latest', nowrap: true, render: g => fmtDate(g.latest) },
                ]} />
              )}
            </div>
          </section>
        );
      })}

      {editing && <ZoneForm zone={editing} cities={cities} cityName={cityName} onClose={() => setEditing(null)} onSaved={saved} />}
      {confirmDelete && (
        <ConfirmDialog title={'Delete ' + confirmDelete.name + '?'} tone="danger" confirmLabel="Delete zone" onCancel={() => setConfirmDelete(null)} onConfirm={() => remove(confirmDelete)}>
          Addresses in this zone will be treated as outside every zone{zones.filter(z => z.city_id === confirmDelete.city_id).length === 1 ? ', and because it is the last zone in ' + cityName(confirmDelete.city_id) + ', the whole city becomes open again' : ''}. Close it instead if you only want to pause bookings.
        </ConfirmDialog>
      )}
    </div>
  );
}

function ZoneForm({ zone, cities, cityName, onClose, onSaved }) {
  const isNew = !zone.id;
  const [name, setName] = useState(zone.name || '');
  const [cityId, setCityId] = useState(zone.city_id || cities[0]?.id || '');
  const [pincodes, setPincodes] = useState((zone.pincodes || []).join(', '));
  const [centre, setCentre] = useState(zone.center_lat != null ? { lat: zone.center_lat, lng: zone.center_lng, name: nearestLocality(zone.center_lat, zone.center_lng, localityCity(cityName(zone.city_id)))?.name } : null);
  const [radiusKm, setRadiusKm] = useState(zone.radius_km != null ? String(zone.radius_km) : '');
  const [isOpen, setIsOpen] = useState(zone.is_open !== false);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const suggestions = searchLocalities(search, localityCity(cityName(cityId)), 6);
  const pins = parsePincodes(pincodes);

  const pick = (l) => {
    setCentre({ lat: l.lat, lng: l.lng, name: l.name, pincode: l.pincode });
    setSearch('');
    if (!radiusKm) setRadiusKm('3');
    if (!name.trim()) setName(l.name);
  };
  const addPin = (p) => setPincodes(parsePincodes(pincodes + ', ' + p).join(', '));

  const save = async () => {
    setError('');
    const radius = radiusKm.trim() === '' ? null : Number(radiusKm);
    if (!name.trim()) { setError('Give the zone a name'); return; }
    if (!cityId) { setError('Pick a city'); return; }
    if (pins.some(p => p.length !== 6)) { setError('Pincodes must be 6 digits'); return; }
    if (centre && (radius == null || !(radius > 0) || radius > 50)) { setError('Set a radius between 0.5 and 50 km for the centre'); return; }
    if (!pins.length && !centre) { setError('Add at least one pincode, or pick a centre and radius'); return; }
    const row = { name: name.trim(), city_id: cityId, pincodes: pins, center_lat: centre ? centre.lat : null, center_lng: centre ? centre.lng : null, radius_km: centre ? radius : null, is_open: isOpen };
    setSaving(true);
    const { data: savedRow, error: err } = isNew
      ? await supabase.from('service_zones').insert(row).select('id').single()
      : await supabase.from('service_zones').update(row).eq('id', zone.id);
    setSaving(false);
    if (err) { setError('Could not save: ' + err.message); return; }
    await audit(isNew ? 'zone_created' : 'zone_updated', isNew ? savedRow?.id : zone.id, row.name + ' · ' + coverage(row));
    onSaved(row, isNew);
  };

  return (
    <Drawer title={isNew ? 'New zone' : 'Edit ' + zone.name} subtitle="A zone covers its pincodes, and/or everything within the radius of its centre." onClose={onClose} width={520}>
      <section style={{ ...ui.card, ...A.stack(14) }}>
        <Field label="Zone name" htmlFor="zone-name">
          <input id="zone-name" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Golf Course Road cluster" style={A.input} />
        </Field>
        <Field label="City" htmlFor="zone-city">
          <select id="zone-city" value={cityId} onChange={e => setCityId(e.target.value)} style={{ ...A.select, width: '100%' }}>
            {cities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <Field label="Pincodes" htmlFor="zone-pincodes" help="Separate with commas or spaces.">
          <input id="zone-pincodes" inputMode="numeric" value={pincodes} onChange={e => setPincodes(e.target.value)} placeholder="122002, 122011" style={A.input} />
        </Field>
        {pins.length > 0 && <div style={A.row(4)}>{pins.map(p => <Badge key={p} tone={p.length === 6 ? 'neutral' : 'danger'}>{p}</Badge>)}</div>}
      </section>

      <section style={{ ...ui.card, ...A.stack(14) }}>
        <SectionHeader title="Centre and radius" subtitle="Optional. Pick a locality as the centre; addresses within the radius are in the zone." />
        {centre ? (
          <div style={{ ...A.row(8), justifyContent: 'space-between', background: color.navySoft, borderRadius: radius.md, padding: '10px 12px' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: font.md, fontWeight: 600 }}>
              <Icon name="pin" size={18} color={color.navy} />Centre: {centre.name || centre.lat.toFixed(4) + ', ' + centre.lng.toFixed(4)}
            </span>
            <span style={A.row(6)}>
              {centre.pincode && !pins.includes(centre.pincode) && <button onClick={() => addPin(centre.pincode)} style={A.small}>Also add {centre.pincode}</button>}
              <button onClick={() => setCentre(null)} style={A.small}>Remove centre</button>
            </span>
          </div>
        ) : null}
        <Field label="Search a locality for the centre" htmlFor="zone-centre-search">
          <input id="zone-centre-search" value={search} onChange={e => setSearch(e.target.value)} placeholder="e.g. Sector 56, Baner or 122011" style={A.input} autoComplete="off" />
        </Field>
        {search.trim() && (
          <div role="listbox" aria-label="Locality suggestions" style={{ border: `1px solid ${color.line}`, borderRadius: radius.md, overflow: 'hidden' }}>
            {suggestions.length === 0 && <div style={{ ...A.muted, padding: 12 }}>No locality matches "{search}".</div>}
            {suggestions.map((l, i) => (
              <button key={l.name + l.pincode} role="option" aria-selected={false} onClick={() => pick(l)} className="adm-item"
                style={{ width: '100%', textAlign: 'left', display: 'flex', justifyContent: 'space-between', gap: 8, padding: '10px 12px', border: 'none', borderTop: i ? `1px solid ${color.line}` : 'none', background: color.surface, cursor: 'pointer', fontFamily: 'inherit', fontSize: font.md, color: color.ink }}>
                <span>{l.name}</span><span style={A.muted}>{l.pincode} · {l.district}</span>
              </button>
            ))}
          </div>
        )}
        <Field label="Radius (km)" htmlFor="zone-radius">
          <input id="zone-radius" type="number" min="0.5" max="50" step="0.5" value={radiusKm} onChange={e => setRadiusKm(e.target.value)} placeholder="e.g. 3" style={A.input} disabled={!centre} />
        </Field>
      </section>

      <section style={ui.card}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: font.md, cursor: 'pointer', minHeight: 36 }}>
          <input type="checkbox" checked={isOpen} onChange={e => setIsOpen(e.target.checked)} />
          Open for bookings
        </label>
      </section>

      {error && <Notice tone="danger" icon="alert">{error}</Notice>}
      <div style={A.row(8)}>
        <button onClick={save} disabled={saving} style={{ ...A.primary, flex: 1 }}>{saving ? 'Saving…' : isNew ? 'Create zone' : 'Save zone'}</button>
        <button onClick={onClose} style={A.secondary}>Cancel</button>
      </div>
    </Drawer>
  );
}
