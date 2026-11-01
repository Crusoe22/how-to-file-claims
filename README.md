# How to File Claims: FL Claims Guide

A free, educational website that explains, in plain language, how to file **health, auto, and home insurance claims in Florida** and points people to the resources that can help them.

> **Status: v1 (educational, placeholder content).** The site structure, styling, and navigation are in place. Most facts, phone numbers, deadlines, and links are **placeholders** and must be verified before launch. See [Placeholder content](#placeholder-content).

---

## Table of contents

- [Project goals](#project-goals)
- [Tech stack](#tech-stack)
- [Getting started](#getting-started)
- [Project structure](#project-structure)
- [How the pages are built](#how-the-pages-are-built)
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
- **Scope (v1):** education only. We explain the process and link to official resources. We do **not** file claims, collect personal data, or give legal advice.
- **Claim types:** Health, Auto, and Home & Property.
- **Tone:** plain language at about an 8th-grade reading level. Short sentences and clear steps.

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| Markup | HTML5 | Works on any web server with no build step |
| Styling | Plain CSS (custom properties) | No preprocessor needed |
| Behavior | Vanilla JavaScript (ES6+) | No frameworks or dependencies |
| Build | **None** | Every file is served as-is |

There is no `npm install` and no bundler. If you can open an HTML file, you can work on this project.

## Getting started

### Prerequisites

- Git
- A code editor (VS Code recommended)
- One way to run a local web server (any of these):
  - Python 3 (already installed on most Macs and Linux machines)
  - Node.js 18+
  - The VS Code **Live Server** extension

### Run it locally

```bash
git clone <repo-url>
cd how-to-file-claims

# Option A: Python
python3 -m http.server 8000

# Option B: Node
npx serve .
```

Then open <http://localhost:8000> (or the URL `serve` prints).

> **Tip:** use a local server instead of double-clicking the HTML files. Opening files directly (`file://`) works for now, but it will break once we add features that load data with `fetch()`.

## Project structure

```
how-to-file-claims/
├── index.html        # Landing page: choose a claim type, basic steps
├── health.html       # Health insurance claim guide
├── auto.html         # Auto insurance claim guide (PIP / no-fault)
├── home.html         # Home & property claim guide (hurricane, water, etc.)
├── resources.html    # Filterable table of Florida help resources
├── css/
│   └── styles.css    # All site styles (tokens → base → layout → components)
├── js/
│   └── main.js       # Nav toggle, active-link highlight, resource filter
├── assets/
│   └── images/       # Images and icons (currently empty)
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

The site must still be **usable without JavaScript**. Treat JS as an enhancement only.

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

Because the site is fully static, you can deploy it by uploading the project folder to any web server's document root. No build step is needed.

- **Apache / Nginx:** copy the files into the web root (for example, `/var/www/html`). `index.html` is served by default.
- **Static hosts:** GitHub Pages, Netlify, Cloudflare Pages, or similar. Point them at the repo root with no build command.

Files to exclude from the server: `.git/` and `README.md` (optional).

## Roadmap

Ideas for later versions. Discuss with the team before starting.

- [ ] Replace every placeholder with verified content and sources
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
