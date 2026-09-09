#!/usr/bin/env bash
# Operating scorecard checks: schema, status helpers, baked first-paint HTML.
# Prints one PASS/FAIL line per check, then "Summary: N passed, 0 failed".

set +e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

passed=0
failed=0

pass() {
  echo "PASS: $1"
  passed=$((passed + 1))
}

fail() {
  echo "FAIL: $1"
  failed=$((failed + 1))
}

assert_true() {
  local name="$1"
  shift
  if "$@"; then
    pass "$name"
  else
    fail "$name"
  fi
}

# 1. Source files exist
assert_true "data/metrics.json exists" test -f data/metrics.json
assert_true "js/scorecard.js exists" test -f js/scorecard.js
assert_true "index.html exists" test -f index.html
assert_true "scripts/render-static.js exists" test -f scripts/render-static.js
assert_true ".nojekyll exists" test -f .nojekyll
assert_true "css/styles.css exists" test -f css/styles.css

if ! command -v node >/dev/null 2>&1; then
  echo "FAIL: node is required"
  echo "Summary: ${passed} passed, 1 failed"
  exit 1
fi

# 2. JSON row count and required fields
node << 'NODE'
const fs = require("fs");
const data = JSON.parse(fs.readFileSync("data/metrics.json", "utf8"));
if (!Array.isArray(data.metrics) || data.metrics.length < 6) process.exit(1);
process.exit(0);
NODE
if [ $? -eq 0 ]; then pass "metrics.json has ≥6 rows"; else fail "metrics.json has ≥6 rows"; fi

node << 'NODE'
const fs = require("fs");
const Scorecard = require("./js/scorecard.js");
const data = JSON.parse(fs.readFileSync("data/metrics.json", "utf8"));
for (const row of data.metrics) {
  if (Scorecard.missingFields(row).length) process.exit(1);
}
process.exit(0);
NODE
if [ $? -eq 0 ]; then pass "every row has baseline, target, owner, cadence, status, nextAction, escalationTrigger"; else fail "every row has baseline, target, owner, cadence, status, nextAction, escalationTrigger"; fi

node << 'NODE'
const fs = require("fs");
const data = JSON.parse(fs.readFileSync("data/metrics.json", "utf8"));
const names = data.metrics.map((m) => String(m.name).toLowerCase());
const required = [
  "overdue ar",
  "invoice count",
  "forecast accuracy",
  "billing cycle time",
  "payment control adoption",
  "13-week cash minimum"
];
for (const name of required) {
  if (!names.some((n) => n.indexOf(name) !== -1)) process.exit(1);
}
process.exit(0);
NODE
if [ $? -eq 0 ]; then pass "JSON includes all six required metric names"; else fail "JSON includes all six required metric names"; fi

# 3. Required tracker URLs in JSON
TRACKERS=(
  "https://mferdickbutt.github.io/ar-aging-calculator/"
  "https://mferdickbutt.github.io/forecast-accuracy-tracker/"
  "https://mferdickbutt.github.io/billing-cycle-tracker/"
  "https://mferdickbutt.github.io/payment-control-adoption-tracker/"
  "https://mferdickbutt.github.io/cashflow-13week-tracker/"
)
json="$(cat data/metrics.json)"
missing_json=0
for url in "${TRACKERS[@]}"; do
  echo "$json" | grep -F -q "$url" || missing_json=1
done
if [ $missing_json -eq 0 ]; then
  pass "metrics.json contains all five required Pages URLs"
else
  fail "metrics.json contains all five required Pages URLs"
fi

node << 'NODE'
const fs = require("fs");
const Scorecard = require("./js/scorecard.js");
const data = JSON.parse(fs.readFileSync("data/metrics.json", "utf8"));
const check = Scorecard.validateDataset(data);
if (!check.ok) process.exit(1);
process.exit(0);
NODE
if [ $? -eq 0 ]; then pass "validateDataset accepts sample metrics.json"; else fail "validateDataset accepts sample metrics.json"; fi

# 4. Status helpers
node << 'NODE'
const Scorecard = require("./js/scorecard.js");
if (Scorecard.normalizeStatus("On Track") !== "on-track") process.exit(1);
if (Scorecard.normalizeStatus("OFF TRACK") !== "off-track") process.exit(1);
if (Scorecard.statusLabel("escalate") !== "Escalate") process.exit(1);
if (Scorecard.statusClass("watch").indexOf("status-watch") === -1) process.exit(1);
process.exit(0);
NODE
if [ $? -eq 0 ]; then pass "status helpers normalize, label, and class names"; else fail "status helpers normalize, label, and class names"; fi

node << 'NODE'
const Scorecard = require("./js/scorecard.js");
const on = Scorecard.deriveStatus({ baselineValue: 72, targetValue: 80, polarity: "lower-is-better" });
const watch = Scorecard.deriveStatus({ baselineValue: 0.918, targetValue: 0.95, polarity: "higher-is-better" });
const off = Scorecard.deriveStatus({ baselineValue: 18, targetValue: 12, polarity: "lower-is-better" });
const escLo = Scorecard.deriveStatus({ baselineValue: 48200, targetValue: 15000, polarity: "lower-is-better" });
const escHi = Scorecard.deriveStatus({ baselineValue: 16200, targetValue: 50000, polarity: "higher-is-better" });
if (on !== "on-track") process.exit(1);
if (watch !== "watch") process.exit(1);
if (off !== "off-track") process.exit(1);
if (escLo !== "escalate") process.exit(1);
if (escHi !== "escalate") process.exit(1);
process.exit(0);
NODE
if [ $? -eq 0 ]; then pass "deriveStatus covers on-track, watch, off-track, escalate"; else fail "deriveStatus covers on-track, watch, off-track, escalate"; fi

