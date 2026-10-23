# When an atlas works, and when it doesn't

An atlas answers one question well: **"What's in this collection, and how does it cluster?"** It suits a reader who needs the lay of the land fast, then wants to dig into a few things. Use this guide in the intent step: if the request is a poor fit, say so and suggest the better format.

## The shape of a good fit

All five should hold:

| Test | Why it matters |
|---|---|
| **A bounded collection** of 50 to 600 comparable things | Under ~50, a table or memo is quicker. Up to ~1,200 works with a filter (by batch, year or track); beyond that, split it. |
| **One official source lists them all** | The atlas is a snapshot of a record. No record, no trustworthy counts. |
| **Each item has a self-description** (a one-liner, an abstract, a stated purpose) | Grouping evidence is quoted from it. Without one, every placement is a judgment call. |
| **The items fall into 4 to 12 kinds** a stranger could name | That's what the map and the pages show. Fewer is one list; more doesn't fit a screen. |
| **The reader cares about the spread**, not one item | If they already know which item they want, search beats a map. |

## Good fits

| Collection | Source of record | Self-description | A typical `number` / `place` fact |
|---|---|---|---|
| A startup accelerator batch | The accelerator's directory | Company one-liner | Team size / city |
| A conference programme | The official schedule | Talk abstract | Session length / track room or city |
| Grant or prize awards | The funder's award list | Project summary | Award amount / institution's country |
| Bills introduced in a session | The legislature's site | Official short title and summary | Co-sponsors / sponsor's state |
| Clinical trials for a condition | A trial registry (e.g. ClinicalTrials.gov) | Brief summary | Enrolment / lead site country |
| An open-source ecosystem | The registry or org (e.g. a package index, a GitHub org) | Package or repo description | Stars or downloads / (none) |
| Exhibitors or vendors at an event | The exhibitor list | Exhibitor blurb | Booth size / home country |
| Public companies in an index or sector | Exchange or regulator filings | Business description from the filing | Employees or revenue / headquarters |
| Job postings at one organisation | Its careers page | Role summary | (none) / office |

## Poor fits, and what to use instead

| Request | Why it fails | Better |
|---|---|---|
| "Everything about AI agents" | No boundary and no single source | Ask the user to name the collection, or write a research memo |
| A ranking question ("which 10 are best?") | Needs judgment the atlas refuses to make | A sourced comparison table |
| A timeline ("how did this evolve?") | The atlas is a snapshot, not a sequence | A timeline or chronology |
| One deep subject (a company, a person) | Nothing to cluster | A profile or memo |
| Items described only by others (press, reviews) | Evidence would be second-hand | A press digest with citations |
| Fast-changing data (prices, live metrics) | Stale the day it's built | A dashboard on the live source |
| Fewer than ~50 items | The map adds nothing | A table |

## Analysis that suits the format

What the page answers instantly, from the data alone:
- **Composition:** how many fall into each group, and which don't fit any.
- **Ranking by one stated number:** largest teams, biggest awards, most co-sponsors; medians by group.
- **Geography by one stated place:** where items are based, and which are outside the main hub.
- **Method:** how groups were drawn and how many placements are judgment calls.
- **Shifts across slices**, with a filter: how each group splits across batches or years (counts only, no trend claims).

What goes to the viewer's Claude chat (picks plus a question): comparisons inside or across groups, "which ones do X", summaries, and anything the source doesn't state (funding, news, outcomes, people's track records) or that happened after the snapshot date, which needs web research with citations.

What an atlas deliberately does not do: score, rank by quality, predict, or call trends. Narration reports what the source says and counts; the reader draws conclusions.

## Choosing sources

1. **Primary record first:** the organiser, registry, regulator or publisher that defines the collection. Record the exact URL and the date you read it.
2. **The item's own words** for `summary`, copied verbatim, never a paraphrase or a press description.
3. **Facts only where the source states them** for most items. A fact present for a third of items makes misleading medians; leave it out.
4. **Secondary sources** (press, databases, aggregators) don't go into the atlas. They're for answers in the chat, cited per answer.
5. **If the record is paywalled, partial or behind a login**, say so in the intent step. Don't fill gaps from memory.
