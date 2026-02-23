/**
 * weather.js — Open-Meteo API client (free, no API key needed)
 */

const Weather = (() => {

  const BASE_URL = 'https://api.open-meteo.com/v1/forecast';

  /**
   * Fetch hourly weather data for the next 3 days.
   * Returns raw API response.
   */
  async function fetchForecast(lat, lon) {
    const params = new URLSearchParams({
      latitude: lat.toFixed(4),
      longitude: lon.toFixed(4),
      hourly: [
        'temperature_2m',
        'relative_humidity_2m',
        'cloud_cover',
        'cloud_cover_low',
        'cloud_cover_mid',
        'cloud_cover_high',
        'visibility',
        'wind_speed_10m',
        'precipitation_probability',
        'weather_code',
      ].join(','),
      daily: [
        'sunrise',
        'sunset',
        'temperature_2m_max',
        'temperature_2m_min',
        'precipitation_probability_max',
      ].join(','),
      temperature_unit: 'celsius',
      wind_speed_unit: 'kmh',
      timezone: 'auto',
      forecast_days: 7,
    });

    const url = `${BASE_URL}?${params}`;
    const resp = await fetch(url);

    if (!resp.ok) {
      throw new Error(`Open-Meteo API error: ${resp.status} ${resp.statusText}`);
    }

    return resp.json();
  }

  /**
   * Parse hourly data into a usable array.
   */
  function parseHourly(data) {
    const h = data.hourly;
    const hours = [];

    for (let i = 0; i < h.time.length; i++) {
      hours.push({
        time: new Date(h.time[i]),
        temp: h.temperature_2m[i],
        humidity: h.relative_humidity_2m[i],
        cloudCover: h.cloud_cover[i],
        cloudLow: h.cloud_cover_low[i],
        cloudMid: h.cloud_cover_mid[i],
        cloudHigh: h.cloud_cover_high[i],
        visibility: h.visibility[i] / 1000, // m → km
        windSpeed: h.wind_speed_10m[i],
        precipProb: h.precipitation_probability[i],
        weatherCode: h.weather_code[i],
      });
    }

    return hours;
  }

  /**
   * Parse daily data.
   */
  function parseDaily(data) {
    const d = data.daily;
    const days = [];

    for (let i = 0; i < d.time.length; i++) {
      days.push({
        date: new Date(d.time[i]),
        sunrise: new Date(d.sunrise[i]),
        sunset: new Date(d.sunset[i]),
        tempMax: d.temperature_2m_max[i],
        tempMin: d.temperature_2m_min[i],
        precipProb: d.precipitation_probability_max[i],
      });
    }

    return days;
  }

  /**
   * Reverse geocode lat/lon to a city name using Open-Meteo geocoding.
   */
  async function reverseGeocode(lat, lon) {
    try {
      const resp = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=en`
      );
      const data = await resp.json();
      const addr = data.address || {};
      return addr.city || addr.town || addr.village || addr.county || 'Unknown location';
    } catch {
      return `${lat.toFixed(2)}°, ${lon.toFixed(2)}°`;
    }
  }

  return { fetchForecast, parseHourly, parseDaily, reverseGeocode };
})();
