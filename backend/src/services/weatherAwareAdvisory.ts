import { evaluateWeatherRisks } from '../weather/risks.js';
import { WeatherProviderError, type WeatherProvider } from '../weather/types.js';
import {
  AdvisoryWeatherUnavailableError,
  type AdvisoryRequest,
  type AdvisoryService,
} from './advisory.js';

const weatherSensitiveTerms = [
  'weather',
  'rain',
  'forecast',
  'temperature',
  'heat',
  'wind',
  'dry',
  'drought',
  'storm',
  'flood',
  'plant',
  'sow',
  'irrigat',
  'water',
  'harvest',
  'spray',
];

export function isWeatherSensitiveQuestion(message: string): boolean {
  const normalizedMessage = message.toLowerCase();
  return weatherSensitiveTerms.some((term) => normalizedMessage.includes(term));
}

export function createWeatherAwareAdvisoryService(
  advisoryService: AdvisoryService,
  weatherProvider: WeatherProvider,
): AdvisoryService {
  return {
    async generate(request: AdvisoryRequest) {
      if (!request.location || !isWeatherSensitiveQuestion(request.message)) {
        return advisoryService.generate(request);
      }

      try {
        const forecast = await weatherProvider.getForecast(request.location);

        const advisory = await advisoryService.generate({
          ...request,
          weather: {
            forecast,
            risks: evaluateWeatherRisks(forecast),
          },
        });

        return {
          ...advisory,
          sources: [{
            provider: forecast.source,
            attribution: forecast.attribution,
            fetchedAt: forecast.fetchedAt,
            timezone: forecast.timezone,
          }],
        };
      } catch (error) {
        if (error instanceof WeatherProviderError) {
          throw new AdvisoryWeatherUnavailableError();
        }

        throw error;
      }
    },
  };
}
