// The generative-UI contract. Every answer, instant or Claude-written, is a Card
// built from this small kit of blocks, so the page never renders free-form HTML.
import { z } from "zod";

export const SourceSchema = z.object({
  title: z.string().max(200),
  url: z.string().url(),
});
export type Source = z.infer<typeof SourceSchema>;

const BarsBlock = z.object({
  type: z.literal("bars"),
  title: z.string().max(120),
  items: z.array(z.object({ label: z.string().max(80), value: z.number(), id: z.string().optional() })).max(12),
});
const ItemsBlock = z.object({
  type: z.literal("items"),
  title: z.string().max(120).optional(),
  items: z.array(z.object({ id: z.string(), note: z.string().max(200).optional() })).max(24),
});
const FactsBlock = z.object({
  type: z.literal("facts"),
  items: z
    .array(
      z.object({
        label: z.string().max(60),
        value: z.string().max(300),
        /** Index into Card.sources. Omitted means "from the atlas". */
        source: z.number().int().min(0).optional(),
      }),
    )
    .max(12),
});
const TextBlock = z.object({ type: z.literal("text"), text: z.string().max(1200) });

export const BlockSchema = z.discriminatedUnion("type", [BarsBlock, ItemsBlock, FactsBlock, TextBlock]);
export type Block = z.infer<typeof BlockSchema>;

export const CardSchema = z.object({
  summary: z.string().min(1).max(600),
  blocks: z.array(BlockSchema).max(6).default([]),
  sources: z.array(SourceSchema).max(10).default([]),
  /** Facts the viewer asked for that the atlas doesn't state. */
  notStated: z.array(z.string().max(120)).max(6).default([]),
  /** Item ids to light up on the map. */
  highlight: z.array(z.string()).max(80).default([]),
  /** Set when the honest answer needs the web. The page offers to note it for research. */
  needsWeb: z.string().max(200).optional(),
});
export type Card = z.infer<typeof CardSchema>;

export type AskEvent = { type: "step"; label: string } | { type: "card"; card: Card } | { type: "error"; message: string };
