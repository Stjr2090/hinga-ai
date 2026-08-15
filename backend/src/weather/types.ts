import type { Coordinates } from '../schemas/chat.js';

export interface CurrentWeather {
  observedAt: string;
  temperatureCelsius: number;
  precipitationMillimeters: number;
  rainMillimeters: number;
  weatherCode: number;
  windSpeedKilometersPerHour: number;
  windGustKilometersPerHour: number;
}

export interface DailyWeather {
  date: string;
  minimumTemperatureCelsius: number;
  maximumTemperatureCelsius: number;
  precipitationMillimeters: number;
  precipitationProbabilityPercent: number;
  maximumWindSpeedKilometersPerHour: number;
  maximumWindGustKilometersPerHour: number;
}

export interface WeatherForecast {
  coordinates: Coordinates;
  timezone: string;
  fetchedAt: string;
  current: CurrentWeather;
  daily: DailyWeather[];
  source: 'open-meteo';
  attribution: 'Weather data by Open-Meteo.com';
}

export interface WeatherProvider {
  getForecast(coordinates: Coordinates, signal?: AbortSignal): Promise<WeatherForecast>;
}

export type WeatherRiskCode = 'HEAVY_RAIN' | 'RAIN' | 'HEAT' | 'STRONG_WIND' | 'DRY_CONDITIONS';

export interface WeatherRisk {
  code: WeatherRiskCode;
  severity: 'low' | 'medium' | 'high';
  value: number;
  unit: 'mm' | 'percent' | 'celsius' | 'km/h';
}

export class WeatherProviderError extends Error {
  readonly code: 'TIMEOUT' | 'UPSTREAM_ERROR' | 'INVALID_RESPONSE';

  constructor(code: WeatherProviderError['code'], message: string) {
    super(message);
    this.name = 'WeatherProviderError';
    this.code = code;
  }
}
