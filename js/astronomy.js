/**
 * astronomy.js — Moon phase, sun times, and stargazing score calculations
 * No external dependencies.
 */

const Astronomy = (() => {

  // ─── Sun Calculations (simplified) ───────────────────────────
  function toJulianDay(date) {
    return date.getTime() / 86400000 + 2440587.5;
  }

  function toRadians(deg) { return deg * Math.PI / 180; }
  function toDegrees(rad) { return rad * 180 / Math.PI; }

  /**
   * Calculate sunrise and sunset for a given date and location.
   * Returns { sunrise: Date, sunset: Date, civilDusk: Date, civilDawn: Date }
   */
  function getSunTimes(date, lat, lon) {
    const J0 = 0.0009;
    const d = new Date(date);
    d.setHours(12, 0, 0, 0);

    const jd = toJulianDay(d);
    const n = Math.round(jd - 2451545.0 - J0 - lon / 360);
    const jStar = 2451545.0 + J0 + lon / 360 + n;

    // Mean solar anomaly
    const M = (357.5291 + 0.98560028 * (jStar - 2451545.0)) % 360;
    const Mrad = toRadians(M);

    // Equation of center
    const C = 1.9148 * Math.sin(Mrad) + 0.02 * Math.sin(2 * Mrad) + 0.0003 * Math.sin(3 * Mrad);

    // Ecliptic longitude
    const lambda = (M + C + 180 + 102.9372) % 360;
    const lambdaRad = toRadians(lambda);

    // Solar transit
    const jTransit = jStar + 0.0053 * Math.sin(Mrad) - 0.0069 * Math.sin(2 * lambdaRad);

    // Declination
    const sinDec = Math.sin(lambdaRad) * Math.sin(toRadians(23.4397));
    const cosDec = Math.cos(Math.asin(sinDec));

    function hourAngle(elevation) {
      const cosH = (Math.sin(toRadians(elevation)) - Math.sin(toRadians(lat)) * sinDec) /
                   (Math.cos(toRadians(lat)) * cosDec);
      if (cosH > 1 || cosH < -1) return null;
      return toDegrees(Math.acos(cosH));
    }

    const haSunrise = hourAngle(-0.833);   // Standard sunrise/sunset
    const haCivil = hourAngle(-6);         // Civil twilight
    const haAstro = hourAngle(-18);        // Astronomical twilight

    function jdToDate(jd) {
      return new Date((jd - 2440587.5) * 86400000);
    }

    const result = {};

    if (haSunrise !== null) {
      const jSet = jTransit + haSunrise / 360;
      const jRise = jTransit - haSunrise / 360;
      result.sunrise = jdToDate(jRise);
      result.sunset = jdToDate(jSet);
    }

    if (haCivil !== null) {
      result.civilDawn = jdToDate(jTransit - haCivil / 360);
      result.civilDusk = jdToDate(jTransit + haCivil / 360);
    }

    if (haAstro !== null) {
      result.astroDawn = jdToDate(jTransit - haAstro / 360);
      result.astroDusk = jdToDate(jTransit + haAstro / 360);
    }

    result.solarNoon = jdToDate(jTransit);
    return result;
  }

  // ─── Moon Phase ──────────────────────────────────────────────
  /**
   * Returns { phase, illumination, name, emoji }
   * phase: 0-1 (0=new, 0.5=full)
   */
  function getMoonPhase(date) {
    // Known new moon: Jan 6, 2000 18:14 UTC
    const knownNew = new Date('2000-01-06T18:14:00Z');
    const synodicMonth = 29.53058867;

    const daysSinceNew = (date.getTime() - knownNew.getTime()) / 86400000;
    const phase = ((daysSinceNew % synodicMonth) + synodicMonth) % synodicMonth / synodicMonth;

    // Illumination (approximate)
    const illumination = Math.round((1 - Math.cos(phase * 2 * Math.PI)) / 2 * 100);

    let name, emoji;
    if (phase < 0.0625)      { name = 'New Moon';         emoji = '🌑'; }
    else if (phase < 0.1875) { name = 'Waxing Crescent';  emoji = '🌒'; }
    else if (phase < 0.3125) { name = 'First Quarter';    emoji = '🌓'; }
    else if (phase < 0.4375) { name = 'Waxing Gibbous';   emoji = '🌔'; }
    else if (phase < 0.5625) { name = 'Full Moon';         emoji = '🌕'; }
    else if (phase < 0.6875) { name = 'Waning Gibbous';   emoji = '🌖'; }
    else if (phase < 0.8125) { name = 'Last Quarter';     emoji = '🌗'; }
    else if (phase < 0.9375) { name = 'Waning Crescent';  emoji = '🌘'; }
    else                     { name = 'New Moon';          emoji = '🌑'; }

    return { phase, illumination, name, emoji };
  }

  // ─── Stargazing Score ────────────────────────────────────────
  /**
   * Score a given hour for stargazing (0-100).
   * Inputs: cloudCover (0-100), humidity (0-100), visibility (km),
   *         windSpeed (km/h), isNight (bool), moonIllumination (0-100)
   */
  function scoreHour({ cloudCover, humidity, visibility, windSpeed, isNight, moonIllumination }) {
    if (!isNight) return 0;

    let score = 100;

    // Cloud cover is the #1 factor (0-100, lower is better)
    if (cloudCover > 80) score -= 70;
    else if (cloudCover > 60) score -= 50;
    else if (cloudCover > 40) score -= 30;
    else if (cloudCover > 20) score -= 15;
    else score -= cloudCover * 0.3;

    // Moon brightness hurts (but less than clouds)
    score -= moonIllumination * 0.15;

    // Humidity affects transparency
    if (humidity > 90) score -= 15;
    else if (humidity > 70) score -= 8;
    else if (humidity > 50) score -= 3;

    // Wind: moderate is actually OK (prevents fog), but strong is bad
    if (windSpeed > 40) score -= 15;
    else if (windSpeed > 25) score -= 5;

    // Visibility
    if (visibility < 5) score -= 20;
    else if (visibility < 10) score -= 10;

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  /**
   * Get rating label and class from score.
   */
  function getRating(score) {
    if (score >= 75) return { label: 'Excellent — Get outside!', cls: 'excellent', short: 'A+' };
    if (score >= 55) return { label: 'Good — Worth a look', cls: 'good', short: 'B' };
    if (score >= 35) return { label: 'Fair — Some stars visible', cls: 'fair', short: 'C' };
    return { label: 'Poor — Try another night', cls: 'poor', short: 'D' };
  }

  /**
   * Get weather icon for cloud cover.
   */
  function getCloudIcon(cloudCover, isNight) {
    if (cloudCover < 10) return isNight ? '🌟' : '☀️';
    if (cloudCover < 30) return isNight ? '✨' : '🌤';
    if (cloudCover < 60) return isNight ? '🌥' : '⛅';
    if (cloudCover < 85) return '☁️';
    return '🌧';
  }

  return { getSunTimes, getMoonPhase, scoreHour, getRating, getCloudIcon };
})();
