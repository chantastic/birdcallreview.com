import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const episodes = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/episodes' }),
  schema: z.object({
    title: z.string(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    audio: z.string(),
    bytes: z.number().int().positive(),
    duration: z.number().int().positive(),
    originalAudio: z.string().url(),
    /** Optional display names for transcript labels, keyed by the raw speaker string. */
    speakers: z.record(z.string(), z.string()).optional(),
  }),
});

export const collections = { episodes };
