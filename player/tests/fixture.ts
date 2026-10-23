import { readFileSync } from "node:fs";
import { buildAtlas } from "../../skills/atlas-briefing/scripts/build.mjs";
import type { Atlas } from "../shared/types";

export const ycCollection = () => JSON.parse(readFileSync(new URL("../../atlases/yc-2026/collection.json", import.meta.url), "utf8"));
export const yc = (): Atlas => buildAtlas(ycCollection()).atlas as Atlas;
