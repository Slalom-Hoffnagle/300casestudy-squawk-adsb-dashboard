export async function geocodeZip(zipCode: string) {
  const normalized = zipCode.trim();
  const digits = normalized.replace(/\D/g, '');

  if (!/^\d{5}$/.test(digits)) {
    throw new Error('ZIP code must be a 5-digit US value.');
  }

  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&postalcode=${digits}&countrycodes=us&limit=1`;
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error('Unable to look up that ZIP code.');
  }

  const data = (await response.json()) as Array<{ lat?: string; lon?: string }>;

  if (!Array.isArray(data) || data.length === 0) {
    throw new Error('No matching ZIP code location was found.');
  }

  const latitude = Number(data[0]?.lat);
  const longitude = Number(data[0]?.lon);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw new Error('ZIP lookup returned invalid coordinates.');
  }

  return {
    lat: latitude,
    lon: longitude,
  };
}
