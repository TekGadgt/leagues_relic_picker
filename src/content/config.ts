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
  // Reloaded (OSRS) and Rejuvenated (RS3) let the player take one extra relic
  // from a tier below their own. Flagged in the data rather than matched by
  // name, since the two are named differently and sit at different tiers in
  // each league (osrs/5 t4, osrs/6 t7, rs3/1 t4, rs3/2 t6).
  grantsBonusPick: z.boolean().optional(),
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

// One region on the map. Geometry lives apart from this, in the generated
// shapes file keyed by the same id — see scripts/build-region-shapes.mjs.
const regionSchema = z.object({
  id: z.string(),
  name: z.string(),
  src: z.string(),
  // Unlocked without spending a choice on it. Rendered lit but not clickable.
  mandatory: z.boolean().default(false),
  toolTipItems: z.array(toolTipItemSchema).default([]),
});

/**
 * How many regions a player gets and in what order.
 *
 * Regions aren't grouped the way relic tiers are: one badge per region, and any
 * of the choosable ones can land in any slot. So the rules are expressed as
 * counted slots over a shared pool rather than as groups of items.
 */
const regionRulesSchema = z.object({
  /** Unlocked from the start, costing no choice. */
  starting: z.array(z.string()),
  /** Unlocked on a schedule but not chosen — Karamja, in Equilibrium. */
  forced: z.array(z.object({
    region: z.string(),
    slot: z.number(),
    tasks: z.number(),
  })).default([]),
  /** Free picks, in unlock order. A region can only be taken once. */
  choices: z.array(z.object({
    slot: z.number(),
    tasks: z.number(),
  })),
});

const leagueBaseSchema = z.object({
  game: z.enum(['osrs', 'rs3']),
  leagueNumber: z.number(),
  name: z.string(),
  pageType: z.enum(['relics', 'masteries', 'pacts', 'blessings', 'regions']),
  exportFilename: z.string(),
  derivedGroups: z.array(derivedGroupSchema).optional(),
  // Names a strategy in src/scripts/randomizer.ts. Absent means no Randomize
  // button, which is how past leagues stay untouched.
  randomizer: z.enum(['one-per-tier', 'regions']).optional(),
  // Offers a Copy Image Link button, backed by the share-image function.
  shareImage: z.boolean().optional(),
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

const mapLayoutSchema = leagueBaseSchema.extend({
  layout: z.literal('map'),
  items: z.record(z.string(), z.array(itemSchema)).default({}),
  regions: z.array(regionSchema),
  regionRules: regionRulesSchema,
  /** Key into src/data/*-region-shapes.json, resolved at build time. */
  shapes: z.string(),
});

const leagueCollection = defineCollection({
  type: 'data',
  schema: z.union([graphLayoutSchema, mapLayoutSchema, gridLayoutSchema]),
});

export const collections = {
  leagues: leagueCollection,
};
