import { z } from 'zod';
import {
  isEnabledLanguage,
  isLanguageCode,
  type ExperimentalLanguageCode,
  type LanguageCode,
} from '../languages/registry.js';

export function createSupportedLanguageSchema(
  enabledExperimentalLanguages: readonly ExperimentalLanguageCode[] = [],
) {
  return z.custom<LanguageCode>(
    (value) => isEnabledLanguage(value, enabledExperimentalLanguages),
    { message: 'Language is not enabled.' },
  );
}

export const supportedLanguageSchema = createSupportedLanguageSchema();

export const coordinatesSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

export function createChatRequestSchema(
  enabledExperimentalLanguages: readonly ExperimentalLanguageCode[] = [],
) {
  return z.object({
    message: z.string().trim().min(1).max(1000),
    language: createSupportedLanguageSchema(enabledExperimentalLanguages),
    location: coordinatesSchema.optional(),
  });
}

export const chatRequestSchema = createChatRequestSchema();

export const chatResponseSchema = z.object({
  requestId: z.string().min(1),
  answer: z.string().min(1),
  language: z.custom<LanguageCode>(isLanguageCode),
  source: z.literal('groq'),
  sources: z.array(z.object({
    provider: z.literal('open-meteo'),
    attribution: z.literal('Weather data by Open-Meteo.com'),
    fetchedAt: z.string().datetime(),
    timezone: z.string().min(1),
  })).optional(),
});

export type ChatRequest = z.infer<ReturnType<typeof createChatRequestSchema>>;
export type ChatResponse = z.infer<typeof chatResponseSchema>;
export type Coordinates = z.infer<typeof coordinatesSchema>;
