#!/usr/bin/env npx ts-node

/**
 * `analyze` — read a lab's step inventory and report what it'll take to test.
 *
 * Reads `courses/<course>/lab<N>.inventory.ts`, prints:
 *   - Strategy breakdown (how many local-cli vs aws-cli vs manual-only)
 *   - Tooling derived from the inventory
 *   - Manual-only steps that need human attention
 *   - Drift check: inventory's sourceHash vs current lab markdown hash
 *
 * Usage:
 *   npm run analyze -- terraform 1
 */

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { LabInventory, summarize, StepStrategy } from '../core/inventory';

const FRAMEWORK_ROOT = path.join(__dirname, '..');

function loadInventory(course: string, labNumber: number): LabInventory {
  const file = path.join(FRAMEWORK_ROOT, 'courses', course, `lab${labNumber}.inventory.ts`);
  if (!fs.existsSync(file)) {
    throw new Error(`No inventory file at ${path.relative(FRAMEWORK_ROOT, file)}.\nCreate it by exporting a LabInventory from that path.`);
  }
  const mod = require(file);
  const inv: LabInventory | undefined = mod.inventory || mod.default;
  if (!inv) {
    throw new Error(`Inventory file must export const \`inventory\` or default.`);
  }
  return inv;
}

function hashFile(absPath: string): string {
  return crypto.createHash('sha256').update(fs.readFileSync(absPath)).digest('hex');
}

function short(h: string): string {
  return h ? h.slice(0, 12) : '—';
}

const STRATEGY_ORDER: StepStrategy[] = [
  'local-cli', 'local-install', 'aws-cli', 'aws-ui', 'external-ui', 'manual-only',
];

function pct(n: number, total: number): string {
  if (total === 0) return '  0%';
  return `${Math.round((n / total) * 100).toString().padStart(3)}%`;
}

function main(): void {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.log('Usage: npm run analyze -- <course> <lab-number>');
    process.exit(1);
  }
  const [course, labNumStr] = args;
  const labNumber = parseInt(labNumStr, 10);

  let inv: LabInventory;
  try {
    inv = loadInventory(course, labNumber);
  } catch (e: any) {
    console.error(`\n✗ ${e.message}\n`);
    process.exit(1);
  }

  const breakdown = summarize(inv);

  console.log('');
  console.log(`╔══════════════════════════════════════════════════════════════════════╗`);
  console.log(`║  ${inv.course.toUpperCase()} — Lab ${inv.labNumber}: ${inv.labName}`);
  console.log(`╚══════════════════════════════════════════════════════════════════════╝`);
  console.log('');
  console.log(`Source: ${inv.sourcePath}`);
  if (fs.existsSync(inv.sourcePath)) {
    const currentHash = hashFile(inv.sourcePath);
    if (currentHash === inv.sourceHash) {
      console.log(`Hash:   ${short(currentHash)} (matches inventory)`);
    } else {
      console.log(`Hash:   ${short(currentHash)}  ⚠ INVENTORY DRIFT`);
      console.log(`        Inventory authored against ${short(inv.sourceHash)}.`);
      console.log(`        Re-read the lab and update the inventory.`);
    }
  } else {
    console.log(`Hash:   ✗ source file missing`);
  }

  console.log(`Steps:  ${breakdown.total} total`);
  console.log('');

  console.log('Strategy breakdown:');
  for (const s of STRATEGY_ORDER) {
    const count = breakdown.byStrategy[s];
    if (count === 0) continue;
    const bar = '#'.repeat(Math.round((count / breakdown.total) * 30));
    console.log(`  ${s.padEnd(14)} ${count.toString().padStart(3)}  ${pct(count, breakdown.total)}  ${bar}`);
  }
  console.log('');

  const automatableCount =
    breakdown.byStrategy['local-cli'] +
    breakdown.byStrategy['local-install'] +
    breakdown.byStrategy['aws-cli'] +
    breakdown.byStrategy['aws-ui'] +
    breakdown.byStrategy['external-ui'];
  console.log(`Automatable: ${automatableCount}/${breakdown.total} (${pct(automatableCount, breakdown.total).trim()})`);
  console.log(`Manual-only: ${breakdown.byStrategy['manual-only']}/${breakdown.total} (${pct(breakdown.byStrategy['manual-only'], breakdown.total).trim()})`);
  console.log('');

  const toolNames = Object.keys(breakdown.toolUsage).sort();
  if (toolNames.length > 0) {
    console.log('Required tooling:');
    for (const t of toolNames) {
      console.log(`  ${t.padEnd(20)} (used in ${breakdown.toolUsage[t]} step${breakdown.toolUsage[t] > 1 ? 's' : ''})`);
    }
    console.log('');
  }

  if (inv.externalResources && inv.externalResources.length > 0) {
    console.log('External resources:');
    for (const r of inv.externalResources) {
      console.log(`  [${r.kind}] ${r.url}${r.description ? ' — ' + r.description : ''}`);
    }
    console.log('');
  }

  if (breakdown.manualSteps.length > 0) {
    console.log('Manual-only steps (cannot be fully automated):');
    for (const s of breakdown.manualSteps) {
      console.log(`  ${s.stepId.padEnd(5)} ${s.title}`);
      if (s.notes) console.log(`         └─ ${s.notes}`);
    }
    console.log('');
  }

  if (breakdown.failureSteps.length > 0) {
    console.log('Steps that intentionally expect failure:');
    for (const s of breakdown.failureSteps) {
      console.log(`  ${s.stepId.padEnd(5)} ${s.title}`);
    }
    console.log('');
  }
}

if (require.main === module) {
  main();
}
