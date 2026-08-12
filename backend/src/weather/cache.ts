import type { Coordinates } from '../schemas/chat.js';
import type { WeatherForecast, WeatherProvider } from './types.js';

interface CacheEntry {
  expiresAt: number;
  forecast: WeatherForecast;
}

export function createCachedWeatherProvider(provider: WeatherProvider, ttlSeconds: number): WeatherProvider {
  const cache = new Map<string, CacheEntry>();

  return {
    async getForecast(coordinates: Coordinates): Promise<WeatherForecast> {
      const key = `${coordinates.latitude.toFixed(3)},${coordinates.longitude.toFixed(3)}`;
      const existingEntry = cache.get(key);
      const now = Date.now();

      if (existingEntry && existingEntry.expiresAt > now) {
        return existingEntry.forecast;
      }

      const forecast = await provider.getForecast(coordinates);
      cache.set(key, {
        forecast,
        expiresAt: now + ttlSeconds * 1000,
      });

      return forecast;
    },
  };
}
