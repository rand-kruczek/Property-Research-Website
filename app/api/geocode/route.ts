import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const address = request.nextUrl.searchParams.get('address')?.trim() ?? '';
  if (!address || address.length > 200) {
    return NextResponse.json({ error: 'Enter a street address under 200 characters.' }, { status: 400 });
  }

  const endpoint = new URL('https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates');
  endpoint.searchParams.set('singleLine', address);
  endpoint.searchParams.set('maxLocations', '1');
  endpoint.searchParams.set('outFields', 'Addr_type');
  endpoint.searchParams.set('forStorage', 'false');
  endpoint.searchParams.set('f', 'json');

  try {
    const response = await fetch(endpoint, { signal: AbortSignal.timeout(8000), cache: 'no-store' });
    if (!response.ok) throw new Error('Geocoding service unavailable');
    const data = await response.json();
    const candidate = data?.candidates?.[0];
    const latitude = Number(candidate?.location?.y);
    const longitude = Number(candidate?.location?.x);
    if (!candidate || candidate.score < 80 || !Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
      return NextResponse.json({ error: 'No reliable address match was found. Try a fuller address or enter coordinates.' }, { status: 404 });
    }
    return NextResponse.json({
      latitude,
      longitude,
      label: String(candidate.address || address),
      precision: String(candidate.attributes?.Addr_type || 'Approximate address match'),
    });
  } catch {
    return NextResponse.json({ error: 'Address lookup is temporarily unavailable. You can still enter coordinates.' }, { status: 502 });
  }
}
