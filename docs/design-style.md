# Learning et al. — Design System

## Philosophy
Brutalist research archive. Information-dense, no decoration for decoration's sake. Every element earns its place. Clean, readable, with personality coming from typography and layout — not from visual noise.

## Color Palette
- **Background:** #e8e8e8
- **Ink:** #1a1a1a
- **Accent colors (tags only):**
  - Green: #38b000 / pastel: #d4edda
  - Pink: #ff007f / pastel: #f8d7da
  - Purple: #7700ff / pastel: #e2d5f1
  - Blue: #0077ff / pastel: #cce5ff
  - Orange: #ff5500 / pastel: #ffeeba
- **Accent colors are ONLY used in tags and badges.** Never as backgrounds, blobs, or decoration in content areas.

## Typography
- **Body:** Inter, 0.9-1.1rem, line-height 1.6-1.7
- **System labels:** Courier New, 0.65-0.7rem, uppercase, letter-spacing 2px
- **Titles:** Inter, 1.1-1.2rem, bold, uppercase
- **Card titles:** 1rem, bold, uppercase, line-height 1.2

## Borders & Spacing
- All borders: 1.5px solid #1a1a1a
- No rounded corners anywhere
- Padding: 20-40px in panels, 20px in cards
- Gap between cards: 20px

## Cursor
- Crosshair everywhere

---

## Components

### Header
- Horizontal line with centered bordered title box: "LEARNING ET AL."
- Tab buttons below: TODAY / VAULT
- Settings gear icon right-aligned

### Paper Card (sidebar)
- **Purpose:** Show a paper at a glance. Title, source, summary, tags.
- **Appearance:** 1.5px bordered box, #e8e8e8 bg
- **Content:** Source label (mono, small), title (uppercase bold), authors (italic small), abstract (line-clamp-3), keyword tags (pastel colored boxes with black text and 1px black border)
- **Hover:** translateY(-2px), bg lightens to #f0f0f0
- **Interactions:** Click to open detail. Star/dislike appear on hover.

### Synthesis Panel (top of canvas area)
- **Purpose:** Brief the user on today's digest. Theme + conversational summary.
- **Appearance:** Clean text area, 40px padding, max-width 700px
- **Content:** Header with pulsing green dot + "DAILY_SYNTHESIS_SUMMARY", then synthesis text at 1.1rem
- **Tags:** Concept tags below synthesis, pastel colored boxes
- **NO blobs, NO decorative elements.** Just text.

### Knowledge Graph / Node Map (bottom of canvas area)
- **Purpose:** Quick visual showing how today's topics connect. User glances at it to see relationships. NOT a feature — a minimap.
- **Appearance:** Small bordered container (320x240px), positioned bottom-right of visual workspace, with subtle box-shadow
- **Content:**
  - Keyword nodes: small bordered labels (0.55rem, uppercase, letter-spacing 1px, bg #e8e8e8, 1px solid border)
  - Connection lines: solid 1.5px lines between related nodes, opacity 0.8
  - That's it. No circles, no dots, no blobs inside the container.
- **Blobs:** 2-3 large blurred accent-colored circles in the VISUAL WORKSPACE (parent area), NOT inside the node container. They provide ambient color to the workspace background.
- **Behavior:** Clicking a node highlights related papers in the sidebar.

### Paper Detail View
- **Purpose:** Full view of a paper with AI summary and Q&A.
- **Back button:** "← BACK" mono uppercase, no chrome
- **Layout:** Source label, title, authors, keyword tags, separator, AI summary, separator, Q&A thread
- **Style:** Same borders/typography as everything else

### Q&A Thread
- **Purpose:** Ask questions about a paper, see saved Q&A history.
- **Appearance:** Each QA pair is a bordered box. Question bold, answer below. Click to expand/collapse.
- **Input:** Plain bordered textarea + "ASK" button

### Vault Page (archive grid)
- **Purpose:** Browse all past papers/articles.
- **Layout:** Grid of square (1:1) cards + right sidebar with timeline
- **Cards:** aspect-ratio 1/1, small accent aura blob in top-right, REP_XXX number, category tag, title
- **Grid:** repeat(auto-fill, minmax(240px, 1fr))
- **Hover:** translateY(-2px), bg goes white
- **Compare mode:** Select 2-3, acid-pink border on selected

### Onboarding
- **Purpose:** Get API key + interests with field/level.
- **Step 1:** Provider selector + API key input
- **Step 2:** Interest cards (keyword + field + level) + content mix slider
- **Style:** Centered bordered card, same brutalist treatment

### Settings Dialog
- **Purpose:** Change API key/provider anytime.
- **Style:** Same brutalist inputs and buttons. Test connection button.

### Tags/Badges (universal)
- Pastel background (from palette above), assigned by index % 5
- Black text (#1a1a1a)
- 1px solid #1a1a1a border
- No rounded corners
- Padding: 2px 8px
- Font: 0.6rem, uppercase

### Noise Overlay
- Fixed, full-screen, pointer-events none
- SVG fractalNoise texture at 0.08 opacity
- Always present for texture
