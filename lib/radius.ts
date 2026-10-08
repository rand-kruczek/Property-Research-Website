import type { Property } from './properties';

export type SearchCenter = {
  latitude: number;
  longitude: number;
  label: string;
  precision: string;
};

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
  if (property.latitude === '' || property.longitude === '' || property.latitude == null || property.longitude == null) return null;
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
