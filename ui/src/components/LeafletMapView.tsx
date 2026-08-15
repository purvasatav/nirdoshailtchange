import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface Centre {
  id: string;
  name: string;
  type: string;
  typeLabel: string;
  address: string;
  lat: number;
  lng: number;
  distance?: string;
}

interface Props {
  centres: Centre[];
  selectedCentreId: string | null;
  onSelectCentre: (id: string) => void;
  userLocation: { lat: number; lng: number } | null;
  activeCity?: string;
  onLiveLocationUpdate?: (lat: number, lng: number) => void;
}

const centreIcon = (active: boolean) =>
  L.divIcon({
    className: '',
    html: `<div style="width:${active ? 34 : 28}px;height:${active ? 34 : 28}px;background:${active ? '#ea580c' : '#7c3aed'};border:3px solid #fff;border-radius:50% 50% 50% 0;transform:rotate(-45deg);box-shadow:0 2px 6px rgba(0,0,0,.3)"></div>`,
    iconSize: [active ? 34 : 28, active ? 34 : 28],
    iconAnchor: [active ? 17 : 14, active ? 34 : 28],
  });

const userIcon = L.divIcon({
  className: '',
  html: `<div style="width:20px;height:20px;background:#3b82f6;border-radius:50%;border:3px solid #fff;box-shadow:0 0 0 2px rgba(59,130,246,0.4)"></div>`,
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

export default function LeafletMapView({ centres, selectedCentreId, onSelectCentre, userLocation, onLiveLocationUpdate }: Props) {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const markersRef = useRef<Record<string, L.Marker>>({});
  const userMarkerRef = useRef<L.Marker | null>(null);
  const accuracyCircleRef = useRef<L.Circle | null>(null);
  const routeLineRef = useRef<L.Polyline | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const lastGeocodeRef = useRef(0);

  const [isTracking, setIsTracking] = useState(false);
  const [liveAccuracy, setLiveAccuracy] = useState<number | null>(null);
  const [liveAreaName, setLiveAreaName] = useState('');
  const [trackError, setTrackError] = useState('');

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const center = userLocation || { lat: 18.5314, lng: 73.8446 };
    const map = L.map(containerRef.current, { zoomControl: true }).setView([center.lat, center.lng], 13);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
      maxZoom: 19,
    }).addTo(map);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    Object.values(markersRef.current).forEach(m => m.remove());
    markersRef.current = {};

    centres.forEach(centre => {
      const active = centre.id === selectedCentreId;
      const marker = L.marker([centre.lat, centre.lng], { icon: centreIcon(active) }).addTo(map);
      marker.bindPopup(
        `<strong>${centre.name}</strong><br/>${centre.address}${centre.distance ? `<br/><span style="color:#ea580c;font-weight:700">${centre.distance} away</span>` : ''}`
      );
      marker.on('click', () => onSelectCentre(centre.id));
      markersRef.current[centre.id] = marker;
    });
  }, [centres, selectedCentreId]);

  const reverseGeocode = async (lat: number, lng: number) => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1&zoom=18`,
        { headers: { 'Accept-Language': 'en' } }
      );
      const data = await res.json();
      const addr = data.address || {};
      const area = addr.suburb || addr.neighbourhood || addr.road || addr.village || addr.town || '';
      const city = addr.city || addr.town || addr.county || '';
      setLiveAreaName([area, city].filter(Boolean).join(', '));
    } catch (err) {
      console.error('Reverse geocode failed', err);
    }
  };

  const drawRoute = async (from: { lat: number; lng: number }, to: { lat: number; lng: number }) => {
    const map = mapRef.current;
    if (!map) return;
    try {
      const url = `https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`;
      const res = await fetch(url);
      const data = await res.json();
      if (!data.routes || !data.routes[0]) return;

      const coords = data.routes[0].geometry.coordinates.map(
        ([lng, lat]: [number, number]) => [lat, lng] as [number, number]
      );

      if (routeLineRef.current) routeLineRef.current.remove();
      routeLineRef.current = L.polyline(coords, { color: '#7c3aed', weight: 5, opacity: 0.8 }).addTo(map);
      map.fitBounds(routeLineRef.current.getBounds(), { padding: [40, 40] });
    } catch (err) {
      console.error('Route fetch failed', err);
    }
  };

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedCentreId) return;
    const centre = centres.find(c => c.id === selectedCentreId);
    if (!centre) return;

    map.panTo([centre.lat, centre.lng]);

    const userPos = userMarkerRef.current?.getLatLng();
    if (userPos) {
      drawRoute({ lat: userPos.lat, lng: userPos.lng }, { lat: centre.lat, lng: centre.lng });
    }
  }, [selectedCentreId]);

  const startLiveTracking = () => {
    if (!navigator.geolocation) {
      setTrackError('Geolocation is not supported on this device.');
      return;
    }
    setTrackError('');
    setIsTracking(true);

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        const map = mapRef.current;
        if (!map) return;

        setLiveAccuracy(accuracy);

        if (!userMarkerRef.current) {
          userMarkerRef.current = L.marker([latitude, longitude], { icon: userIcon, zIndexOffset: 1000 }).addTo(map);
          map.setView([latitude, longitude], 15);
        } else {
          userMarkerRef.current.setLatLng([latitude, longitude]);
        }

        if (!accuracyCircleRef.current) {
          accuracyCircleRef.current = L.circle([latitude, longitude], {
            radius: accuracy,
            color: '#3b82f6',
            fillColor: '#3b82f6',
            fillOpacity: 0.12,
            weight: 1,
          }).addTo(map);
        } else {
          accuracyCircleRef.current.setLatLng([latitude, longitude]);
          accuracyCircleRef.current.setRadius(accuracy);
        }

        const now = Date.now();
        if (now - lastGeocodeRef.current > 10000) {
          lastGeocodeRef.current = now;
          reverseGeocode(latitude, longitude);
        }
        onLiveLocationUpdate?.(latitude, longitude);
      },
      (err) => {
        setTrackError(err.message || 'Unable to fetch live location.');
        setIsTracking(false);
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    );
  };

  const stopLiveTracking = () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setIsTracking(false);
  };

  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
      if (routeLineRef.current) routeLineRef.current.remove();
    };
  }, []);

  return (
    <div style={{ position: 'relative', height: '100%', width: '100%' }}>
      <div ref={containerRef} style={{ height: '100%', width: '100%' }} />

      <div style={{ position: 'absolute', top: 10, right: 10, zIndex: 500 }}>
        {!isTracking ? (
          <button onClick={startLiveTracking} className="btn btn-primary text-xs px-3 py-2 flex items-center gap-1.5 shadow-md">
            Track My Live Location
          </button>
        ) : (
          <button onClick={stopLiveTracking} className="btn btn-secondary text-xs px-3 py-2 flex items-center gap-1.5 shadow-md">
            Stop Tracking {liveAccuracy ? `(+/-${Math.round(liveAccuracy)}m)` : ''}
          </button>
        )}
      </div>

      {liveAreaName && (
        <div style={{ position: 'absolute', top: 10, left: 10, zIndex: 500 }} className="bg-white shadow-md rounded-lg px-3 py-2 text-xs font-semibold">
          {liveAreaName}
        </div>
      )}

      {trackError && (
        <div style={{ position: 'absolute', bottom: 10, left: 10, right: 10, zIndex: 500 }} className="bg-red-50 border border-red-200 text-red-600 text-xs rounded-lg px-3 py-2">
          {trackError}
        </div>
      )}
    </div>
  );
}
