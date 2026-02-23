/**
 * app.js — StarGazer main application
 */

(async function() {
  'use strict';

  const $ = id => document.getElementById(id);

  // ─── Default Location (Kitchener, ON) ─────────────────────
  const DEFAULT_LAT = 43.4516;
  const DEFAULT_LON = -80.4925;

  let lat, lon, locationName;

  // ─── Screen Management ────────────────────────────────────
  function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    $(id).classList.add('active');
  }

  function showError(title, msg) {
    $('errorTitle').textContent = title;
    $('errorMsg').textContent = msg;
    showScreen('error');
  }

  // ─── Get Location ─────────────────────────────────────────
  async function getLocation() {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        console.log('Geolocation not available, using default (Kitchener)');
        resolve({ lat: DEFAULT_LAT, lon: DEFAULT_LON });
        return;
      }

      // Safety timeout in case geolocation hangs
      const fallbackTimer = setTimeout(() => {
        console.log('Geolocation timed out, using default (Kitchener)');
        resolve({ lat: DEFAULT_LAT, lon: DEFAULT_LON });
      }, 10000);

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          clearTimeout(fallbackTimer);
          resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude });
        },
        (err) => {
          clearTimeout(fallbackTimer);
          console.log('Geolocation denied/failed:', err.message, '— using default (Kitchener)');
          resolve({ lat: DEFAULT_LAT, lon: DEFAULT_LON });
        },
        { timeout: 8000, enableHighAccuracy: false }
      );
    });
  }

  // ─── Format Time ──────────────────────────────────────────
  function fmt(date) {
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  }

  function fmtHour(date) {
    return date.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true });
  }

  function fmtDay(date) {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return days[date.getDay()];
  }

  // ─── Render Tonight Card ──────────────────────────────────
  function renderTonight(tonightScore, sunTimes, moon, currentHour) {
    const rating = Astronomy.getRating(tonightScore);

    const badge = $('ratingBadge');
    badge.textContent = rating.short;
    badge.className = `rating-badge ${rating.cls}`;

    $('ratingLabel').textContent = rating.label;

    const details = $('tonightDetails');
    details.innerHTML = `
      <div class="detail-item">
        <span class="detail-label">Sunset</span>
        <span class="detail-value">${sunTimes.sunset ? fmt(sunTimes.sunset) : '—'}</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">Sunrise</span>
        <span class="detail-value">${sunTimes.sunrise ? fmt(sunTimes.sunrise) : '—'}</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">Moon</span>
        <span class="detail-value">${moon.emoji} ${moon.illumination}%</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">Darkness</span>
        <span class="detail-value">${sunTimes.astroDusk ? fmt(sunTimes.astroDusk) : fmt(sunTimes.civilDusk || sunTimes.sunset)}</span>
      </div>
    `;
  }

  // ─── Render Best Window ───────────────────────────────────
  function renderBestWindow(nightHours) {
    if (!nightHours.length) {
      $('windowTime').textContent = 'No clear window tonight';
      $('windowReason').textContent = 'Check back tomorrow';
      return;
    }

    // Find the best consecutive window
    let bestStart = 0, bestLen = 1, bestAvg = nightHours[0].score;
    let curStart = 0, curLen = 1;

    for (let i = 1; i < nightHours.length; i++) {
      if (nightHours[i].score >= 40 && nightHours[i - 1].score >= 40) {
        curLen++;
      } else {
        curStart = i;
        curLen = 1;
      }

      if (curLen > bestLen || (curLen === bestLen && nightHours[i].score > bestAvg)) {
        bestStart = curStart;
        bestLen = curLen;
        bestAvg = nightHours[i].score;
      }
    }

    const best = nightHours[bestStart];
    const bestEnd = nightHours[Math.min(bestStart + bestLen, nightHours.length - 1)];

    if (best.score < 30) {
      $('windowTime').textContent = 'No good window tonight';
      $('windowReason').textContent = `Best score is only ${best.score}/100 — too cloudy`;
    } else {
      $('windowTime').textContent = `${fmtHour(best.time)} — ${fmtHour(bestEnd.time)}`;
      $('windowReason').textContent = `${bestLen}h window · ${best.cloudCover}% clouds · Score: ${best.score}/100`;
    }
  }

  // ─── Render Current Conditions ────────────────────────────
  function renderConditions(currentHour, moon) {
    const grid = $('conditionsGrid');
    grid.innerHTML = `
      <div class="condition-item">
        <div class="condition-icon">${Astronomy.getCloudIcon(currentHour.cloudCover, true)}</div>
        <div class="condition-value">${currentHour.cloudCover}%</div>
        <div class="condition-label">Cloud Cover</div>
      </div>
      <div class="condition-item">
        <div class="condition-icon">💧</div>
        <div class="condition-value">${currentHour.humidity}%</div>
        <div class="condition-label">Humidity</div>
      </div>
      <div class="condition-item">
        <div class="condition-icon">🌡</div>
        <div class="condition-value">${Math.round(currentHour.temp)}°C</div>
        <div class="condition-label">Temperature</div>
      </div>
      <div class="condition-item">
        <div class="condition-icon">💨</div>
        <div class="condition-value">${Math.round(currentHour.windSpeed)}</div>
        <div class="condition-label">Wind km/h</div>
      </div>
      <div class="condition-item">
        <div class="condition-icon">👁</div>
        <div class="condition-value">${currentHour.visibility.toFixed(0)}</div>
        <div class="condition-label">Visibility km</div>
      </div>
      <div class="condition-item">
        <div class="condition-icon">🌧</div>
        <div class="condition-value">${currentHour.precipProb}%</div>
        <div class="condition-label">Rain Chance</div>
      </div>
    `;
  }

  // ─── Render Moon Card ─────────────────────────────────────
  function renderMoon(moon) {
    $('moonVisual').textContent = moon.emoji;
    $('moonInfo').innerHTML = `
      <h3>${moon.name}</h3>
      <p>${moon.illumination < 25 ? 'Low moonlight — great for stars!' :
          moon.illumination < 50 ? 'Moderate moonlight — decent viewing' :
          moon.illumination < 75 ? 'Bright moon — brighter stars still visible' :
          'Very bright moon — only brightest objects visible'}</p>
      <span class="moon-illumination">☾ ${moon.illumination}% illuminated</span>
    `;
  }

  // ─── Render Hourly Forecast ───────────────────────────────
  function renderHourly(nightHours, moon) {
    const container = $('hourlyForecast');
    container.innerHTML = '';

    nightHours.forEach(h => {
      const scoreClass = h.score >= 70 ? 'great' : h.score >= 50 ? 'ok' : h.score >= 30 ? 'meh' : 'no';
      const scoreLabel = h.score >= 70 ? 'Great' : h.score >= 50 ? 'Good' : h.score >= 30 ? 'Meh' : 'Skip';

      const el = document.createElement('div');
      el.className = 'hour-item';
      el.innerHTML = `
        <div class="hour-time">${fmtHour(h.time)}</div>
        <div class="hour-icon">${Astronomy.getCloudIcon(h.cloudCover, true)}</div>
        <div class="hour-cloud">${h.cloudCover}%</div>
        <div class="hour-temp">${Math.round(h.temp)}°C</div>
        <div class="hour-score ${scoreClass}">${scoreLabel}</div>
      `;
      container.appendChild(el);
    });

    if (!nightHours.length) {
      container.innerHTML = '<div style="padding:20px;color:var(--text-dim);">No nighttime hours in forecast yet.</div>';
    }
  }

  // ─── Render 7-Day Outlook ─────────────────────────────────
  function renderOutlook(hours, days, moon) {
    const container = $('outlookList');
    container.innerHTML = '';

    days.forEach((day, i) => {
      // Get night hours for this day (sunset to next sunrise)
      const nightStart = day.sunset;
      const nightEnd = i + 1 < days.length ? days[i + 1].sunrise : new Date(day.sunrise.getTime() + 86400000);

      const nightHours = hours.filter(h =>
        h.time >= nightStart && h.time <= nightEnd
      );

      // Average score for the night
      let avgScore = 0;
      let avgCloud = 0;
      if (nightHours.length) {
        const futureMoon = Astronomy.getMoonPhase(day.date);
        nightHours.forEach(h => {
          h.score = Astronomy.scoreHour({
            cloudCover: h.cloudCover,
            humidity: h.humidity,
            visibility: h.visibility,
            windSpeed: h.windSpeed,
            isNight: true,
            moonIllumination: futureMoon.illumination,
          });
          avgCloud += h.cloudCover;
        });
        avgScore = Math.round(nightHours.reduce((s, h) => s + h.score, 0) / nightHours.length);
        avgCloud = Math.round(avgCloud / nightHours.length);
      }

      const rating = Astronomy.getRating(avgScore);
      const barColor = avgScore >= 75 ? 'var(--green)' :
                       avgScore >= 55 ? 'var(--blue)' :
                       avgScore >= 35 ? 'var(--orange)' : 'var(--red)';

      const el = document.createElement('div');
      el.className = 'outlook-item';
      el.innerHTML = `
        <div class="outlook-day">${i === 0 ? 'Ton.' : fmtDay(day.date)}</div>
        <div class="outlook-icon">${Astronomy.getCloudIcon(avgCloud, true)}</div>
        <div class="outlook-bar-container">
          <div class="outlook-bar" style="width:${avgScore}%;background:${barColor}"></div>
        </div>
        <div class="outlook-score" style="color:${barColor}">${avgScore}</div>
        <div class="outlook-clouds">☁ ${avgCloud}%</div>
      `;
      container.appendChild(el);
    });
  }

  // ─── Main Init ────────────────────────────────────────────
  async function init() {
    showScreen('loading');

    try {
      // Get location
      const pos = await getLocation();
      lat = pos.lat;
      lon = pos.lon;

      // Fetch data in parallel
      const [forecast, cityName] = await Promise.all([
        Weather.fetchForecast(lat, lon),
        Weather.reverseGeocode(lat, lon),
      ]);

      locationName = cityName;
      $('locationText').textContent = `📍 ${locationName}`;
      $('updatedText').textContent = `Updated: ${new Date().toLocaleTimeString()}`;

      // Parse data
      const hours = Weather.parseHourly(forecast);
      const days = Weather.parseDaily(forecast);
      const moon = Astronomy.getMoonPhase(new Date());
      const now = new Date();

      // Sun times for today
      const sunTimes = Astronomy.getSunTimes(now, lat, lon);

      // Find current hour in forecast
      const currentIdx = hours.findIndex(h => h.time > now) - 1;
      const currentHour = hours[Math.max(0, currentIdx)];

      // Tonight's night hours (sunset to next sunrise)
      const todayIdx = days.findIndex(d =>
        d.date.toDateString() === now.toDateString()
      );

      const tonight = days[todayIdx] || days[0];
      const tomorrowSunrise = days[todayIdx + 1] ? days[todayIdx + 1].sunrise : new Date(now.getTime() + 86400000);

      const nightHours = hours.filter(h =>
        h.time >= tonight.sunset && h.time <= tomorrowSunrise
      );

      // Score each night hour
      nightHours.forEach(h => {
        h.score = Astronomy.scoreHour({
          cloudCover: h.cloudCover,
          humidity: h.humidity,
          visibility: h.visibility,
          windSpeed: h.windSpeed,
          isNight: true,
          moonIllumination: moon.illumination,
        });
      });

      // Overall tonight score (average of top hours)
      const tonightScore = nightHours.length
        ? Math.round(nightHours.reduce((s, h) => s + h.score, 0) / nightHours.length)
        : 0;

      // Render everything
      renderTonight(tonightScore, { ...sunTimes, ...tonight }, moon, currentHour);
      renderBestWindow(nightHours);
      renderConditions(currentHour, moon);
      renderMoon(moon);
      renderHourly(nightHours, moon);
      renderOutlook(hours, days, moon);

      showScreen('main');

    } catch (err) {
      console.error('StarGazer error:', err);
      // Retry once with default location if first attempt fails
      try {
        console.log('Retrying with default location...');
        lat = DEFAULT_LAT;
        lon = DEFAULT_LON;
        const [forecast2, cityName2] = await Promise.all([
          Weather.fetchForecast(lat, lon),
          Promise.resolve('Kitchener'),
        ]);
        locationName = cityName2;
        $('locationText').textContent = `📍 ${locationName} (default)`;
        $('updatedText').textContent = `Updated: ${new Date().toLocaleTimeString()}`;
        const hours = Weather.parseHourly(forecast2);
        const days = Weather.parseDaily(forecast2);
        const moon = Astronomy.getMoonPhase(new Date());
        const now = new Date();
        const sunTimes = Astronomy.getSunTimes(now, lat, lon);
        const currentIdx = hours.findIndex(h => h.time > now) - 1;
        const currentHour = hours[Math.max(0, currentIdx)];
        const todayIdx = days.findIndex(d => d.date.toDateString() === now.toDateString());
        const tonight = days[todayIdx] || days[0];
        const tomorrowSunrise = days[todayIdx + 1] ? days[todayIdx + 1].sunrise : new Date(now.getTime() + 86400000);
        const nightHours = hours.filter(h => h.time >= tonight.sunset && h.time <= tomorrowSunrise);
        nightHours.forEach(h => {
          h.score = Astronomy.scoreHour({ cloudCover: h.cloudCover, humidity: h.humidity, visibility: h.visibility, windSpeed: h.windSpeed, isNight: true, moonIllumination: moon.illumination });
        });
        const tonightScore = nightHours.length ? Math.round(nightHours.reduce((s, h) => s + h.score, 0) / nightHours.length) : 0;
        renderTonight(tonightScore, { ...sunTimes, ...tonight }, moon, currentHour);
        renderBestWindow(nightHours);
        renderConditions(currentHour, moon);
        renderMoon(moon);
        renderHourly(nightHours, moon);
        renderOutlook(hours, days, moon);
        showScreen('main');
      } catch (err2) {
        console.error('StarGazer retry also failed:', err2);
        showError('Failed to load', err.message || 'Could not fetch weather data. Check your connection.');
      }
    }
  }

  // ─── Event Listeners ──────────────────────────────────────
  $('refreshBtn').addEventListener('click', () => init());
  $('retryBtn').addEventListener('click', () => init());

  // Go!
  init();

})();
