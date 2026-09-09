#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const Scorecard = require("../js/scorecard.js");

const root = path.join(__dirname, "..");
const dataPath = path.join(root, "data", "metrics.json");
const htmlPath = path.join(root, "index.html");

function replaceBlock(html, name, inner) {
  const start = "<!--" + name + "-->";
  const end = "<!--/" + name + "-->";
  const from = html.indexOf(start);
  const to = html.indexOf(end);
  if (from === -1 || to === -1 || to < from) {
    throw new Error("Missing markers for " + name);
  }
  return html.slice(0, from + start.length) + "\n" + inner + "\n" + html.slice(to);
}

const data = JSON.parse(fs.readFileSync(dataPath, "utf8"));
const check = Scorecard.validateDataset(data);
if (!check.ok) {
  throw new Error("Invalid metrics.json:\n" + check.errors.join("\n"));
}

let html = fs.readFileSync(htmlPath, "utf8");
html = replaceBlock(html, "STATIC_KPIS", Scorecard.buildKpiHtml(data));
html = replaceBlock(html, "STATIC_TABLE", Scorecard.buildTableHtml(data));
fs.writeFileSync(htmlPath, html);

process.stdout.write(
  "Rendered " + check.rowCount + " metric rows into index.html\n"
);
