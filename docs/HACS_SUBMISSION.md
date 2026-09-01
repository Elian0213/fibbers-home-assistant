# Getting Fibbers into the HACS default store

Right now users must add this as a *custom* repository. Listing it in
[`hacs/default`](https://github.com/hacs/default) removes that friction. Most of
this is done; the two remaining steps are GitHub-side and are yours to do.

## Already in place

- MIT licence, description set, issues enabled.
- `hacs.json` valid (`filename: fibbers.js`, min HA `2024.11.0`).
- `.github/workflows/validate.yml` runs `hacs/action@main` with `category: plugin`
  on push, PR and a daily schedule.
- `dist/fibbers.js` is committed and shipped as a release asset by
  `release.yml`, so HACS resolves `filename` against every tag.

## 1. Fix the repository topics (Settings → General → Topics)

HACS reads the repo topics. Set them to describe a **dashboard plugin**:

- **Remove:** `hacs-integration` (this is not an integration — misleading).
- **Keep:** `home-assistant`, `hacs-dashboard`, `hacs-custom`.
- **Add:** `lovelace`, `custom-cards`, `home-assistant-frontend`.

## 2. Confirm Validate is green on `main`

Open the **Actions → Validate** tab and confirm the latest run on `main` is green
(not just on a tag). The daily schedule keeps it honest.

## 3. Open the PR against `hacs/default`

Fork `hacs/default`, add the repo to the **`plugin`** category file (alphabetical),
and open a PR. Suggested PR body:

> **Add `Elian0213/fibbers-home-assistant` (plugin)**
>
> A phone-first, bottom-nav dashboard plugin: a viewport-pinned bottom bar, a
> back-stack, drag-away modal sheets, self-computing room tiles, and 26 cards
> sharing one design-token set. Single committed/released `dist/fibbers.js`.
>
> - Category: plugin (Lovelace resource)
> - `hacs.json` valid; min HA 2024.11.0
> - `hacs/action@main` (category: plugin) green on `main`
> - MIT, issues enabled, README with screenshots + install steps
