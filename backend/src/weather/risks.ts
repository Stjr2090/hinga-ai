import type { WeatherForecast, WeatherRisk } from './types.js';

export function evaluateWeatherRisks(forecast: WeatherForecast): WeatherRisk[] {
  const risks: WeatherRisk[] = [];
  const today = forecast.daily[0];

  if (!today) {
    return risks;
  }

  if (today.precipitationMillimeters >= 20) {
    risks.push({ code: 'HEAVY_RAIN', severity: 'high', value: today.precipitationMillimeters, unit: 'mm' });
  } else if (today.precipitationProbabilityPercent >= 60 || today.precipitationMillimeters >= 5) {
    risks.push({
      code: 'RAIN',
      severity: 'medium',
      value: Math.max(today.precipitationProbabilityPercent, today.precipitationMillimeters),
      unit: today.precipitationProbabilityPercent >= 60 ? 'percent' : 'mm',
    });
  }

  if (today.maximumTemperatureCelsius >= 32) {
    risks.push({ code: 'HEAT', severity: 'medium', value: today.maximumTemperatureCelsius, unit: 'celsius' });
  }

  if (today.maximumWindGustKilometersPerHour >= 40 || today.maximumWindSpeedKilometersPerHour >= 30) {
    risks.push({
      code: 'STRONG_WIND',
      severity: 'medium',
      value: Math.max(today.maximumWindGustKilometersPerHour, today.maximumWindSpeedKilometersPerHour),
      unit: 'km/h',
    });
  }

  const totalForecastRain = forecast.daily.reduce((total, day) => total + day.precipitationMillimeters, 0);

  if (forecast.daily.length >= 3 && totalForecastRain < 2) {
    risks.push({ code: 'DRY_CONDITIONS', severity: 'low', value: totalForecastRain, unit: 'mm' });
  }

  return risks;
}
