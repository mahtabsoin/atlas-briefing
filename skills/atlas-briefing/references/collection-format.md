# collection.json

One JSON file describes an atlas. `scripts/build.mjs` validates it, lays out the map and inlines it into the player. A full real example: `atlases/yc-2026/collection.json` in the Atlas Briefing repository (788 companies in four batches, with a batch filter).

## Minimal example

Items are cut to one for space; the counts in `overview` and `narration` assume all three.

```json
{
  "title": "YC Summer 2026",
  "noun": ["company", "companies"],
  "source": { "name": "YC company directory", "url": "https://www.ycombinator.com/companies?batch=Summer%202026", "checked": "2026-10-21" },
  "method": "A company joins a group only if its own YC one-liner contains a phrase that supports it.",
  "overview": "All 3 companies in YC Summer 2026. 2 fall into one group; the other 1 is shown in grey.",
  "facts": [
    { "key": "team", "label": "Team size", "type": "number", "unit": "people" },
    { "key": "location", "label": "Location", "type": "place" },
    { "key": "founders", "label": "Founders", "type": "text" }
  ],
  "groups": [
    {
      "id": "service-firms",
      "name": "AI-native service firms",
      "short": "Service firms",
      "rubric": "The company describes itself as the service provider rather than software sold to one.",
      "narration": "2 companies describe themselves as the service firm itself. Billow is an accounting firm. Peer is a freight brokerage."
    }
  ],
  "items": [
    {
      "id": "billow-ai-labs",
      "name": "Billow",
      "summary": "AI-native accounting firm.",
      "description": "Longer text from the source, optional.",
      "url": "https://www.ycombinator.com/companies/billow-ai-labs",
      "links": [{ "label": "Website", "url": "https://billow.example" }],
      "facts": { "team": 4, "location": "San Francisco, CA, USA", "founders": "A. Founder, B. Founder" },
      "tags": ["Fintech"],
      "group": "service-firms",
      "evidence": "accounting firm"
    }
  ]
}
```

## Fields

| Field | Required | Notes |
|---|---|---|
| `title` | yes | Shown as the page heading and artifact title. Two to four words. |
| `noun` | yes | `[singular, plural]`, used in copy and prompts. |
| `source` | yes | `name`, `url` (the collection's page at the official source), `checked` (date read). |
| `method` | yes | One sentence on how items were grouped. Shown when the viewer asks. |
| `overview` | yes | One or two sentences. Every number in it must be a real count: total, grouped, ungrouped, number of groups, or a group's size (years are ignored). |
| `facts` | no | Declares item facts. `type`: `number` (ranked, medians), `place` (counted by its first comma segment, so "San Francisco, CA" counts as "San Francisco"), `text` (shown only). `unit` is optional. The first `number` and first `place` fact drive the instant answers. |
| `filter` | no | `{ "key": "<a declared text fact>", "values": [...] }`, values in display order (e.g. batches oldest first). The viewer can switch the whole atlas to one value; group pages show how each group splits across them. Every item must carry one of the values. |
| `groups[]` | yes | `id`, `name`, `short` (map label, 18 characters or fewer), `rubric`, `narration`. Optional `center: [x, y]` in percent (5 to 95) to place the cluster by hand; otherwise clusters are spaced around the map. |
| `items[]` | yes | See below. |

### Items

| Field | Required | Notes |
|---|---|---|
| `id` | yes | Unique, stable. A slug from the source is ideal. |
| `name` | yes | |
| `summary` | yes | The source's own one-liner, verbatim. |
| `description` | no | Longer source text. |
| `url` | no | The item's page at the source. Cited by answers. |
| `links` | no | `[{label, url}]`, also citable. |
| `facts` | no | Keys must be declared in `facts`. `null` means not stated. |
| `tags` | no | Searchable. |
| `group` | no | A group `id`, or `null` for ungrouped. |
| `evidence` | no | Exact phrase from `summary` (case-insensitive) that supports the group. `null` on a grouped item marks a judgment call. |

## Checks the builder runs

Errors stop the build:
- a `filter` that names an undeclared or non-text fact, or an item whose value isn't in `filter.values`
- missing required fields, bad URLs, duplicate ids or group ids
- an item in an unknown group
- `evidence` not found in the item's `summary`
- a group `narration` that opens with a number other than the group's size
- an `overview` number that matches no count in the data
- a fact whose type doesn't match its declaration

Warnings don't: more than 12 groups, a long `short` label, an empty group, more than 600 items, undeclared facts.

## Sizing

The player is built for 50 to 600 items and 4 to 8 groups. Fewer than about 50 doesn't need a map. Past 600, add a `filter` (by batch, year, track) and up to 12 groups: the YC 2026 example holds 788 that way. Past about 1,200, split into several atlases.
