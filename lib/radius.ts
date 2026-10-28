import type { Property } from './properties';

export type SearchCenter = {
  latitude: number;
  longitude: number;
  label: string;
  precision: string;
};

export type SearchArea = { center: SearchCenter; miles: number };

const EARTH_RADIUS_MILES = 3958.7613;

export function parseCoordinates(input: string): Pick<SearchCenter, 'latitude' | 'longitude'> | null {
  const match = input.trim().match(/^([+-]?(?:\d+(?:\.\d+)?|\.\d+))\s*(?:,|\s)\s*([+-]?(?:\d+(?:\.\d+)?|\.\d+))$/);
  if (!match) return null;
  const latitude = Number(match[1]);
  const longitude = Number(match[2]);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  return { latitude, longitude };
}

export function validRadiusMiles(value: string): number | null {
  const miles = Number(value);
  return Number.isFinite(miles) && miles > 0 && miles <= 12500 ? miles : null;
}

export function propertyCoordinates(property: Property): { latitude: number; longitude: number } | null {
  if (String(property.latitude).trim() === '' || String(property.longitude).trim() === '' || property.latitude == null || property.longitude == null) return null;
  const latitude = Number(property.latitude);
  const longitude = Number(property.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  return { latitude, longitude };
}

export function distanceMiles(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }): number {
  const radians = Math.PI / 180;
  const deltaLatitude = (b.latitude - a.latitude) * radians;
  const deltaLongitude = (b.longitude - a.longitude) * radians;
  const halfChord = Math.sin(deltaLatitude / 2) ** 2 +
    Math.cos(a.latitude * radians) * Math.cos(b.latitude * radians) * Math.sin(deltaLongitude / 2) ** 2;
  return 2 * EARTH_RADIUS_MILES * Math.asin(Math.min(1, Math.sqrt(halfChord)));
}

export function withinRadius(property: Property, center: SearchCenter, radiusMiles: number): boolean {
  const point = propertyCoordinates(property);
  return point !== null && distanceMiles(center, point) <= radiusMiles;
}

// The same result set powers the map, list, counts and filtered exports.
export function filterByRadius(properties: Property[], area: SearchArea | null, nearestFirst = false): Property[] {
  if (!area) return properties;
  const matches = properties.flatMap(property => {
    const point = propertyCoordinates(property);
    if (!point) return [];
    const distance = distanceMiles(area.center, point);
    return distance <= area.miles ? [{ property, distance }] : [];
  });
  if (nearestFirst) matches.sort((a, b) => a.distance - b.distance || String(a.property.name).localeCompare(String(b.property.name)));
  return matches.map(match => match.property);
}