node << 'NODE'
const fs = require("fs");
const Scorecard = require("./js/scorecard.js");
const data = JSON.parse(fs.readFileSync("data/metrics.json", "utf8"));
for (const row of data.metrics) {
  if (Scorecard.normalizeStatus(row.status) !== Scorecard.deriveStatus(row)) process.exit(1);
}
process.exit(0);
NODE
if [ $? -eq 0 ]; then pass "stored status matches deriveStatus for every sample row"; else fail "stored status matches deriveStatus for every sample row"; fi

node << 'NODE'
const Scorecard = require("./js/scorecard.js");
const bad = Scorecard.validateMetric({});
if (bad.ok) process.exit(1);
if (bad.errors.length < 7) process.exit(1);
process.exit(0);
NODE
if [ $? -eq 0 ]; then pass "validateMetric rejects a row missing required fields"; else fail "validateMetric rejects a row missing required fields"; fi

# 5. First-paint HTML: table is in the file without executing JS
html="$(cat index.html)"

echo "$html" | grep -q '<table'
if [ $? -eq 0 ]; then
  pass "index.html contains a <table> (not a JS-only shell)"
else
  fail "index.html contains a <table> (not a JS-only shell)"
fi

loading_only=0
if echo "$html" | grep -qiE 'Loading(…|\.\.\.)?'; then
  if ! echo "$html" | grep -qi 'Overdue AR'; then
    loading_only=1
  fi
fi
if [ $loading_only -eq 0 ] && echo "$html" | grep -qi 'Overdue AR'; then
  pass "index.html is not a Loading-only shell"
else
  fail "index.html is not a Loading-only shell"
fi

for label in "Overdue AR" "Invoice count" "Forecast accuracy" "Billing cycle time" "Payment control adoption" "13-week cash minimum"; do
  echo "$html" | grep -F -q "$label"
  if [ $? -eq 0 ]; then
    pass "index.html contains metric name: $label"
  else
    fail "index.html contains metric name: $label"
  fi
done

for field in Baseline Target Owner Cadence Status "Next action" "Escalation trigger"; do
  echo "$html" | grep -F -q "$field"
  if [ $? -eq 0 ]; then
    pass "index.html contains column: $field"
  else
    fail "index.html contains column: $field"
  fi
done

missing_href=0
for url in "${TRACKERS[@]}"; do
  echo "$html" | grep -F -q "href=\"$url\"" || missing_href=1
done
if [ $missing_href -eq 0 ]; then
  pass "index.html embeds all five tracker URLs as real <a href>"
else
  fail "index.html embeds all five tracker URLs as real <a href>"
fi

# 6. curl of the file (no JS) still shows metrics and tracker hrefs
if command -v curl >/dev/null 2>&1; then
  curled="$(curl -sL "file://${ROOT}/index.html")"
  echo "$curled" | grep -qi 'Overdue AR' \
    && echo "$curled" | grep -qi 'Invoice count' \
    && echo "$curled" | grep -qi 'Forecast accuracy' \
    && echo "$curled" | grep -qi 'Billing cycle time' \
    && echo "$curled" | grep -qi 'Payment control adoption' \
    && echo "$curled" | grep -qi '13-week cash minimum' \
    && echo "$curled" | grep -q 'Baseline' \
    && echo "$curled" | grep -q 'Target' \
    && echo "$curled" | grep -q 'Owner' \
    && echo "$curled" | grep -q 'Cadence' \
    && echo "$curled" | grep -q 'Status' \
    && echo "$curled" | grep -q 'Next action' \
    && echo "$curled" | grep -q 'Escalation' \
    && echo "$curled" | grep -F -q 'https://mferdickbutt.github.io/ar-aging-calculator/' \
    && echo "$curled" | grep -F -q 'https://mferdickbutt.github.io/forecast-accuracy-tracker/' \
    && echo "$curled" | grep -F -q 'https://mferdickbutt.github.io/billing-cycle-tracker/' \
    && echo "$curled" | grep -F -q 'https://mferdickbutt.github.io/payment-control-adoption-tracker/' \
    && echo "$curled" | grep -F -q 'https://mferdickbutt.github.io/cashflow-13week-tracker/'
  if [ $? -eq 0 ]; then
    pass "curl -sL of index.html (no JS) shows metric names, fields, and tracker hrefs"
  else
    fail "curl -sL of index.html (no JS) shows metric names, fields, and tracker hrefs"
  fi
else
  fail "curl is available for first-paint check"
fi

echo "Summary: ${passed} passed, ${failed} failed"
if [ "$failed" -ne 0 ]; then
  exit 1
fi
exit 0
