import { buildAdsbUrl, type AdsbApiResponse, type AircraftResponse } from '@/lib/adsb';

export const dynamic = 'force-dynamic';

function getServerRadius() {
  const value = Number(process.env.RADIUS_NM ?? '50');
  if (!Number.isFinite(value)) return 50;
  return Math.min(Math.max(value, 1), 250);
}

function getPollInterval() {
  const value = Number(process.env.POLL_INTERVAL_SEC ?? '10');
  if (!Number.isFinite(value)) return 10;
  return Math.max(value, 5);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const latParam = searchParams.get('lat');
  const lonParam = searchParams.get('lon');
  const distParam = searchParams.get('dist');

  if (!latParam || !lonParam) {
    return Response.json(
      {
        timestamp: new Date().toISOString(),
        cache_age_sec: null,
        status: 'error',
        error: 'missing_coordinates',
        aircraft: [],
      },
      { status: 400 }
    );
  }

  try {
    const radius = distParam ? Number(distParam) : getServerRadius();
    const adsbUrl = buildAdsbUrl(latParam, lonParam, radius);

    const res = await fetch(adsbUrl, {
      next: { revalidate: getPollInterval() },
      headers: {
        Accept: 'application/json',
      },
    });

    if (!res.ok) {
      const retryAfter = Number(res.headers.get('retry-after') ?? '30');
      return Response.json(
        {
          timestamp: new Date().toISOString(),
          cache_age_sec: null,
          status: 'error',
          error: res.status === 429 ? 'rate_limited' : 'adsb_unreachable',
          retry_after_seconds: Number.isFinite(retryAfter) ? retryAfter : 30,
          aircraft: [],
        },
        { status: res.status === 429 ? 429 : 502 }
      );
    }

    const data = (await res.json()) as AdsbApiResponse;
    const aircraft = Array.isArray(data.ac) ? data.ac : [];
    const response: AircraftResponse = {
      timestamp: new Date().toISOString(),
      cache_age_sec: getPollInterval(),
      status: 'ok',
      query: {
        lat: Number(latParam),
        lon: Number(lonParam),
        radius_nm: radius,
      },
      aircraft_count: Array.isArray(data.ac) ? data.ac.length : 0,
      aircraft: aircraft as AircraftResponse['aircraft'],
    };

    return Response.json(response);
  } catch (error) {
    return Response.json(
      {
        timestamp: new Date().toISOString(),
        cache_age_sec: null,
        status: 'error',
        error: 'adsb_unreachable',
        aircraft: [],
      },
      { status: 502 }
    );
  }
}
