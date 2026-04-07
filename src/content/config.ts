import { defineCollection, z } from 'astro:content';

const toolTipItemSchema = z.union([z.string(), z.array(z.string())]);

const itemSchema = z.object({
  id: z.string(),
  src: z.string(),
  relicLabel: z.string().optional(),
  title: z.string().optional(),
  toolTipItems: z.array(toolTipItemSchema).default([]),
});

const graphNodeSchema = z.object({
  id: z.string(),
  x: z.number(),
  y: z.number(),
  src: z.string(),
  pactLabel: z.string(),
  toolTipItems: z.array(toolTipItemSchema).default([]),
  size: z.enum(['sm', 'md', 'lg']).default('md'),
});

const graphEdgeSchema = z.object({
  id: z.string().optional(),
  from: z.string(),
  to: z.string(),
  style: z.enum(['default', 'red']).default('default'),
});

const pactGraphSchema = z.object({
  nodes: z.array(graphNodeSchema),
  edges: z.array(graphEdgeSchema),
});

const leagueCollection = defineCollection({
  type: 'data',
  schema: z.object({
    game: z.enum(['osrs', 'rs3']),
    leagueNumber: z.number(),
    name: z.string(),
    pageType: z.enum(['relics', 'masteries', 'pacts']),
    layout: z.enum(['columns', 'rows', 'graph']),
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
    graph: pactGraphSchema.optional(),
  }),
});

export const collections = {
  leagues: leagueCollection,
};
