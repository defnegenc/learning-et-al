# Learning et al. — Digest Algorithm

> Referenced from CLAUDE.md. Always consult this when modifying the digest pipeline.

## Philosophy

The algorithm should work like a curious human researcher browsing for a friend. You don't pre-plan what to find. You start searching, find something interesting, and let that guide your next search. Every item in the digest must earn its place by being relevant to the others.

## How it should work

### Step 1: Pick a focus interest
- Rotate through the user's interests daily (don't repeat the same one two days in a row)
- ONE interest per day. Not a mashup of multiple interests.

### Step 2: Find the anchor paper
- Search for the focus interest. Find the most cited/influential paper.
- This is the ANCHOR. Everything else builds from it.

### Step 3: Build the theme from the anchor
- Read the anchor paper's title and abstract
- Ask the AI: "Given this paper about [topic], what's an interesting angle? Give me a specific theme and a search query for a recent paper that builds on or challenges this."
- The AI returns a THEME (e.g. "AI agents as financial advisors") and a SEARCH QUERY for the second item.

### Step 4: Find the second item using the AI's query
- Search for the second paper/article using the AI's suggested query
- VALIDATE: does this paper's abstract actually relate to the theme? Check for keyword overlap.
- If it doesn't match, try the next result. If none match, ask the AI for a different query.

### Step 5: Find the third item
- Based on content mix:
  - MIXED: Search news (RSS) using keywords extracted from the first two papers
  - ALL RESEARCH: Ask AI for a contrasting/complementary paper query
  - ALL NEWS: Search news with more specific terms
- VALIDATE again: must relate to the theme.

### Step 6: Synthesize
- Pass all 3 items + the theme to the AI for synthesis
- ONE AI call for summaries + narrative

## Total AI calls: 2
1. After finding anchor: "What's the theme? What should I search for next?"
2. After finding all items: "Synthesize these"

## Validation rules
- Every item must share at least 2 meaningful keywords with the theme
- If an item fails validation, try the next search result (up to 5 candidates)
- If no candidates pass, it's better to return 2 good items than 3 bad ones
- NEVER include a paper just to fill a slot

## What went wrong before
- Pre-planning all 3 searches at once: the AI invents abstract themes that don't map to real papers
- Combining multiple interests into one theme: produces vague themes like "computational models of aesthetic preference learning in design systems" which matches nothing
- No validation: whatever Semantic Scholar returns gets included, even if completely irrelevant (e.g. 3D segmentation paper in a fintech digest)
- Too many API calls: the old pipeline made 2 AI calls + 3-6 search calls, often hitting rate limits

## What should be different
- Search FIRST, theme SECOND. The theme emerges from what you find, not the other way around.
- Each subsequent search is informed by what was already found.
- Every item is validated for relevance before inclusion.
- The synthesis honestly says "this one's a stretch" if it is — but ideally it shouldn't be.
