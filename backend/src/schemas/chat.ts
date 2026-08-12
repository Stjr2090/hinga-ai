import { z } from 'zod';

export const supportedLanguageSchema = z.enum(['en', 'lg', 'sw']);

export const coordinatesSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

export const chatRequestSchema = z.object({
  message: z.string().trim().min(1).max(1000),
  language: supportedLanguageSchema,
  location: coordinatesSchema.optional(),
});

export const chatResponseSchema = z.object({
  requestId: z.string().min(1),
  answer: z.string().min(1),
  language: supportedLanguageSchema,
  source: z.enum(['mock', 'groq']),
  sources: z.array(z.object({
    provider: z.literal('open-meteo'),
    attribution: z.literal('Weather data by Open-Meteo.com'),
    fetchedAt: z.string().datetime(),
    timezone: z.string().min(1),
  })).optional(),
});

export type ChatRequest = z.infer<typeof chatRequestSchema>;
export type ChatResponse = z.infer<typeof chatResponseSchema>;
export type Coordinates = z.infer<typeof coordinatesSchema>;
