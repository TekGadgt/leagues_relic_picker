import { defineCollection, z } from 'astro:content';

const itemSchema = z.object({
  id: z.string(),
  src: z.string(),
  relicLabel: z.string().optional(),
  title: z.string().optional(),
  toolTipItems: z.array(z.string()).default([]),
});

const leagueCollection = defineCollection({
  type: 'data',
  schema: z.object({
    game: z.enum(['osrs', 'rs3']),
    leagueNumber: z.number(),
    name: z.string(),
    pageType: z.enum(['relics', 'masteries', 'pacts']),
    layout: z.enum(['columns', 'rows']),
    isRs3: z.boolean().default(false),
    backgroundColor: z.string(),
    exportFilename: z.string(),
    meta: z.object({
      title: z.string(),
      description: z.string(),
      ogImage: z.string(),
      ogImageAlt: z.string(),
      url: z.string(),
    }),
    theme: z.object({
      titleColor: z.string(),
      navItemColor: z.string(),
      headerBackgroundColor: z.string(),
      backgroundColor: z.string(),
    }),
    items: z.record(z.string(), z.array(itemSchema)),
  }),
});

export const collections = {
  leagues: leagueCollection,
};
