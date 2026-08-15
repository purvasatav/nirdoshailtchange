/**
 * Nearby Assistance Centre Service
 *
 * - Curated hardcoded centres for major Indian cities, merged with live
 *   results from OpenStreetMap's free Overpass API (no key, no billing)
 *   for geolocation searches, so coverage isn't limited to 6 seeded cities.
 * - Accepts city name or PIN code
 * - Returns nearest centres sorted by relevance using Haversine distance
 */

import logger from './logger';

export interface AssistanceCentre {
  id: string;
  name: string;
  type: 'aadhaar_seva_kendra' | 'pan_centre' | 'sdm_office' | 'csc_centre';
  typeLabel: string;
  address: string;
  city: string;
  state: string;
  pinCode: string;
  lat: number;
  lng: number;
  phone?: string;
  timing?: string;
  mapsUrl: string;
  rating?: number;
  reviewCount?: number;
  distance?: string;
  confidence: 'high' | 'medium' | 'low';
}

const hardcodedCentres: Omit<AssistanceCentre, 'confidence' | 'distance'>[] = [
  {
    id: 'ask-delhi-1',
    name: 'Aadhaar Seva Kendra - Pragati Maidan',
    type: 'aadhaar_seva_kendra',
    typeLabel: 'Aadhaar Seva Kendra',
    address: 'Hall No. 5, Pragati Maidan, New Delhi',
    city: 'Delhi',
    state: 'Delhi',
    pinCode: '110001',
    lat: 28.6185,
    lng: 77.2466,
    phone: '1947',
    timing: 'Mon-Sat, 9:30 AM - 5:30 PM',
    mapsUrl: 'https://www.google.com/maps/search/Aadhaar+Seva+Kendra+Pragati+Maidan+Delhi',
    rating: 4.8,
    reviewCount: 921,
  },
  {
    id: 'pan-delhi-1',
    name: 'UTIITSL PAN Centre - Connaught Place',
    type: 'pan_centre',
    typeLabel: 'PAN Application Centre',
    address: 'K-Block, Connaught Place, New Delhi',
    city: 'Delhi',
    state: 'Delhi',
    pinCode: '110001',
    lat: 28.6315,
    lng: 77.2167,
    phone: '011-2341-0000',
    timing: 'Mon-Fri, 9:30 AM - 5:00 PM',
    mapsUrl: 'https://www.google.com/maps/search/UTIITSL+PAN+Centre+Connaught+Place+Delhi',
    rating: 4.5,
    reviewCount: 312,
  },
  {
    id: 'sdm-delhi-1',
    name: 'SDM Office - Chanakyapuri',
    type: 'sdm_office',
    typeLabel: 'Sub-Divisional Magistrate Office',
    address: 'SDM Office, Chanakyapuri, New Delhi',
    city: 'Delhi',
    state: 'Delhi',
    pinCode: '110021',
    lat: 28.5976,
    lng: 77.1857,
    timing: 'Mon-Fri, 9:00 AM - 5:00 PM',
    mapsUrl: 'https://www.google.com/maps/search/SDM+Office+Chanakyapuri+Delhi',
    rating: 4.2,
    reviewCount: 154,
  },
  {
    id: 'pan-pune-1',
    name: 'NSDL PAN Card Centre - Nana Peth',
    type: 'pan_centre',
    typeLabel: 'PAN Application Centre',
    address: 'R.R. Chambers, 461 Nana Peth, Sant Kabir Chowk, near Modern Hospital, Pune',
    city: 'Pune',
    state: 'Maharashtra',
    pinCode: '411002',
    lat: 18.5155514,
    lng: 73.8687799,
    phone: '+91 98909 50214',
    timing: 'Mon-Fri, 10:00 AM - 6:00 PM (Sat till 4:00 PM)',
    mapsUrl: 'https://www.google.com/maps/search/?api=1&query=18.5155514,73.8687799',
    rating: 4.0,
    reviewCount: 65,
  },
  {
    id: 'pan-pune-2',
    name: 'UTIITSL PAN Centre - Shukrawar Peth',
    type: 'pan_centre',
    typeLabel: 'PAN Application Centre',
    address: 'UTI Infrastructure Technology & Services Ltd, Mandai, Shukrawar Peth, Pune',
    city: 'Pune',
    state: 'Maharashtra',
    pinCode: '411002',
    lat: 18.5128359,
    lng: 73.8549514,
    phone: '+91 20 2443 3873',
    timing: 'Mon-Fri, 9:15 AM - 4:00 PM (Sat till 2:00 PM)',
    mapsUrl: 'https://www.google.com/maps/search/?api=1&query=18.5128359,73.8549514',
    rating: 3.7,
    reviewCount: 40,
  },
  {
    id: 'csc-pune-1',
    name: 'Aaple Sarkar Seva Kendra - Swargate',
    type: 'csc_centre',
    typeLabel: 'Maha e-Seva Kendra (CSC)',
    address: 'Shop No 12 & 14, Galaxy Building, Ghorpade Peth, Swargate, Pune',
    city: 'Pune',
    state: 'Maharashtra',
    pinCode: '411042',
    lat: 18.5031755,
    lng: 73.8632515,
    phone: '+91 97301 13357',
    timing: 'Mon-Sat, 10:00 AM - 8:00 PM',
    mapsUrl: 'https://www.google.com/maps/search/?api=1&query=18.5031755,73.8632515',
    rating: 4.3,
    reviewCount: 11,
  },
  {
    id: 'sdm-pune-1',
    name: "Pune Collector's Office - Aaple Sarkar General Branch",
    type: 'sdm_office',
    typeLabel: 'District Collector / SDM Office',
    address: 'Collector Office, Finance Road, Agarkar Nagar, Pune',
    city: 'Pune',
    state: 'Maharashtra',
    pinCode: '411001',
    lat: 18.5234206,
    lng: 73.8710544,
    phone: '020-2612-3370',
    timing: 'Mon-Fri, 10:00 AM - 5:30 PM',
    mapsUrl: 'https://www.google.com/maps/search/?api=1&query=18.5234206,73.8710544',
    rating: 4.3,
    reviewCount: 361,
  },
  {
    id: 'ask-mumbai-1',
    name: 'Aadhaar Seva Kendra - Andheri',
    type: 'aadhaar_seva_kendra',
    typeLabel: 'Aadhaar Seva Kendra',
    address: 'MIDC, Andheri East, Mumbai',
    city: 'Mumbai',
    state: 'Maharashtra',
    pinCode: '400093',
    lat: 19.1196,
    lng: 72.8680,
    phone: '1947',
    timing: 'Mon-Sat, 9:30 AM - 5:30 PM',
    mapsUrl: 'https://www.google.com/maps/search/Aadhaar+Seva+Kendra+Andheri+Mumbai',
    rating: 4.7,
    reviewCount: 840,
  },
  {
    id: 'pan-mumbai-1',
    name: 'NSDL PAN Centre - Lower Parel',
    type: 'pan_centre',
    typeLabel: 'PAN Application Centre',
    address: 'Times Tower, Kamala Mills, Lower Parel, Mumbai',
    city: 'Mumbai',
    state: 'Maharashtra',
    pinCode: '400013',
    lat: 18.9947,
    lng: 72.8362,
    phone: '020-2721-8080',
    timing: 'Mon-Fri, 10:00 AM - 5:00 PM',
    mapsUrl: 'https://www.google.com/maps/search/NSDL+PAN+Centre+Fort+Mumbai',
    rating: 4.6,
    reviewCount: 512,
  },
  {
    id: 'csc-mumbai-1',
    name: 'Common Service Centre - Bandra',
    type: 'csc_centre',
    typeLabel: 'Common Service Centre (CSC)',
    address: 'CSC Centre, Hill Road, Bandra West, Mumbai',
    city: 'Mumbai',
    state: 'Maharashtra',
    pinCode: '400050',
    lat: 19.0544,
    lng: 72.8367,
    timing: 'Mon-Sat, 9:00 AM - 6:00 PM',
    mapsUrl: 'https://www.google.com/maps/search/Common+Service+Centre+Bandra+Mumbai',
    rating: 4.9,
    reviewCount: 1250,
  },
  {
    id: 'sdm-mumbai-1',
    name: "Tahsildar & Executive Magistrate's Office - Borivali",
    type: 'sdm_office',
    typeLabel: 'Tehsildar / SDM Office',
    address: '2nd Floor, Tashidar Building, S.V. Road, Borivali West, Mumbai',
    city: 'Mumbai',
    state: 'Maharashtra',
    pinCode: '400092',
    lat: 19.2232501,
    lng: 72.8546456,
    timing: 'Mon-Fri, 10:00 AM - 5:45 PM',
    mapsUrl: 'https://www.google.com/maps/search/?api=1&query=19.2232501,72.8546456',
    rating: 3.1,
    reviewCount: 246,
  },
  {
    id: 'ask-bangalore-1',
    name: 'Aadhaar Seva Kendra - Indiranagar',
    type: 'aadhaar_seva_kendra',
    typeLabel: 'Aadhaar Seva Kendra',
    address: '100 Feet Road, Indiranagar, Bangalore',
    city: 'Bangalore',
    state: 'Karnataka',
    pinCode: '560038',
    lat: 12.9784,
    lng: 77.6408,
    phone: '1947',
    timing: 'Mon-Sat, 9:30 AM - 5:30 PM',
    mapsUrl: 'https://www.google.com/maps/search/Aadhaar+Seva+Kendra+Indiranagar+Bangalore',
    rating: 4.8,
    reviewCount: 670,
  },
  {
    id: 'csc-bangalore-1',
    name: 'CSC - Common Service Centre - Kammanahalli',
    type: 'csc_centre',
    typeLabel: 'Common Service Centre (CSC)',
    address: '2nd Floor, Splendid Plaza, CMR Main Road, HRBR Layout, Kalyan Nagar, Bengaluru',
    city: 'Bangalore',
    state: 'Karnataka',
    pinCode: '560043',
    lat: 13.0217282,
    lng: 77.6409464,
    phone: '+91 88847 01777',
    timing: 'Mon-Fri, 9:00 AM - 5:00 PM',
    mapsUrl: 'https://www.google.com/maps/search/?api=1&query=13.0217282,77.6409464',
    rating: 3.4,
    reviewCount: 5,
  },
  {
    id: 'ask-pune-1',
    name: 'Aadhaar Seva Kendra - Shivajinagar',
    type: 'aadhaar_seva_kendra',
    typeLabel: 'Aadhaar Seva Kendra',
    address: 'FC Road, Shivajinagar, Pune',
    city: 'Pune',
    state: 'Maharashtra',
    pinCode: '411004',
    lat: 18.5314,
    lng: 73.8446,
    phone: '1947',
    timing: 'Mon-Sat, 9:30 AM - 5:30 PM',
    mapsUrl: 'https://www.google.com/maps/search/Aadhaar+Seva+Kendra+Shivajinagar+Pune',
    rating: 4.9,
    reviewCount: 1120,
  },
  {
    id: 'ask-hyderabad-1',
    name: 'Aadhaar Seva Kendra - Ameerpet',
    type: 'aadhaar_seva_kendra',
    typeLabel: 'Aadhaar Seva Kendra',
    address: 'SR Nagar, Ameerpet, Hyderabad',
    city: 'Hyderabad',
    state: 'Telangana',
    pinCode: '500038',
    lat: 17.4375,
    lng: 78.4483,
    phone: '1947',
    timing: 'Mon-Sat, 9:30 AM - 5:30 PM',
    mapsUrl: 'https://www.google.com/maps/search/Aadhaar+Seva+Kendra+Ameerpet+Hyderabad',
    rating: 4.7,
    reviewCount: 530,
  },
  {
    id: 'csc-hyderabad-1',
    name: 'CSC e-Governance Services - Ameerpet',
    type: 'csc_centre',
    typeLabel: 'Common Service Centre (CSC)',
    address: 'Swarna Jayanthi Commercial Complex, Srinivasa Nagar, Ameerpet, Hyderabad',
    city: 'Hyderabad',
    state: 'Telangana',
    pinCode: '500038',
    lat: 17.4380553,
    lng: 78.4440767,
    timing: 'Mon-Fri, 9:30 AM - 5:00 PM',
    mapsUrl: 'https://www.google.com/maps/search/?api=1&query=17.4380553,78.4440767',
    rating: 3.8,
    reviewCount: 29,
  },
  {
    id: 'ask-chennai-1',
    name: 'Aadhaar Seva Kendra - T. Nagar',
    type: 'aadhaar_seva_kendra',
    typeLabel: 'Aadhaar Seva Kendra',
    address: 'Usman Road, T. Nagar, Chennai',
    city: 'Chennai',
    state: 'Tamil Nadu',
    pinCode: '600017',
    lat: 13.0359,
    lng: 80.2340,
    phone: '1947',
    timing: 'Mon-Sat, 9:30 AM - 5:30 PM',
    mapsUrl: 'https://www.google.com/maps/search/Aadhaar+Seva+Kendra+T+Nagar+Chennai',
    rating: 4.8,
    reviewCount: 780,
  },
  {
    id: 'csc-chennai-1',
    name: 'S S E Sevai Centre - T. Nagar',
    type: 'csc_centre',
    typeLabel: 'Common Service Centre (CSC)',
    address: '45/20, S Boag Road, opp. HDFC Bank, T. Nagar, Chennai',
    city: 'Chennai',
    state: 'Tamil Nadu',
    pinCode: '600017',
    lat: 13.0342634,
    lng: 80.2416683,
    phone: '+91 89397 41128',
    timing: 'Mon-Sun, 9:00 AM - 5:30 PM',
    mapsUrl: 'https://www.google.com/maps/search/?api=1&query=13.0342634,80.2416683',
    rating: 4.9,
    reviewCount: 223,
  },
];

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function searchCentresByCity(city: string): AssistanceCentre[] {
  const q = city.toLowerCase().trim();
  const matched = hardcodedCentres.filter(
    (c) => c.city.toLowerCase().includes(q) || c.state.toLowerCase().includes(q)
  );
  return matched.map((c) => ({ ...c, distance: undefined, confidence: 'high' as const }));
}

