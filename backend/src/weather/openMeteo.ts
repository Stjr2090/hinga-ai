import { z } from 'zod';
import type { Coordinates } from '../schemas/chat.js';
import { WeatherProviderError, type WeatherForecast, type WeatherProvider } from './types.js';

const openMeteoResponseSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
  timezone: z.string().min(1),
  current: z.object({
    time: z.string().min(1),
    temperature_2m: z.number(),
    precipitation: z.number(),
    rain: z.number(),
    weather_code: z.number(),
    wind_speed_10m: z.number(),
    wind_gusts_10m: z.number(),
  }),
  daily: z.object({
    time: z.array(z.string()),
    temperature_2m_max: z.array(z.number()),
    temperature_2m_min: z.array(z.number()),
    precipitation_sum: z.array(z.number()),
    precipitation_probability_max: z.array(z.number()),
    wind_speed_10m_max: z.array(z.number()),
    wind_gusts_10m_max: z.array(z.number()),
  }),
});

export interface OpenMeteoOptions {
  baseUrl: string;
  timeoutMilliseconds: number;
  fetchImplementation?: typeof fetch;
}

export function createOpenMeteoProvider(options: OpenMeteoOptions): WeatherProvider {
  const fetchImplementation = options.fetchImplementation ?? fetch;

  return {
    async getForecast(coordinates: Coordinates): Promise<WeatherForecast> {
      const url = new URL(`${options.baseUrl}/forecast`);
      url.searchParams.set('latitude', coordinates.latitude.toString());
      url.searchParams.set('longitude', coordinates.longitude.toString());
      url.searchParams.set('current', 'temperature_2m,precipitation,rain,weather_code,wind_speed_10m,wind_gusts_10m');
      url.searchParams.set('daily', 'temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,wind_gusts_10m_max');
      url.searchParams.set('forecast_days', '3');
      url.searchParams.set('timezone', 'auto');

      let response: Response;

      try {
        response = await fetchImplementation(url, {
          headers: { accept: 'application/json' },
          signal: AbortSignal.timeout(options.timeoutMilliseconds),
        });
      } catch (error) {
        const code = error instanceof DOMException && error.name === 'TimeoutError' ? 'TIMEOUT' : 'UPSTREAM_ERROR';
        throw new WeatherProviderError(code, 'Open-Meteo request failed.');
      }

      if (!response.ok) {
        throw new WeatherProviderError('UPSTREAM_ERROR', `Open-Meteo returned ${response.status}.`);
      }

      const parsedResponse = openMeteoResponseSchema.safeParse(await response.json());

      if (!parsedResponse.success) {
        throw new WeatherProviderError('INVALID_RESPONSE', 'Open-Meteo returned an invalid response.');
      }

      const data = parsedResponse.data;
      const daily = data.daily.time.map((date, index) => ({
        date,
        minimumTemperatureCelsius: data.daily.temperature_2m_min[index],
        maximumTemperatureCelsius: data.daily.temperature_2m_max[index],
        precipitationMillimeters: data.daily.precipitation_sum[index],
        precipitationProbabilityPercent: data.daily.precipitation_probability_max[index],
        maximumWindSpeedKilometersPerHour: data.daily.wind_speed_10m_max[index],
        maximumWindGustKilometersPerHour: data.daily.wind_gusts_10m_max[index],
      }));

      if (daily.some((day) => Object.values(day).some((value) => value === undefined))) {
        throw new WeatherProviderError('INVALID_RESPONSE', 'Open-Meteo daily arrays are inconsistent.');
      }

      return {
        coordinates: {
          latitude: data.latitude,
          longitude: data.longitude,
        },
        timezone: data.timezone,
        fetchedAt: new Date().toISOString(),
        current: {
          observedAt: data.current.time,
          temperatureCelsius: data.current.temperature_2m,
          precipitationMillimeters: data.current.precipitation,
          rainMillimeters: data.current.rain,
          weatherCode: data.current.weather_code,
          windSpeedKilometersPerHour: data.current.wind_speed_10m,
          windGustKilometersPerHour: data.current.wind_gusts_10m,
        },
        daily,
        source: 'open-meteo',
        attribution: 'Weather data by Open-Meteo.com',
      };
    },
  };
}
