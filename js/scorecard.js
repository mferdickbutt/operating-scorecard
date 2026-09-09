/**
 * Operating scorecard: status helpers, row validation, and static HTML builders.
 * Loadable from Node (`require`) and browsers (`<script>` → global Scorecard).
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  if (typeof root === "object" && root !== null) {
    root.Scorecard = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const REQUIRED_FIELDS = [
    "name",
    "baseline",
    "target",
    "owner",
    "cadence",
    "status",
    "nextAction",
    "escalationTrigger"
  ];

  const STATUSES = ["on-track", "watch", "off-track", "escalate"];

  const REQUIRED_TRACKERS = [
    "https://mferdickbutt.github.io/ar-aging-calculator/",
    "https://mferdickbutt.github.io/forecast-accuracy-tracker/",
    "https://mferdickbutt.github.io/billing-cycle-tracker/",
    "https://mferdickbutt.github.io/payment-control-adoption-tracker/",
    "https://mferdickbutt.github.io/cashflow-13week-tracker/"
  ];

  const WATCH_BAND = 0.1;
  const ESCALATE_BAND = 0.5;

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function normalizeStatus(status) {
    const raw = String(status || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-");
    if (raw === "ontrack" || raw === "green") return "on-track";
    if (raw === "amber" || raw === "yellow") return "watch";
    if (raw === "offtrack" || raw === "red") return "off-track";
    if (raw === "escalated" || raw === "critical") return "escalate";
    if (STATUSES.indexOf(raw) !== -1) return raw;
    return "watch";
  }

  function statusClass(status) {
    return "status status-" + normalizeStatus(status);
  }

  function statusLabel(status) {
    const s = normalizeStatus(status);
    if (s === "on-track") return "On track";
    if (s === "off-track") return "Off track";
    if (s === "escalate") return "Escalate";
    return "Watch";
  }

  function deriveStatus(row) {
    const baseline = Number(row && row.baselineValue);
    const target = Number(row && row.targetValue);
    const polarity = row && row.polarity === "higher-is-better"
      ? "higher-is-better"
      : "lower-is-better";
    if (!Number.isFinite(baseline) || !Number.isFinite(target) || target === 0) {
      return "watch";
    }
    if (polarity === "higher-is-better") {
      const ratio = baseline / target;
      if (ratio >= 1) return "on-track";
      if (ratio >= 1 - WATCH_BAND) return "watch";
      if (ratio < ESCALATE_BAND) return "escalate";
      return "off-track";
    }
    const over = baseline / target;
    if (over <= 1) return "on-track";
    if (over <= 1 + WATCH_BAND) return "watch";
    if (over > 1 + ESCALATE_BAND) return "escalate";
    return "off-track";
  }

  function missingFields(row) {
    const missing = [];
    REQUIRED_FIELDS.forEach(function (field) {
      const value = row && row[field];
      if (value == null || String(value).trim() === "") missing.push(field);
    });
    return missing;
  }

  function validateMetric(row) {
    const errors = missingFields(row).map(function (field) {
      return "missing " + field;
    });
    if (row && row.status && STATUSES.indexOf(normalizeStatus(row.status)) === -1) {
      errors.push("invalid status");
    }
    if (row && row.link) {
      const href = String(row.link);
      if (href.indexOf("https://") !== 0 && href.indexOf("http://") !== 0 && href.indexOf("/") !== 0) {
        errors.push("invalid link");
      }
    }
    return {
      ok: errors.length === 0,
      errors: errors
    };
  }

  function validateDataset(data) {
    const metrics = (data && Array.isArray(data.metrics)) ? data.metrics : [];
    const rowResults = metrics.map(validateMetric);
    const errors = [];
    if (metrics.length < 6) {
      errors.push("need at least 6 metric rows");
    }
    rowResults.forEach(function (result, i) {
      if (!result.ok) {
        errors.push("row " + i + ": " + result.errors.join(", "));
      }
    });
    const links = metrics.map(function (m) { return m && m.link; });
    REQUIRED_TRACKERS.forEach(function (url) {
      if (links.indexOf(url) === -1) {
        errors.push("missing tracker " + url);
      }
    });
    return {
      ok: errors.length === 0,
      rowCount: metrics.length,
      errors: errors
    };
  }

  function datasetSummary(data) {
    const metrics = (data && Array.isArray(data.metrics)) ? data.metrics : [];
    const counts = { "on-track": 0, watch: 0, "off-track": 0, escalate: 0 };
    metrics.forEach(function (row) {
      const status = normalizeStatus(row.status);
      counts[status] = (counts[status] || 0) + 1;
    });
    const uniqueLinks = [];
    metrics.forEach(function (row) {
      if (row.link && uniqueLinks.indexOf(row.link) === -1) uniqueLinks.push(row.link);
    });
    return {
      title: (data.meta && data.meta.title) || "Operating Scorecard",
      org: (data.meta && data.meta.org) || "",
      asOf: (data.meta && data.meta.asOf) || "",
      metricCount: metrics.length,
      trackerCount: uniqueLinks.length,
      counts: counts,
      attention: counts["off-track"] + counts.escalate,
      metrics: metrics
    };
  }

  function trackerCell(row) {
    if (!row.link) return "<td class=\"link\">—</td>";
    const label = row.linkLabel || row.link;
    return (
      '<td class="link"><a href="' +
      escapeHtml(row.link) +
      '">' +
      escapeHtml(label) +
      "</a></td>"
    );
  }

  function buildKpiHtml(data) {
    const summary = datasetSummary(data);
    const cards = [
      ["Metrics tracked", String(summary.metricCount)],
      ["As of", summary.asOf || "—"],
      ["On track", String(summary.counts["on-track"])],
      ["Watch", String(summary.counts.watch)],
      ["Needs attention", String(summary.attention)],
      ["Trackers linked", String(summary.trackerCount)]
    ];
    const inner = cards.map(function (card) {
      return (
        '<div class="kpi">' +
        "<dt>" + escapeHtml(card[0]) + "</dt>" +
        "<dd>" + escapeHtml(card[1]) + "</dd>" +
        "</div>"
      );
    }).join("\n");
    return '<dl class="kpis">\n' + inner + "\n</dl>";
  }

  function buildTableHtml(data) {
    const summary = datasetSummary(data);
    const captionOrg = summary.org ? escapeHtml(summary.org) + " — " : "";
    const captionAsOf = summary.asOf ? " as of " + escapeHtml(summary.asOf) : "";
    const caption =
      "<caption>" +
      captionOrg +
      "operating scorecard" +
      captionAsOf +
      ". Baseline, target, owner, cadence, status, next action, and escalation trigger per metric.</caption>";

    const head =
      "<thead><tr>" +
      '<th scope="col">Metric</th>' +
      '<th scope="col">Baseline</th>' +
      '<th scope="col">Target</th>' +
      '<th scope="col">Owner</th>' +
      '<th scope="col">Cadence</th>' +
      '<th scope="col">Status</th>' +
      '<th scope="col">Next action</th>' +
      '<th scope="col">Escalation trigger</th>' +
      '<th scope="col">Tracker</th>' +
      "</tr></thead>";

    const body = summary.metrics.map(function (row) {
      const status = normalizeStatus(row.status);
      return (
        "<tr data-status=\"" + escapeHtml(status) + "\">" +
        '<th scope="row" class="metric">' + escapeHtml(row.name) + "</th>" +
        '<td class="baseline">' + escapeHtml(row.baseline) + "</td>" +
        '<td class="target">' + escapeHtml(row.target) + "</td>" +
        '<td class="owner">' + escapeHtml(row.owner) + "</td>" +
        '<td class="cadence">' + escapeHtml(row.cadence) + "</td>" +
        '<td class="' + statusClass(status) + '">' + escapeHtml(statusLabel(status)) + "</td>" +
        '<td class="next-action">' + escapeHtml(row.nextAction) + "</td>" +
        '<td class="escalation">' + escapeHtml(row.escalationTrigger) + "</td>" +
        trackerCell(row) +
        "</tr>"
      );
    }).join("\n");

    return (
      '<table id="scorecard-table" class="metrics">\n' +
      caption + "\n" +
      head + "\n" +
      "<tbody>\n" + body + "\n</tbody>\n" +
      "</table>"
    );
  }

  function enhance() {
    const table = document.getElementById("scorecard-table");
    const toolbar = document.getElementById("enhance-toolbar");
    const select = document.getElementById("status-filter");
    if (!table || !toolbar || !select) return;
    toolbar.classList.remove("hidden");
    select.addEventListener("change", function () {
      const want = select.value;
      const rows = table.tBodies[0] ? table.tBodies[0].rows : [];
      for (let i = 0; i < rows.length; i++) {
        const status = rows[i].getAttribute("data-status") || "";
        rows[i].hidden = want !== "" && status !== want;
      }
    });
  }

  if (typeof document === "object" && document) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", enhance);
    } else {
      enhance();
    }
  }

  return {
    REQUIRED_FIELDS: REQUIRED_FIELDS,
    STATUSES: STATUSES,
    REQUIRED_TRACKERS: REQUIRED_TRACKERS,
    escapeHtml: escapeHtml,
    normalizeStatus: normalizeStatus,
    statusClass: statusClass,
    statusLabel: statusLabel,
    deriveStatus: deriveStatus,
    missingFields: missingFields,
    validateMetric: validateMetric,
    validateDataset: validateDataset,
    datasetSummary: datasetSummary,
    buildKpiHtml: buildKpiHtml,
    buildTableHtml: buildTableHtml,
    enhance: enhance
  };
});
