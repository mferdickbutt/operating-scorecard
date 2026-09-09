# Operating Scorecard

Public roll-up of sample **finance-ops** metrics with links to existing tracker Pages (AR aging, forecast accuracy, billing cycle, payment-control adoption, 13-week cashflow).

**Hard requirement:** first paint is static HTML. `index.html` already contains the full scorecard table. A `curl -sL` of the file (no JavaScript) shows metric names, baseline, target, owner, cadence, status, next action, escalation trigger, and real `<a href>` tracker links. JavaScript is optional status filtering only.

## Files

| Path | Role |
| --- | --- |
| `data/metrics.json` | Source rows (six sample metrics + tracker URLs) |
| `js/scorecard.js` | Status helpers, validation, and HTML builders (browser + Node) |
| `scripts/render-static.js` | Reads JSON + `scorecard.js`, writes KPIs and table into `index.html` |
| `scripts/test.sh` | Row-count, schema, tracker-URL, and first-paint assertions |
| `css/styles.css` | Minimal layout |
| `.nojekyll` | Allow GitHub Pages to serve the site as-is |
| `index.html` | Committed, pre-rendered table |

## Data schema (`data/metrics.json`)

```json
{
  "meta": {
    "title": "Operating Scorecard",
    "org": "Northwind Operations",
    "asOf": "2026-09-09"
  },
  "metrics": [
    {
      "id": "overdue-ar",
      "name": "Overdue AR",
      "baseline": "$48,200",
      "target": "≤ $15,000",
      "baselineValue": 48200,
      "targetValue": 15000,
      "unit": "usd",
      "polarity": "lower-is-better",
      "owner": "AR Collections",
      "cadence": "Weekly",
      "status": "escalate",
      "nextAction": "…",
      "escalationTrigger": "…",
      "link": "https://mferdickbutt.github.io/ar-aging-calculator/",
      "linkLabel": "AR aging calculator"
    }
  ]
}
```

Required fields on every row: **baseline**, **target**, **owner**, **cadence**, **status**, **nextAction**, **escalationTrigger**. Include **link** (and optional **linkLabel**) when a tracker Page exists.

`baseline` / `target` are display strings. `baselineValue` / `targetValue` are numeric so `deriveStatus` can compare them. `polarity` is `lower-is-better` or `higher-is-better`.

### Required sample rows

| Metric | Tracker |
| --- | --- |
| Overdue AR | [AR aging calculator](https://mferdickbutt.github.io/ar-aging-calculator/) |
| Invoice count | [AR aging calculator](https://mferdickbutt.github.io/ar-aging-calculator/) |
| Forecast accuracy | [Forecast accuracy tracker](https://mferdickbutt.github.io/forecast-accuracy-tracker/) |
| Billing cycle time | [Billing cycle tracker](https://mferdickbutt.github.io/billing-cycle-tracker/) |
| Payment control adoption | [Payment control adoption tracker](https://mferdickbutt.github.io/payment-control-adoption-tracker/) |
| 13-week cash minimum | [13-week cashflow tracker](https://mferdickbutt.github.io/cashflow-13week-tracker/) |

### Status helpers

`js/scorecard.js` normalizes status to `on-track` | `watch` | `off-track` | `escalate`.

`deriveStatus(row)` compares `baselineValue` to `targetValue`:

- **On track** if the baseline meets the target.
- **Watch** if within 10% of the target on the wrong side.
- **Escalate** if more than 50% off (higher-is-better: below 50% of target; lower-is-better: more than 1.5× target).
- **Off track** otherwise.

Stored `status` on sample rows matches `deriveStatus` for the numeric values.

## Re-render static HTML

After editing `data/metrics.json` or table markup in `js/scorecard.js`:

```bash
node scripts/render-static.js
```

The script replaces the `<!--STATIC_KPIS-->` and `<!--STATIC_TABLE-->` blocks in `index.html`. Commit the regenerated HTML so GitHub Pages / static extractors see real cells without running JS.

Do not ship a “Loading…” shell as the only content.

## Tests

```bash
bash scripts/test.sh
```

Expect `PASS:` lines (≥12) and `Summary: N passed, 0 failed` with exit code 0. Coverage includes row count, required fields on every row, required Pages URLs in JSON and `index.html`, and a first-paint check that `index.html` is not a Loading-only shell. `curl -sL` of the file is also asserted.

## Suggested next improvements

- Replace sample rows with live extracts from the five tracker Pages (or a shared metrics API).
- Add period-over-period spark columns once each tracker publishes a stable snapshot JSON.
- Surface owner Slack/email on escalate without hiding the static table.
- Optional CSV export of the baked scorecard for weekly ops reviews.
- Keep JS enhancement (status filter) optional; first paint remains the source of truth.
