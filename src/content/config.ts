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
  activeSrc: z.string().optional(),
  frame: z.string().optional(),
  activeFrame: z.string().optional(),
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

const leagueBaseSchema = z.object({
  game: z.enum(['osrs', 'rs3']),
  leagueNumber: z.number(),
  name: z.string(),
  pageType: z.enum(['relics', 'masteries', 'pacts']),
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
});

const gridLayoutSchema = leagueBaseSchema.extend({
  layout: z.enum(['columns', 'rows']),
  items: z.record(z.string(), z.array(itemSchema)),
  graph: pactGraphSchema.optional(),
});

const graphLayoutSchema = leagueBaseSchema.extend({
  layout: z.literal('graph'),
  items: z.record(z.string(), z.array(itemSchema)).default({}),
  graph: pactGraphSchema,
});

const leagueCollection = defineCollection({
  type: 'data',
  schema: z.union([graphLayoutSchema, gridLayoutSchema]),
});

export const collections = {
  leagues: leagueCollection,
};
