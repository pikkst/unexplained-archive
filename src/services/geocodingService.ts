/**
 * Geocoding Service
 * Converts addresses to geographic coordinates using Nominatim (OpenStreetMap)
 * FREE and open-source alternative to Google Maps
 */

const NOMINATIM_BASE_URL = 'https://nominatim.openstreetmap.org';

export interface GeocodingResult {
  lat: number;
  lng: number;
  formattedAddress: string;
  placeId?: string;
}

export const geocodingService = {
  /**
   * Convert an address string to geographic coordinates
   * @param address - The address to geocode (e.g., "Tallinn, Estonia" or "Rakvere 123, Tallinn")
   * @returns Geocoding result with coordinates and formatted address
   */
  async geocodeAddress(address: string): Promise<GeocodingResult> {
    if (!address || address.trim().length === 0) {
      throw new Error('Address cannot be empty');
    }

    try {
      const encodedAddress = encodeURIComponent(address);
      // Nominatim requires a User-Agent header
      const url = `${NOMINATIM_BASE_URL}/search?format=json&q=${encodedAddress}&limit=1`;

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'UnexplainedArchive/1.0' // Required by Nominatim usage policy
        }
      });

      if (!response.ok) {
        throw new Error('Geocoding request failed');
      }

      const data = await response.json();

      if (!data || data.length === 0) {
        throw new Error('No results found for this address');
      }

      const result = data[0];

      return {
        lat: parseFloat(result.lat),
        lng: parseFloat(result.lon),
        formattedAddress: result.display_name,
        placeId: result.place_id?.toString()
      };
    } catch (error: any) {
      console.error('Geocoding error:', error);
      throw new Error(error.message || 'Failed to geocode address');
    }
  },

  /**
   * Convert coordinates to an address (reverse geocoding)
   * @param lat - Latitude
   * @param lng - Longitude
   * @returns Formatted address string
   */
  async reverseGeocode(lat: number, lng: number): Promise<string> {
    try {
      const url = `${NOMINATIM_BASE_URL}/reverse?format=json&lat=${lat}&lon=${lng}`;

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'UnexplainedArchive/1.0'
        }
      });

      if (!response.ok) {
        return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
      }

      const data = await response.json();

      if (data && data.display_name) {
        return data.display_name;
      }

      // Fallback to coordinates if reverse geocoding fails
      return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    } catch (error) {
      console.error('Reverse geocoding error:', error);
      return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    }
  },

  /**
   * Check if a string looks like coordinates (lat,lng format)
   * @param text - The text to check
   * @returns true if it looks like coordinates
   */
  isCoordinates(text: string): boolean {
    // Match patterns like: "58.5953, 25.0136" or "58.5953,25.0136"
    const coordPattern = /^-?\d+\.?\d*\s*,\s*-?\d+\.?\d*$/;
    return coordPattern.test(text.trim());
  },

  /**
   * Parse coordinate string to lat/lng object
   * @param coordString - String like "58.5953, 25.0136"
   * @returns Object with lat and lng, or null if invalid
   */
  parseCoordinates(coordString: string): { lat: number; lng: number } | null {
    try {
      const parts = coordString.split(',').map(s => s.trim());
      if (parts.length !== 2) return null;

      const lat = parseFloat(parts[0]);
      const lng = parseFloat(parts[1]);

      if (isNaN(lat) || isNaN(lng)) return null;
      if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;

      return { lat, lng };
    } catch {
      return null;
    }
  }
};
