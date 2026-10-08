'use client';

import { useState, type FormEvent } from 'react';
import { parseCoordinates, validRadiusMiles, type SearchCenter } from '@/lib/radius';

type RadiusFilterProps = {
  active: { center: SearchCenter; miles: number } | null;
  excludedCount: number;
  onApply: (center: SearchCenter, miles: number) => void;
  onClear: () => void;
};

export default function RadiusFilter({ active, excludedCount, onApply, onClear }: RadiusFilterProps) {
  const [location, setLocation] = useState('');
  const [miles, setMiles] = useState('25');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function apply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = location.trim();
    const distance = validRadiusMiles(miles);
    if (!input) { setError('Enter an address or coordinates.'); return; }
    if (distance === null) { setError('Enter a radius greater than 0 and at most 12,500 miles.'); return; }

    const coordinates = parseCoordinates(input);
    if (coordinates) {
      onApply({ ...coordinates, label: `${coordinates.latitude}, ${coordinates.longitude}`, precision: 'Entered coordinates' }, distance);
      setError('');
      return;
    }
    if (/^[\d+.,\-\s]+$/.test(input)) {
      setError('Coordinates must be latitude, longitude, within valid ranges.');
      return;
    }

    setBusy(true);
    setError('');
    try {
      const response = await fetch(`/api/geocode?address=${encodeURIComponent(input)}`);
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Address lookup failed.');
      onApply(result as SearchCenter, distance);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Address lookup failed.');
    } finally {
      setBusy(false);
    }
  }

  function clear() {
    setLocation('');
    setMiles('25');
    setError('');
    onClear();
  }

  return <div className="radius-filter">
    <form onSubmit={apply}>
      <label className="radius-location">
        <span>Within a radius of</span>
        <input aria-label="Search center address or coordinates" value={location} onChange={event => setLocation(event.target.value)} placeholder="Address or latitude, longitude" maxLength={200} />
      </label>
      <label className="radius-miles">
        <span>Miles</span>
        <input aria-label="Radius in miles" type="number" min="0.1" max="12500" step="any" value={miles} onChange={event => setMiles(event.target.value)} />
      </label>
      <button type="submit" disabled={busy}>{busy ? 'Finding…' : 'Apply'}</button>
    </form>
    {error && <p className="radius-error" role="alert">{error}</p>}
    {active && <div className="radius-active"><p>Within {active.miles} mi of {active.center.label}. {active.center.precision !== 'Entered coordinates' && `Address point: ${active.center.precision}.`} {excludedCount > 0 && `${excludedCount} ${excludedCount === 1 ? 'property' : 'properties'} without coordinates ${excludedCount === 1 ? 'is' : 'are'} excluded.`}</p><button type="button" onClick={clear}>Clear radius</button></div>}
    <small>Address lookup by Esri. Coordinates filter instantly.</small>
  </div>;
}
