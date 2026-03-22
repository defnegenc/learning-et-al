# Pilot Program Plan — 10-15 Friends

## Overview

Invite 10-15 friends via custom codes. Track everything they do. Build a simple admin dashboard to see usage, themes, engagement.

---

## Distribution

Give each friend a unique code from the existing list. Track which code = which user by matching `inviteCode` in localStorage to the Google account email.

---

## What to Track

### Core Metrics (must have)

| Metric | How to Track | Why It Matters |
|--------|-------------|----------------|
| **Daily active users** | Vercel Analytics (already deployed) | Are people coming back? |
| **Digest regenerations** | Log to DB: userId + timestamp on each `/api/digest/generate` call | Shows dissatisfaction with current digest |
| **Themes generated** | Already in `digests.theme` column | What themes resonate? What's boring? |
| **Dig deeper questions asked** | Log to DB: new `analytics` table with userId, digestId, question, timestamp | What are people curious about? |
| **External source clicks** | Track clicks on "Read the full paper" button → log to DB | Did the digest make them want more? |
| **Papers clicked** | Track which papers users open in detail view | Which paper types get attention? |
| **Digest stars** | Already in `digests.starred` column | Best signal of "this was good" |
| **Session count per user** | Vercel Analytics page views per user | Retention proxy |

### Nice to Have

| Metric | How to Track | Why It Matters |
|--------|-------------|----------------|
| **Time on synthesis** | JS timer from page load to first interaction | Are they reading or skipping? |
| **Code → user mapping** | Store inviteCode in users table | Who's who |
| **Interest overlap** | Query interests table per user | Do similar interests = similar themes? |
| **"Was this interesting?" signal** | Simple 👍/👎 on the digest itself | Direct serendipity feedback |

---

## Analytics Stack (Free)

1. **Vercel Analytics** — already deployed. Page views, unique visitors, top pages, referrers. Free on Hobby plan.

2. **Vercel Speed Insights** — already deployed. Core Web Vitals, load times.

3. **Custom event logging to Turso** — add an `events` table for fine-grained tracking. Zero additional cost.

4. **Admin dashboard** — new `/admin` route behind admin user check. Same brutalist UI. Shows:
   - User list with last active date
   - Per-user: themes generated, questions asked, papers clicked, stars
   - Global: daily active users chart, popular themes, regeneration rate

---

## Admin Dashboard Spec

### Route: `/admin` (admin-only)

**Access**: Check if current user's ID matches `ADMIN_USER_ID` env var. Everyone else gets 404.

**Layout**: Same app shell with a third tab "Admin" (only visible to admin).

**Views**:

#### 1. Users Overview
Table of all users:
- Name / email
- Invite code used
- Date joined
- Last active
- Total digests generated
- Total questions asked
- Total stars given

#### 2. Activity Feed
Reverse-chronological feed of all events:
- "Defne generated a digest: 'Can old traditions find new life?'"
- "Vicki asked: 'How do fashion heritage and ancient art connect?'"
- "Noe starred today's digest"
- "Kenny clicked 'Read the full paper' on [paper title]"

#### 3. Theme Explorer
All themes generated across all users:
- Theme text
- User who generated it
- Date
- Number of questions asked on it
- Starred or not

#### 4. Engagement Stats
- Daily active users (past 30 days)
- Average regenerations per user per day
- Most popular dig deeper questions
- Most clicked-through papers
- Retention: how many users return day over day

---

## Events Table Schema

```sql
CREATE TABLE events (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL REFERENCES users(id),
  type TEXT NOT NULL, -- 'digest_generate', 'dig_deeper', 'paper_click', 'source_click', 'regenerate'
  digestId TEXT,
  paperId TEXT,
  metadata TEXT, -- JSON: { question: "...", theme: "...", etc }
  createdAt INTEGER
);
```

---

## Implementation Order

1. **Add `events` table** + logging in existing endpoints (digest/generate, digest/chat, paper click)
2. **Add `inviteCode` column to users table** to persist which code they used
3. **Build `/admin` route** with user list + activity feed
4. **Add theme explorer + engagement stats views**
5. **Invite friends, share codes, monitor dashboard**

---

## Timeline

- Day 1: Events table + logging (2-3 hours)
- Day 2: Admin dashboard (3-4 hours)
- Day 3: Invite friends, monitor
- Week 1: Check retention, adjust algorithm based on what themes people star vs skip
- Week 2: Iterate on synthesis quality based on dig deeper patterns

---

## Success Criteria (after 2 weeks)

- **Retention**: >50% of pilot users check their digest at least 3 days/week
- **Engagement**: Average user asks at least 1 dig deeper question per digest
- **Quality**: >30% of digests get starred
- **Serendipity**: Users report learning something they wouldn't have found on their own (qualitative — ask them)
