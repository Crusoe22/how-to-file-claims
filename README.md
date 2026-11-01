# How to File Claims: FL Claims Guide

A free, educational website that explains, in plain language, how to file **health, auto, and home insurance claims in Florida** and points people to the resources that can help them. It also includes an **AI home inventory tool**: users photograph their valuables, AI identifies and values each item, and they download a PDF or CSV to send to their insurer.

> **Status (November 2026)**
>
> | Area | State |
> |---|---|
> | Claim guides (health, auto, home) and resources page | ✅ Built. ⚠️ Most facts, phone numbers, deadlines, and links are **placeholders** that must be verified before launch. See [Placeholder content](#placeholder-content). |
> | Home inventory: photo upload | ✅ Done |
> | Home inventory: AI identification, category, and value estimate | ✅ Done. Needs an API key; see [Getting started](#getting-started). |
> | Home inventory: PDF/CSV export | ✅ Done |
> | Hosting | ⚠️ GitHub Pages serves the pages, but **the AI feature needs a Node.js host** (for example Render). See [Deployment](#deployment). |
> | Next up | Web-search pricing, saving the inventory between visits. See [Roadmap](#roadmap). |

---

## Table of contents

- [Project goals](#project-goals)
- [Tech stack](#tech-stack)
- [Getting started](#getting-started)
- [Project structure](#project-structure)
- [How the pages are built](#how-the-pages-are-built)
- [Home inventory feature](#home-inventory-feature-inventoryhtml)
- [Placeholder content](#placeholder-content)
- [Adding a new page](#adding-a-new-page)
- [Coding conventions](#coding-conventions)
- [Accessibility checklist](#accessibility-checklist)
- [Git workflow](#git-workflow)
- [Deployment](#deployment)
- [Roadmap](#roadmap)
- [Content disclaimer](#content-disclaimer)

---

## Project goals

- **Audience:** Florida residents filing an insurance claim, often for the first time and often under stress (for example, after a hurricane or car accident).
- **Scope (v1):** education, plus an AI home inventory tool. We explain the process and link to official resources. We do **not** file claims, store users' personal data or photos, or give legal advice.
- **Claim types:** Health, Auto, and Home & Property.
- **Tone:** plain language at about an 8th-grade reading level. Short sentences and clear steps.

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| Markup | HTML5 | Works on any web server with no build step |
| Styling | Plain CSS (custom properties) | No preprocessor needed |
| Front-end behavior | Vanilla JavaScript (ES6+) | No frameworks or dependencies in the browser |
| Server | Node.js 22+ with Express (`server.js`) | Serves the site and holds the AI API key |
| AI | Claude API (`@anthropic-ai/sdk`) | Identifies and values items in inventory photos |
| Build | **None** | Every file is served as-is |

The pages themselves are plain HTML/CSS/JS with no bundler. The only server code is `server.js`, which exists because the AI feature needs a secret API key that can't live in the browser.

## Getting started

### Prerequisites

- Git
- A code editor (VS Code recommended)
- **Node.js 22 or newer** (check with `node --version`)
- *For the AI feature only:* an Anthropic API key from <https://console.anthropic.com>. Ask the project lead for a development key; don't create a shared key on a personal account.

### Run it locally

```bash
git clone <repo-url>
cd how-to-file-claims
npm install

# Set up your secrets file (only needed for the AI feature)
cp .env.example .env
# then open .env and paste your key after ANTHROPIC_API_KEY=

npm start        # or: npm run dev (restarts when server.js changes)
```

Then open <http://localhost:3000>.

- **No API key?** The whole site still works. Only the inventory page's *Analyze with AI* button will show "AI analysis isn't set up on this server yet."
- **Only editing HTML/CSS?** `python3 -m http.server 8000` still works for the static pages, but *Analyze with AI* will tell you to run `npm start`.

> 🔐 **Never commit `.env` or paste an API key into any file under `js/`.** `.env` is already in `.gitignore`. If a key is ever committed, revoke it in the Anthropic Console immediately; deleting the commit is not enough.

## Project structure

```
how-to-file-claims/
├── index.html        # Landing page: choose a claim type, basic steps
├── health.html       # Health insurance claim guide
├── auto.html         # Auto insurance claim guide (PIP / no-fault)
├── home.html         # Home & property claim guide (hurricane, water, etc.)
├── resources.html    # Filterable table of Florida help resources
├── inventory.html    # Home inventory: photo upload + AI analysis
├── css/
│   └── styles.css    # All site styles (tokens → base → layout → components)
├── js/
│   ├── main.js       # Nav toggle, active-link highlight, resource filter
│   ├── inventory.js  # Photo intake and "Analyze with AI" for inventory.html
│   ├── inventory-export.js  # CSV / PDF export for inventory.html
│   └── vendor/       # Third-party libraries copied in (don't edit; see below)
├── assets/
│   └── images/       # Images and icons (currently empty)
├── server.js         # Express server: serves the site + POST /api/analyze
├── package.json      # Server dependencies and npm scripts
├── .env.example      # Template for .env (copy it; never commit .env)
├── .gitignore
└── README.md
```

## How the pages are built

### Shared header and footer

Every page includes the same header and footer, copied between these comments:

```html
<!-- ===== HEADER (keep in sync across all pages) ===== -->
...
<!-- ===== END HEADER ===== -->
```

**If you change the nav or footer, update all pages.** This keeps the site free of a build step for now. If the duplication starts causing problems, see the [Roadmap](#roadmap).

### Reusable CSS components

Use these classes from `css/styles.css` so the pages stay consistent:

| Class | Use it for |
|---|---|
| `.container` | Centers content and sets the max width |
| `.hero` | Colored banner at the top of the landing page |
| `.card-grid` + `.card` | Grid of clickable choices |
| `.steps` | Numbered step-by-step instructions (`<ol>`) |
| `.checklist` | Checkmark bullet list (`<ul>`) |
| `.accordion` | FAQ built from `<details>` / `<summary>` (no JS needed) |
| `.callout` | Highlighted tip or warning box |
| `.table-wrap` + `table` | Tables that scroll sideways on small screens |
| `.btn`, `.btn-light` | Buttons and button-style links |
| `.placeholder` | **Marks unverified content** (shown in red) |

Colors, spacing, and fonts are CSS variables at the top of `styles.css`. Change them there instead of hard-coding values.

### JavaScript

`js/main.js` is loaded on every page with `defer` and runs four small features:

1. **Mobile menu toggle:** `.nav-toggle` opens and closes `#site-nav`.
2. **Current page highlight:** adds `aria-current="page"` to the matching nav link.
3. **Footer year:** fills `#year`.
4. **Resource filter:** on `resources.html`, buttons with `data-filter` show or hide rows with matching `data-category` values.

The site must still be **usable without JavaScript**. Treat JS as an enhancement only. The one exception is the inventory page, which needs JS.

## Home inventory feature (`inventory.html`)

The long-term goal is an AI-assisted home inventory. Users photograph valuables such as jewelry and electronics, and AI identifies, categorizes, and estimates the value of each item so the user can insure it.

### Photo upload

- Users add photos by drag-and-drop or the "Choose photos" button. On phones, that button also lets them take a photo.
- Each photo shows as a card with a preview, file name, size, an **Analyze with AI** button, and a Remove button. "Remove all" clears the list.
- Limits: images only (HEIC is accepted by file extension), up to 15 MB each, 50 photos total. These are set by `MAX_FILE_MB` and `MAX_PHOTOS` at the top of `js/inventory.js`.
- Photos are held in browser memory and cleared on refresh. Nothing is saved anywhere.
- Most browsers other than Safari can't display HEIC (iPhone) photos. The card shows "Preview not available," and analysis asks for a JPG or PNG instead.

### How "Analyze with AI" works

```
inventory.js                        server.js                         Claude API
─────────────                       ─────────                         ──────────
1. Shrink photo to ≤1568px,
   re-encode as JPEG (this also
   strips GPS/location data)
2. POST /api/analyze  ───────────▶  3. Validate type/size, rate-limit
   { mediaType, data(base64) }      4. Send image + prompt  ────────▶ 5. Identify, categorize,
                                                                         estimate value
                                    6. Return JSON  ◀──────────────── (fixed JSON schema)
7. Show result on the card  ◀─────
```

The server returns this JSON shape. Claude is required to match it exactly:

```json
{
  "item_name": "Stainless steel dive watch",
  "category": "Jewelry & Watches",
  "description": "Black dial, rotating bezel, steel bracelet. Brand not visible.",
  "estimated_value_low": 150,
  "estimated_value_high": 400,
  "confidence": "medium",
  "notes": "A photo of the dial logo or the serial number would narrow this down."
}
```

`category` is always one of: Jewelry & Watches, Electronics, Art & Collectibles, Furniture, Appliances, Designer Clothing & Accessories, Musical Instruments, Sporting Goods & Tools, Other (the `CATEGORIES` list in `server.js`).

**Where to change things:**

| To change... | Edit |
|---|---|
| What Claude is told to do, or how it phrases things | `SYSTEM_PROMPT` in `server.js` |
| The fields returned or the category list | `ANALYSIS_SCHEMA` / `CATEGORIES` in `server.js`, then `resultBlock()` in `js/inventory.js` |
| Model or effort level | `MODEL` and `output_config.effort` in `analyzeImage()` |
| Requests allowed per visitor | `analyzeLimiter` in `server.js` (currently 10 per minute) |
| Upload image size or quality | `ANALYZE_MAX_EDGE` / `ANALYZE_QUALITY` in `js/inventory.js` |
| How results look | `resultBlock()` in `js/inventory.js` and the `.analysis` styles in `css/styles.css` |

**Safeguards already in place:**

- The API key is read only by the server, from `.env`. The browser never sees it.
- The server serves only `css/`, `js/`, `assets/`, and top-level `.html` files. `.env`, `server.js`, `package.json`, and `node_modules/` return 404.
- Images must be JPEG/PNG/WebP/GIF and at most 5 MB. Requests over 8 MB are rejected.
- Rate limiting is 10 analyses per minute per visitor, because every call costs money.
- Errors are shown to users in plain language. Internal details and API errors are logged only on the server.
- Photos are not stored on the server. Each one is sent to Claude and then discarded.
- All AI text is inserted with `textContent`, never `innerHTML`.
- Every result says "AI estimate, not an appraisal."

**Estimates come from Claude's general knowledge, not live prices.** Treat them as ballpark figures.

### Export (CSV and PDF)

After at least one photo is analyzed, an **Export your inventory** section appears with:

- A **summary table** of item count and estimated value per category, plus totals.
- Optional **Your name** and **Policy number** fields. These only appear on the PDF and are never sent anywhere.
- **Download PDF:** a letter-size report with a title block, a category summary, and one table per category (photo thumbnail, item, description, notes, confidence, file name, value range). Every page has a disclaimer and page numbers.
- **Download spreadsheet (CSV):** one row per item, sorted by category, for Excel or Google Sheets.

Only analyzed photos are exported. The section shows how many aren't analyzed yet. Both files are created entirely in the browser.

| To change... | Edit |
|---|---|
| CSV columns | `toCSV()` in `js/inventory-export.js` |
| PDF layout, colors, or disclaimer | `buildPDF()` / `DISCLAIMER` in `js/inventory-export.js` |
| Category order | `CATEGORY_ORDER` in `js/inventory-export.js` (**keep in sync with `CATEGORIES` in `server.js`**) |
| Thumbnail size in the PDF | `THUMB_SIZE` in `js/inventory.js` and `PHOTO` in `buildPDF()` |

Implementation notes:

- PDFs are made with [jsPDF](https://github.com/parallax/jsPDF) **4.2.1** and [jsPDF-AutoTable](https://github.com/simonbengtsson/jsPDF-AutoTable) **5.0.8**, both MIT-licensed. They're copied into `js/vendor/` so the site doesn't depend on a CDN, and they're only downloaded when someone clicks **Download PDF** (~450 KB). To upgrade, replace both files with the new versions' `dist/*.min.js` and update the versions listed here.
- A 240px square thumbnail of each photo is made during analysis and kept in the browser for the PDF. It's never sent to the server.
- CSV cells that start with `=`, `+`, `-`, or `@` get a leading `'` so spreadsheet apps don't treat AI-generated text as a formula.

### Next steps (discuss with the team first)

1. **Web search for current prices:** let Claude look up real listings and return source links with the estimate.
2. **Save the inventory** between visits (in the browser, for example IndexedDB). Right now, export is the only way to keep it.
3. **Let users edit the AI's answer** (brand, material, karat) and re-estimate.
4. **Analyze all** button for analyzing several photos at once.

## Placeholder content

Unverified information is wrapped like this:

```html
<span class="placeholder">[PLACEHOLDER: verify PIP treatment deadline]</span>
```

It shows up red on the page so it can't be missed. To find every placeholder:

```bash
grep -rn "placeholder" --include="*.html" .
```

**Rules for replacing placeholders:**

1. Use **official sources** only (Florida DFS, OIR, FLHSMV, AHCA, Citizens, FEMA/NFIP, or the insurer itself).
2. Add the source link in your pull request description.
3. Remove the `placeholder` class once the content is verified.
4. Insurance law changes often, especially Florida property insurance. Note the date you verified the information.

## Adding a new page

1. Copy an existing guide page (for example, `health.html`) to `new-page.html`.
2. Update the `<title>` and `<meta name="description">`.
3. Replace the content inside `<main>`.
4. If it belongs in the main nav, add the link to the header on **every** page.
5. Check it on a phone-sized screen (browser dev tools → device toolbar).

## Coding conventions

- **Indentation:** 2 spaces in HTML, CSS, and JS.
- **HTML:** semantic elements (`header`, `nav`, `main`, `section`, `article`, `footer`). One `<h1>` per page, and don't skip heading levels.
- **CSS:** use the existing variables and components before adding new ones. Use class selectors, not IDs, for styling. Keep the sections in `styles.css` organized.
- **JS:** vanilla only, no global variables (the file uses an IIFE), and `const`/`let` instead of `var`. Each feature lives in its own `init…()` function that exits early if its elements aren't on the page.
- **Files:** lowercase with hyphens (`claim-denied.html`, not `ClaimDenied.html`).
- **No third-party scripts or trackers** without team agreement.

## Accessibility checklist

Many visitors will be stressed, older, or on a phone. Before opening a pull request:

- [ ] Every image has meaningful `alt` text (or `alt=""` if decorative).
- [ ] The page works with the keyboard only (Tab, Enter, Space).
- [ ] Text is readable at 200% zoom.
- [ ] Color contrast meets WCAG AA (check with your browser's dev tools or the WebAIM contrast checker).
- [ ] Links make sense on their own (not "click here").
- [ ] Tested at phone width (about 375px).

## Git workflow

1. Branch off `main`: `git checkout -b feature/short-description`
   - Prefixes: `feature/`, `fix/`, `content/` (copy or fact updates), `docs/`
2. Make small, focused commits with clear messages, for example `content: add FL PIP deadline to auto guide`.
3. Push and open a pull request into `main`.
4. At least one other developer reviews it before merging.
5. For content changes, include your **sources** in the PR description.

## Deployment

The site now runs as a Node.js app, because the AI feature needs `server.js`. A plain static host (GitHub Pages, or copying files into `/var/www/html`) will serve the pages, but *Analyze with AI* won't, and export depends on it. **Never put the API key in front-end code to work around this**, because GitHub Pages sites and their repos are public.

**Easiest option: Render.** Create a Web Service from this GitHub repo with build command `npm install` and start command `npm start`, then add `ANTHROPIC_API_KEY` under *Environment*. It redeploys on every push to `main`. The free plan sleeps after about 15 minutes idle, so the first visit after that is slow.

**Your own server:**

1. Install Node.js 22+.
2. Copy the project (or `git clone` it) and run `npm install --omit=dev`.
3. Set `ANTHROPIC_API_KEY` (and optionally `PORT`) as an environment variable, or in a `.env` file that only the app's user can read (`chmod 600 .env`). Use a **separate production key** from development keys.
4. Start it with `npm start`, kept running by a process manager (systemd, pm2, or similar).
5. Put Nginx or Apache in front of it as a reverse proxy to `http://localhost:3000`, with HTTPS enabled. If you do, add `app.set("trust proxy", 1)` in `createApp()` so rate limiting sees each visitor's real IP address instead of the proxy's.

Set a monthly spending limit in the Anthropic Console so a bug or abuse can't run up an unexpected bill.

## Roadmap

Ideas for later versions. Discuss with the team before starting.

- [ ] Replace every placeholder with verified content and sources
- [x] AI home inventory: photo upload, backend endpoint, AI categorization and value estimates
- [x] AI home inventory: CSV/PDF export grouped by category
- [ ] AI home inventory, next: web-search pricing, saved inventory (see [Home inventory feature](#home-inventory-feature-inventoryhtml))
- [ ] About and Contact pages
- [ ] "My claim was denied" guide for each claim type
- [ ] Hurricane season landing page
- [ ] Spanish (and possibly Haitian Creole) translations
- [ ] Site search
- [ ] Shared header and footer via a simple static-site generator (for example, Eleventy) if duplication gets painful
- [ ] Downloadable or printable checklists
- [ ] Basic privacy-friendly analytics

## Content disclaimer

This site is for **educational purposes only** and is not legal, financial, or insurance advice. That disclaimer appears in every page footer and must stay there.
