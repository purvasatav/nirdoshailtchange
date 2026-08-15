import { Router, Response } from 'express';
import {
  searchCentresByCity,
  searchCentresByPin,
  searchCentresByLocation,
  getAvailableCities,
  geocodePin,
  geocodeCity,
} from '../services/nearbyCentreService';

const router = Router();

/**
 * GET /api/v1/centres?city=Delhi
 * GET /api/v1/centres?pin=110001
 * GET /api/v1/centres?lat=28.6&lng=77.2
 *
 * Returns list of nearby assistance centres, plus the resolved coordinates
 * used for the search (except plain lat/lng, which are already coordinates).
 * The frontend uses `location` to recentre the map on every search type.
 */
router.get('/', async (req, res: Response): Promise<void> => {
  const { city, pin, lat, lng } = req.query;

  if (lat && lng) {
    const latNum = parseFloat(lat as string);
    const lngNum = parseFloat(lng as string);
    if (isNaN(latNum) || isNaN(lngNum)) {
      res.status(400).json({ error: 'Invalid lat/lng values' });
      return;
    }
    const centres = await searchCentresByLocation(latNum, lngNum);
    res.json({ centres, searchMethod: 'geolocation', location: { lat: latNum, lng: lngNum } });
    return;
  }

  if (city) {
    const cityStr = city as string;
    const coords = await geocodeCity(cityStr);
    if (coords) {
      const centres = await searchCentresByLocation(coords.lat, coords.lng);
      res.json({ centres, searchMethod: 'city', location: coords });
      return;
    }
    const centres = searchCentresByCity(cityStr);
    res.json({ centres, searchMethod: 'city' });
    return;
  }

  if (pin) {
    const pinStr = pin as string;
    const coords = await geocodePin(pinStr);
    if (coords) {
      const centres = await searchCentresByLocation(coords.lat, coords.lng);
      res.json({ centres, searchMethod: 'pin', location: coords });
      return;
    }
    const centres = searchCentresByPin(pinStr);
    res.json({ centres, searchMethod: 'pin' });
    return;
  }

  const cities = getAvailableCities();
  res.json({ cities, centres: [], searchMethod: 'none' });
});

export default router;
