# Features TODO

## 1. Share Digest
Public shareable link for any digest — anyone can view without sign-in modal popping up. Enables sharing on social, Slack, etc.

## 2. Working Cron Job
Auto-generate digests daily for all users. Currently manual "Generate" button only. Need scheduled job at user's preferred time (e.g. 8am local).

## 3. Dig Deeper Refresh
Rethink dig deeper to actually prompt the user to explore further. Current suggested questions feel generic. Should feel like a curious friend pulling you in deeper.

## 4. Delivery Cadence
Let users choose how often they get digests: Daily (morning), Bi-Weekly (Tue & Fri), Weekly (Sunday recap). Settings UI exists, backend not wired yet.

## 5. Research Deep Dive: Making Papers Conversational
**Core question:** How might we make it so the user doesn't have to read the paper at all to feel like they've learned something? How can we make it so that short interaction is enough to bring it up in conversation?

Needs a research deep dive in `docs/summarize-papers.md` — look at:
- Cognitive science of knowledge retention from summaries vs. full reads
- "Cocktail party knowledge" — what's the minimum viable understanding to discuss a topic?
- Spaced repetition / active recall techniques applied to paper digests
- How podcasts/newsletters achieve this (Morning Brew, TLDR, Huberman)
- The role of narrative + surprise + personal connection in memory formation

## 6. Homework Queue
Let the user assign the agent "homework" — a personal queue of topics/areas they want explored (e.g. "generative UI", "ubiquitous computing in the 21st century", "surveillance capitalism"). The user adds items to the list; the digest pipeline pulls from this queue to seed the central question/theme, instead of (or alongside) the user's standing interests.
- **UX:** A floating "Give me homework" button, top-right of the digest, opens an input to add a topic to the queue.
- **Behavior:** Queue-like — the pipeline picks an item (FIFO or weighted) to drive that day's theme. Decide whether items are consumed once or recur.
- **Open questions:** Does a homework item override the normal interest-based theme for that digest, or just bias it? How do consumed items get surfaced back ("here's what I found on X")? Should the user see/reorder/delete the queue?
- **Differs from interests:** Interests are a standing profile; homework is a directed, ephemeral request — "go look into *this* next."
