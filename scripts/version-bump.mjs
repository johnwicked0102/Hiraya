#!/usr/bin/env node
/**
 * Automatic semantic version bump based on the "weight" of the change.
 *
 * Decides major / minor / patch from the commits being released:
 *   • major  — a breaking change is declared, OR a very large change set
 *   • minor  — a new feature (feat:), OR a medium-sized change set
 *   • patch  — everything else (small fixes, tweaks, docs)
 *
 * "Weight" is measured as lines changed (insertions + deletions) and files
 * touched since the previous release, with Conventional-Commit markers
 * (feat:, fix:, `!`, "BREAKING CHANGE") taken as explicit overrides.
 *
 * Writes the new version into package.json and prints outputs for CI.
 * Run locally to preview:  node scripts/version-bump.mjs --dry
 */
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, appendFileSync } from "node:fs";

// Tune these thresholds to taste.
const MAJOR_LINES = 2000; // a change this big is treated as a milestone release
const MINOR_LINES = 150; // a change this big is treated as a feature-sized release
const MINOR_FILES = 8; // touching this many files is also feature-sized

const dry = process.argv.includes("--dry");
const sh = (cmd) => execSync(cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
const shSafe = (cmd) => {
  try { return sh(cmd); } catch { return ""; }
};

const ZERO = "0000000000000000000000000000000000000000";
const after = process.env.AFTER_SHA || "HEAD";
let before = process.env.BEFORE_SHA || "";

// Work out the commit range to inspect.
let range = "";
if (before && before !== ZERO && shSafe(`git cat-file -t ${before}`) === "commit") {
  range = `${before}..${after}`;
} else {
  const lastTag = shSafe("git describe --tags --abbrev=0");
  if (lastTag) range = `${lastTag}..${after}`;
}

// Commit subjects + bodies (fall back to the latest commit on a fresh repo).
const log = (range ? shSafe(`git log --format=%s%n%b ${range}`) : shSafe("git log -1 --format=%s%n%b")).toLowerCase();
const subjects = (range ? shSafe(`git log --format=%s ${range}`) : shSafe("git log -1 --format=%s")).split("\n").filter(Boolean);

// Diff weight.
const stat = range ? shSafe(`git diff --shortstat ${range}`) : shSafe("git diff --shortstat HEAD~1 HEAD");
const num = (re) => Number((stat.match(re) || [])[1] || 0);
const files = num(/(\d+) files? changed/);
const churn = num(/(\d+) insertions?/) + num(/(\d+) deletions?/);

// Conventional-commit signals.
const breaking = /breaking change/.test(log) || subjects.some((s) => /^\w+(\([^)]*\))?!:/.test(s));
const hasFeat = subjects.some((s) => /^feat(\([^)]*\))?!?:/.test(s));

let bump;
if (breaking || churn >= MAJOR_LINES) bump = "major";
else if (hasFeat || churn >= MINOR_LINES || files >= MINOR_FILES) bump = "minor";
else bump = "patch";

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
let [maj, min, pat] = String(pkg.version || "0.0.0").split(".").map((n) => parseInt(n, 10) || 0);
if (bump === "major") { maj += 1; min = 0; pat = 0; }
else if (bump === "minor") { min += 1; pat = 0; }
else { pat += 1; }
const version = `${maj}.${min}.${pat}`;

console.log(`Change weight: ${churn} lines across ${files} files → ${bump} bump → v${version}`);

if (!dry) {
  pkg.version = version;
  writeFileSync("package.json", JSON.stringify(pkg, null, 2) + "\n");
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `version=${version}\nbump=${bump}\nchanged=true\n`);
  }
}
