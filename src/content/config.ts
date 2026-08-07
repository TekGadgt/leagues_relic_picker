import { defineCollection, z } from 'astro:content';

const toolTipItemSchema = z.union([z.string(), z.array(z.string())]);

const itemSchema = z.object({
  id: z.string(),
  src: z.string(),
  relicLabel: z.string().optional(),
  title: z.string().optional(),
  // Equilibrium League blessings belong to one of three paths. The path a
  // player picks most across a run of tiers decides their god-tier blessing.
  path: z.enum(['chaos', 'order', 'balance']).optional(),
  toolTipItems: z.array(toolTipItemSchema).default([]),
});

// A group whose selection is computed from the player's picks in other groups
// rather than chosen directly.
const derivedGroupSchema = z.object({
  group: z.string(),
  from: z.array(z.string()),
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
  pageType: z.enum(['relics', 'masteries', 'pacts', 'blessings']),
  exportFilename: z.string(),
  derivedGroups: z.array(derivedGroupSchema).optional(),
  meta: z.object({
    title: z.string(),
    description: z.string(),
    ogImage: z.string(),
    ogImageAlt: z.string(),
    url: z.string(),
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
