#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Dependency-free secret scan for tracked files.
//
// GitHub's own secret scanning + push protection is the primary defence (enable
// it in the repository settings). This script is the offline backstop for the
// cases GitHub does not catch: keys pasted into docs, fixtures, or commit
// messages that never reach a known provider pattern.
//
// Usage:
//   node scripts/check-secrets.mjs            # scan `git ls-files`
//   node scripts/check-secrets.mjs --staged   # scan staged files only
//   node scripts/check-secrets.mjs path...    # scan explicit paths
//
// Exit code 1 when something looks like a credential.

import { execFileSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import { extname } from "node:path";

/** Text files only; everything else is skipped by extension or size. */
const TEXT_EXTENSIONS = new Set([
  ".md",
  ".markdown",
  ".txt",
  ".ts",
  ".tsx",
  ".js",
  ".mjs",
  ".cjs",
  ".json",
  ".jsonc",
  ".yml",
  ".yaml",
  ".ftl",
  ".xhtml",
  ".html",
  ".css",
  ".sh",
  ".ps1",
  ".py",
  ".toml",
  ".ini",
  ".env",
  ".example",
]);

const MAX_BYTES = 2 * 1024 * 1024;

/**
 * Patterns are intentionally conservative on length so that documentation
 * examples and test fixtures do not trip them, but anything that looks like a
 * live credential does.
 */
export const PATTERNS = [
  { name: "openai/anthropic key", pattern: /\bsk-(?:ant-)?[A-Za-z0-9_-]{20,}/gu },
  { name: "google api key", pattern: /\bAIza[0-9A-Za-z_-]{20,}/gu },
  { name: "github token", pattern: /\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})/gu },
  { name: "slack token", pattern: /\bxox[baprs]-[A-Za-z0-9-]{10,}/gu },
  { name: "aws access key", pattern: /\bAKIA[0-9A-Z]{16}\b/gu },
  { name: "private key block", pattern: /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY-----/gu },
  { name: "bearer header", pattern: /\bBearer\s+[A-Za-z0-9._~+/-]{24,}=*/gu },
];

/** Obvious placeholders used by tests, docs and fixtures. */
const ALLOWLIST = [
  "sk-test-",
  "sk-ant-test-",
  "AIzaTEST",
  "sk-example",
  "sk-dummy",
  "sk-fake",
  "000111",
  "example.com",
  "REDACTED",
  "***",
  "<your",
  "YOUR_",
];

const SKIP_PATH = [
  /^node_modules\//u,
  /^\.scaffold\//u,
  /^docs\/dev\/screenshots\//u,
  /^docs\/images\//u,
  /^package-lock\.json$/u,
  /\.(?:png|jpe?g|gif|webp|pdf|xpi|zip|ico|woff2?|ttf|map)$/iu,
];

/** Characters around a match that are useful in the report but not the secret. */
function mask(match) {
  return `${match.slice(0, 4)}…${match.slice(-2)} (${match.length} chars)`;
}

export function isAllowed(line, match) {
  if (line.includes("allow-secret-scan")) return true;
  const lowered = `${line} ${match}`.toLowerCase();
  return ALLOWLIST.some((entry) => lowered.includes(entry.toLowerCase()));
}

/**
 * Scan a blob of text. Exported so the unit test can exercise it without git.
 * @returns {Array<{ line: number, name: string, match: string }>}
 */
export function scanText(text) {
  const findings = [];
  const lines = text.split(/\r?\n/u);
  lines.forEach((line, index) => {
    for (const { name, pattern } of PATTERNS) {
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(line)) !== null) {
        if (isAllowed(line, match[0])) continue;
        findings.push({ line: index + 1, name, match: match[0] });
      }
    }
  });
  return findings;
}

function listFiles(args) {
  if (args.includes("--staged")) {
    return execFileSync("git", ["diff", "--cached", "--name-only", "--diff-filter=ACMR"], {
      encoding: "utf8",
    })
      .split("\n")
      .filter(Boolean);
  }
  const explicit = args.filter((arg) => !arg.startsWith("--"));
  if (explicit.length) return explicit;
  return execFileSync("git", ["ls-files"], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 })
    .split("\n")
    .filter(Boolean);
}

function isScannable(file) {
  if (SKIP_PATH.some((rule) => rule.test(file.replace(/\\/gu, "/")))) return false;
  const ext = extname(file).toLowerCase();
  if (!TEXT_EXTENSIONS.has(ext)) return false;
  try {
    return statSync(file).size <= MAX_BYTES;
  } catch (_) {
    return false;
  }
}

function main() {
  const files = listFiles(process.argv.slice(2)).filter(isScannable);
  const problems = [];

  for (const file of files) {
    let text;
    try {
      text = readFileSync(file, "utf8");
    } catch (_) {
      continue;
    }
    for (const finding of scanText(text)) {
      problems.push(`${file}:${finding.line}  ${finding.name}  ${mask(finding.match)}`);
    }
  }

  if (problems.length) {
    console.error(`check-secrets: ${problems.length} possible credential(s) found\n`);
    for (const problem of problems) console.error(`  ${problem}`);
    console.error(
      "\nRemove the value, use a placeholder (sk-test-…), or add `allow-secret-scan` on that line.",
    );
    process.exit(1);
  }

  console.log(`check-secrets: scanned ${files.length} file(s), no credentials found`);
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("check-secrets.mjs")) {
  main();
}
