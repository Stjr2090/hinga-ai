import type { Coordinates } from '../schemas/chat.js';
import type { WeatherForecast, WeatherProvider } from './types.js';

interface CacheEntry {
  expiresAt: number;
  forecast: WeatherForecast;
}

export function createCachedWeatherProvider(
  provider: WeatherProvider,
  ttlSeconds: number,
  maximumEntries = 250,
): WeatherProvider {
  const cache = new Map<string, CacheEntry>();

  return {
    async getForecast(coordinates: Coordinates): Promise<WeatherForecast> {
      const key = `${coordinates.latitude.toFixed(3)},${coordinates.longitude.toFixed(3)}`;
      const existingEntry = cache.get(key);
      const now = Date.now();

      if (existingEntry && existingEntry.expiresAt > now) {
        cache.delete(key);
        cache.set(key, existingEntry);
        return existingEntry.forecast;
      }

      const forecast = await provider.getForecast(coordinates);

      while (cache.size >= maximumEntries) {
        const oldestKey = cache.keys().next().value;
        if (oldestKey === undefined) break;
        cache.delete(oldestKey);
      }

      cache.set(key, {
        forecast,
        expiresAt: now + ttlSeconds * 1000,
      });

      return forecast;
    },
  };
}