export function searchCentresByPin(pin: string): AssistanceCentre[] {
  const q = pin.trim();
  return hardcodedCentres
    .filter((c) => c.pinCode.startsWith(q.substring(0, 3)))
    .map((c) => ({ ...c, distance: undefined, confidence: 'high' as const }));
}

export async function searchCentresByLocation(lat: number, lng: number): Promise<AssistanceCentre[]> {
  const curated = hardcodedCentres.map((c) => {
    const dist = haversineDistance(lat, lng, c.lat, c.lng);
    return { ...c, distanceKm: dist, distance: `${dist.toFixed(1)} km`, confidence: 'high' as const };
  });

  let osmResults: (AssistanceCentre & { distanceKm: number })[] = [];
  try {
    osmResults = await fetchOsmNearbyOffices(lat, lng);
  } catch (err) {
    logger.warn(`[Nearby Centres] OpenStreetMap live lookup failed, using curated list only: ${(err as Error).message}`);
  }

  const merged = [...curated, ...osmResults].sort((a, b) => a.distanceKm - b.distanceKm);

  const nearby = merged.filter((c) => c.distanceKm <= 50);
  const finalList = nearby.length > 0 ? nearby : merged.slice(0, 3);

  return finalList.slice(0, 15).map(({ distanceKm, ...rest }) => rest);
}

