// The generative-UI contract. Every answer, local or model-written, is a Card
// built from this small kit of blocks, so the UI never renders free-form HTML.
import { z } from "zod";
import { TIERS } from "./tiers";
export { TIERS, TIER_INFO, type Tier } from "./tiers";

export const SourceSchema = z.object({
  title: z.string().max(200),
  url: z.string().url(),
  kind: z.enum(["yc", "company", "filing", "press", "other"]),
});
export type Source = z.infer<typeof SourceSchema>;

const BarsBlock = z.object({
  type: z.literal("bars"),
  title: z.string().max(120),
  items: z.array(z.object({ label: z.string().max(80), value: z.number(), slug: z.string().optional() })).max(12),
});
const CompaniesBlock = z.object({
  type: z.literal("companies"),
  title: z.string().max(120).optional(),
  items: z.array(z.object({ slug: z.string(), note: z.string().max(200).optional() })).max(24),
});
const FactsBlock = z.object({
  type: z.literal("facts"),
  items: z
    .array(
      z.object({
        label: z.string().max(60),
        value: z.string().max(300),
        /** Index into Card.sources. Omitted means "from the snapshot". */
        source: z.number().int().min(0).optional(),
      }),
    )
    .max(12),
});
const TextBlock = z.object({ type: z.literal("text"), text: z.string().max(1200) });

export const BlockSchema = z.discriminatedUnion("type", [BarsBlock, CompaniesBlock, FactsBlock, TextBlock]);
export type Block = z.infer<typeof BlockSchema>;

export const CardSchema = z.object({
  summary: z.string().min(1).max(600),
  tier: z.enum(TIERS),
  blocks: z.array(BlockSchema).max(6).default([]),
  sources: z.array(SourceSchema).max(10).default([]),
  /** Facts the viewer asked for that no permitted source states. */
  notStated: z.array(z.string().max(120)).max(6).default([]),
  /** Company slugs to light up on the map. */
  highlight: z.array(z.string()).max(60).default([]),
  /** Set when the honest answer needs the next tier up. The client asks before escalating. */
  needsWeb: z.string().max(200).optional(),
});
export type Card = z.infer<typeof CardSchema>;

/** Events streamed from /api/ask as newline-delimited JSON. */
export type AskEvent =
  | { type: "step"; label: string }
  | { type: "card"; card: Card }
  | { type: "error"; message: string };
