# RecSys Literature Review — Serendipity in Recommendation Systems

> How the research on recommendation systems informs our digest algorithm.

---

## 1. Serendipity: Accuracy's Unpopular Best Friend
**Source**: Kotkov et al., Knowledge-Based Systems (2016) + Eugene Yan's survey

**TL;DR**: Serendipity = unexpectedness + relevance. An item must be both surprising AND useful. Novelty alone (new but irrelevant) annoys users. Relevance alone (accurate but predictable) bores them. There are 7 factors: relevance, difference, diversity, novelty, unpopularity, high quality, randomness.

**What it means for us**: We optimize for theme relevance but not for unexpectedness or quality independently. We should score papers on multiple axes, not just "does it match the question?"

**One idea**: Add an "unexpectedness score" — how different is this paper from what the user typically sees? Papers from fields adjacent to (but not in) their usual interests score higher.

---

## 2. How Serendipity Improves User Satisfaction
**Source**: WWW 2019 — large-scale user evaluation

**TL;DR**: Novelty → perceived serendipity → satisfaction → engagement. The causal chain is proven. Critically, **user curiosity moderates everything** — curious users respond 2-3x more strongly to serendipitous recommendations than incurious users.

**What it means for us**: Our audience self-selects for curiosity (they signed up for a research digest). This means we can lean harder into surprise than a general recommender. We're underexploiting this advantage.

**One idea**: Track curiosity signals (do they click dig deeper? do they ask follow-up questions?) and give more adventurous digests to more curious users.

---

## 3. Bisociation — Creativity Through Collision
**Source**: Koestler's theory + bridge-based recommender research

**TL;DR**: Creativity happens when two unconnected frames of reference collide. The best serendipitous recommendations are "bridges" — items that connect disparate clusters in a knowledge graph. Systems that score items by "bridging distance" produce the highest user-perceived serendipity.

**What it means for us**: Our central question IS a bisociation engine. "Can AI agents be fashionable?" bridges AI and fashion clusters. This is the most literature-supported approach to structured serendipity. We should lean into it harder.

**One idea**: Instead of 3 search queries all derived from the same theme, make query 3 deliberately bridge to an adjacent field. "AI agents fashion" + "AI agents design automation" + "fashion sustainability technology" covers the core AND an adjacent bridge.

---

## 4. The Trigger-Connection-Outcome Model
**Source**: Makri & Blandford, HCI research on serendipitous discovery

**TL;DR**: Serendipity requires three things: (1) trigger-rich environment (lots of varied info), (2) highlighted triggers (bring interesting things to attention), (3) enabled connections (make relationships apparent). The environment must do the connection-making work, not the user.

**What it means for us**: The synthesis IS the connection-making step. If the synthesis just summarizes papers, serendipity dies. If it explicitly says "here's why X changes how you think about Y," serendipity lives. The hover tooltips and bridge sentences directly serve this.

**One idea**: Make the connection even more explicit — each paper could have a "This matters because..." line that ties it directly to the theme, visible on the card without clicking.

---

## 5. Explore-Exploit in List Recommendations
**Source**: Multiple papers on bandit algorithms in recommender systems

**TL;DR**: With multi-item recommendations, exploration can be "parallelized" across slots. In a 3-item list, making 1 slot exploratory barely hurts overall quality but dramatically improves long-term diversity. Epsilon-greedy (random 10%) produces bad exploratory items. Structured exploration (bridge items) works much better.

**What it means for us**: Our 2+1 slot strategy (2 exploit, 1 explore) is well-supported. But our "explore" slot is currently just the next-best paper by score — it's not intentionally wilder. It should be.

**One idea**: For the explore slot, search with a deliberately different query — maybe from a different interest entirely, or from the "adjacent field" suggestion in #3.

---

## 6. Spotify's Discover Weekly
**Source**: Analysis of Spotify's recommendation pipeline

**TL;DR**: Spotify generates a huge candidate pool filtered for affinity, then ranks by "discoverability" — favoring items the user hasn't heard. Key insight: they optimize for **long-term engagement** (are you still discovering months later?) not short-term clicks (did you play this today?). Getting too narrow kills retention even if individual recommendations score well.

**What it means for us**: We should track whether users who get more surprising digests stay engaged longer, not just whether they regenerate or star things today. Interest decay (5% daily) is our version of this — it forces variety over time.

**One idea**: Track "digest streak" — how many consecutive days does a user check their digest? If someone stops checking, their digests might be too predictable. Send them a wilder one to re-engage.

---

## 7. Filter Bubbles and LLM-Based Solutions
**Source**: "Bursting Filter Bubble" (2025) + SIGIR 2022

**TL;DR**: Diversity alone doesn't fix filter bubbles (diverse but irrelevant = ignored). LLMs can identify items that are "semantically related but structurally distant" — meaning they're about related concepts but come from completely different communities. This is the best new approach to filter bubble breaking.

**What it means for us**: Our theme-first approach already does this partially — "Can fashion transform beyond clothing?" pulls from fashion, sustainability, AND art communities. But we could be more intentional about crossing community boundaries.

**One idea**: Use OpenAlex's "concepts" taxonomy to ensure the 3 papers come from at least 2 different concept clusters, not all from the same subfield.

---

## 8. No Existing Tool Does What We Do
**Source**: Comparative analysis of Semantic Scholar, Elicit, ResearchRabbit, Connected Papers

**TL;DR**: Every existing academic discovery tool is pull-based — the user searches for something they already know they want. None of them push unexpected cross-domain connections unprompted. Connected Papers comes closest (shows structural relationships) but still needs a seed paper.

**What it means for us**: Our "push-based daily surprise" model fills a genuine gap. The competitive moat is the central question + synthesis combination. Nobody else generates "here's a surprising question that connects your interests in a way you haven't considered."

**One idea**: This is the thing to double down on. The question quality is everything. Better questions → better papers → better synthesis → better product.

---

## Summary: Top 3 Improvements Based on Literature

1. **Intentionally diverse slot 3** — don't just take the next-best paper. Search with a deliberately different query from an adjacent field. Literature strongly supports structured exploration over random novelty.

2. **Venue/quality signal** — the literature says "high quality" is one of the 7 serendipity factors. We currently have no quality signal beyond citation count. Adding venue prestige + institutional credibility would let us surface niche gems from top venues.

3. **"Did this surprise you?" feedback** — serendipity is notoriously hard to measure from clicks. A simple binary signal on the digest (not just papers) would let us learn what "unexpected + relevant" means for each user over time.