async function fetchOsmNearbyOffices(lat: number, lng: number): Promise<(AssistanceCentre & { distanceKm: number })[]> {
  const radiusMetres = 15000;
  const query = `
    [out:json][timeout:12];
    (
      node["office"="government"](around:${radiusMetres},${lat},${lng});
      node["amenity"="post_office"](around:${radiusMetres},${lat},${lng});
      node["amenity"="townhall"](around:${radiusMetres},${lat},${lng});
      node["name"~"Aadhaar|UIDAI",i](around:${radiusMetres},${lat},${lng});
      node["name"~"PAN Card|PAN Centre|PAN Seva|UTIITSL|Protean",i](around:${radiusMetres},${lat},${lng});
      node["name"~"Common Service Centre|CSC Centre|CSC Kendra",i](around:${radiusMetres},${lat},${lng});
      node["name"~"Maha e-?Seva|Setu Kendra|Aaple Sarkar",i](around:${radiusMetres},${lat},${lng});
    );
    out center 30;
  `;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 9000);

  let response: Response;
  try {
    response = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: query,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) throw new Error(`Overpass API returned ${response.status}`);
  const data = (await response.json()) as { elements: any[] };

  return (data.elements || [])
    .filter((el) => el.lat && el.lon && el.tags?.name)
    .map((el): AssistanceCentre & { distanceKm: number } => {
      const dist = haversineDistance(lat, lng, el.lat, el.lon);
      const isPostOffice = el.tags.amenity === 'post_office';
      return {
        id: `osm-${el.id}`,
        name: el.tags.name,
        type: 'csc_centre',
        typeLabel: (() => {
          const n = (el.tags.name || '').toLowerCase();
          if (/aadhaar|uidai/.test(n)) return 'Aadhaar Seva Kendra';
          if (/pan card|pan centre|pan seva|utiitsl|protean/.test(n)) return 'PAN Application Centre';
          if (/common service centre|csc centre|csc kendra/.test(n)) return 'Common Service Centre (CSC)';
          if (/maha e-?seva|setu kendra|aaple sarkar/.test(n)) return 'Maha e-Seva Kendra';
          return isPostOffice ? 'Post Office (PAN/Aadhaar assistance point)' : 'Government Office';
        })(),
        address: [el.tags['addr:street'], el.tags['addr:city'], el.tags['addr:postcode']].filter(Boolean).join(', ') || 'Address not tagged in OpenStreetMap',
        city: el.tags['addr:city'] || '',
        state: el.tags['addr:state'] || '',
        pinCode: el.tags['addr:postcode'] || '',
        lat: el.lat,
        lng: el.lon,
        phone: el.tags.phone,
        mapsUrl: `https://www.google.com/maps/search/?api=1&query=${el.lat},${el.lon}`,
        distanceKm: dist,
        distance: `${dist.toFixed(1)} km`,
        confidence: isPostOffice ? 'medium' as const : 'low' as const,
      };
    })
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, 10);
}

export function getAvailableCities(): string[] {
  return [...new Set(hardcodedCentres.map((c) => c.city))].sort();
}

export async function geocodePin(pin: string): Promise<{ lat: number; lng: number } | null> {
  const url = `https://nominatim.openstreetmap.org/search?postalcode=${encodeURIComponent(pin)}&country=India&format=json&limit=1`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'NirdoshVault/1.0 (hackathon prototype)' },
      signal: controller.signal,
    });
    if (!response.ok) return null;
    const data = (await response.json()) as { lat: string; lon: string }[];
    if (!data.length) return null;
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function geocodeCity(city: string): Promise<{ lat: number; lng: number } | null> {
  const url = `https://nominatim.openstreetmap.org/search?city=${encodeURIComponent(city)}&country=India&format=json&limit=1`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'NirdoshVault/1.0 (hackathon prototype)' },
      signal: controller.signal,
    });
    if (!response.ok) return null;
    const data = (await response.json()) as { lat: string; lon: string }[];
    if (!data.length) return null;
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}
