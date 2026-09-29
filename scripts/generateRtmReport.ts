// Builds docs/coverage/rtm-coverage-report.html from docs/RTM.md, the feature files,
// the Page Objects, and the latest Cucumber JSON (reports/cucumber-report.json).
//
// Runs after every npm test profile (see package.json) and on demand via `npm run report:rtm`.
// Only scenario names, tags, statuses and durations are read from the run JSON. Error
// messages and embedded screenshots are ignored on purpose: they can contain account data.
import * as fs from 'fs';
import * as path from 'path';

const root = path.resolve(__dirname, '..');
const rtmPath = path.join(root, 'docs/RTM.md');
const featuresDir = path.join(root, 'features');
const pagesDir = path.join(root, 'pages');
const runJsonPath = path.join(root, 'reports/cucumber-report.json');
const outPath = path.join(root, 'docs/coverage/rtm-coverage-report.html');

type Status = 'passed' | 'failed' | 'skipped' | 'pending' | 'undefined' | 'ambiguous' | 'not-run';
type Level = 'pass' | 'warn' | 'fail';

interface Check {
  level: Level;
  message: string;
}

interface AutomatedRow {
  caseId: string;
  ztm: string;
  requirement: string;
  featureFile: string;
  scenario: string;
  coveredWithin: boolean;
  tags: string[];
  stepFiles: string[];
  methods: { pageClass: string; method: string }[];
  lastResult: string;
}

interface OtherRow {
  caseId: string;
  requirement: string;
  status: string;
  reason: string;
}

interface FeatureScenario {
  featureFile: string;
  name: string;
  tags: string[];
}

interface RunResult {
  status: Status;
  seconds: number;
}

// ---------- parsing ----------

function backticked(cell: string): string[] {
  return [...cell.matchAll(/`([^`]+)`/g)].map((m) => m[1]);
}

function tableRows(markdown: string, heading: string): string[][] {
  const start = markdown.indexOf(`## ${heading}`);
  if (start === -1) return [];
  const rest = markdown.slice(start + heading.length + 3);
  const end = rest.search(/\n## /);
  const section = end === -1 ? rest : rest.slice(0, end);
  return section
    .split('\n')
    .filter((line) => line.startsWith('|'))
    .slice(2) // header + separator
    .map((line) => line.replace(/^\|\s*|\s*\|\s*$/g, '').split(/\s*\|\s*/));
}

function parseRtm(): { automated: AutomatedRow[]; other: OtherRow[]; lastUpdated: string } {
  const md = fs.readFileSync(rtmPath, 'utf8');
  const automated = tableRows(md, 'Automated').map((c): AutomatedRow => {
    let currentClass = '';
    const methods: { pageClass: string; method: string }[] = [];
    for (const item of backticked(c[7] ?? '')) {
      const qualified = item.match(/^(\w+)\.(\w+)\(\)$/);
      const bare = item.match(/^(\w+)\(\)$/);
      if (qualified) {
        currentClass = qualified[1];
        methods.push({ pageClass: currentClass, method: qualified[2] });
      } else if (bare && currentClass) {
        methods.push({ pageClass: currentClass, method: bare[1] });
      }
    }
    return {
      caseId: c[0],
      ztm: c[1],
      requirement: c[2],
      featureFile: backticked(c[3])[0] ?? '',
      scenario: backticked(c[4])[0] ?? c[4],
      coveredWithin: /^Covered within/i.test(c[4]),
      tags: backticked(c[5]).join(' ').split(/\s+/).filter(Boolean),
      stepFiles: backticked(c[6] ?? '').filter((f) => f.endsWith('.ts')),
      methods,
      lastResult: c[8] ?? '',
    };
  });
  const other = tableRows(md, 'Not yet automated / not automated').map(
    (c): OtherRow => ({ caseId: c[0], requirement: c[1], status: c[2], reason: c[3] }),
  );
  const lastUpdated = md.match(/^Last updated: ([^.]+)\./m)?.[1] ?? 'unknown';
  return { automated, other, lastUpdated };
}

function parseFeatures(): FeatureScenario[] {
  const scenarios: FeatureScenario[] = [];
  for (const file of fs.readdirSync(featuresDir).filter((f) => f.endsWith('.feature')).sort()) {
    const rel = `features/${file}`;
    let featureTags: string[] = [];
    let pending: string[] = [];
    for (const raw of fs.readFileSync(path.join(featuresDir, file), 'utf8').split('\n')) {
      const line = raw.trim();
      if (line.startsWith('@')) {
        pending.push(...line.split(/\s+/).filter((t) => t.startsWith('@')));
      } else if (/^Feature:/.test(line)) {
        featureTags = pending;
        pending = [];
      } else if (/^Scenario( Outline)?:/.test(line)) {
        scenarios.push({
          featureFile: rel,
          name: line.replace(/^Scenario( Outline)?:\s*/, ''),
          tags: [...featureTags, ...pending],
        });
        pending = [];
      }
    }
  }
  return scenarios;
}

function parseRun(): { results: Map<string, RunResult>; writtenAt: Date | null } {
  const results = new Map<string, RunResult>();
  if (!fs.existsSync(runJsonPath)) return { results, writtenAt: null };
  const writtenAt = fs.statSync(runJsonPath).mtime;
  const features: any[] = JSON.parse(fs.readFileSync(runJsonPath, 'utf8'));
  for (const feature of features) {
    for (const element of feature.elements ?? []) {
      if (element.type !== 'scenario') continue;
      const statuses: string[] = (element.steps ?? []).map((s: any) => s.result?.status ?? 'unknown');
      const nanos = (element.steps ?? []).reduce((sum: number, s: any) => sum + (s.result?.duration ?? 0), 0);
      const status: Status = statuses.includes('failed')
        ? 'failed'
        : (['ambiguous', 'undefined', 'pending'].find((s) => statuses.includes(s)) as Status | undefined) ??
          (statuses.includes('skipped') ? 'skipped' : 'passed');
      results.set(`${feature.uri}::${element.name}`, { status, seconds: nanos / 1e9 });
    }
  }
  return { results, writtenAt };
}

// ---------- checks ----------

function sameTags(a: string[], b: string[]): boolean {
  return [...a].sort().join(' ') === [...b].sort().join(' ');
}

function methodExists(pageClass: string, method: string): boolean {
  const file = path.join(pagesDir, `${pageClass}.ts`);
  if (!fs.existsSync(file)) return false;
  const source = fs.readFileSync(file, 'utf8');
  return new RegExp(`\\n\\s*(?:public\\s+|protected\\s+|private\\s+)?(?:async\\s+)?${method}\\s*\\(`).test(source);
}

function checkRow(row: AutomatedRow, scenarios: FeatureScenario[], run: RunResult | undefined): Check[] {
  const checks: Check[] = [];
  const match = scenarios.find((s) => s.featureFile === row.featureFile && s.name === row.scenario);

  if (!fs.existsSync(path.join(root, row.featureFile))) {
    checks.push({ level: 'fail', message: `Feature file ${row.featureFile} does not exist` });
  } else if (!match) {
    checks.push({ level: 'fail', message: `Scenario not found in ${row.featureFile}` });
  } else {
    checks.push({ level: 'pass', message: 'Scenario exists in the feature file' });
    checks.push(
      sameTags(row.tags, match.tags)
        ? { level: 'pass', message: 'RTM tags match the feature tags' }
        : { level: 'fail', message: `RTM tags (${row.tags.join(' ')}) differ from feature tags (${match.tags.join(' ')})` },
    );
    const ztmTags = match.tags.filter((t) => /^@ZTM-\d+$/.test(t));
    if (/^ZTM-\d+$/.test(row.ztm)) {
      const ok = ztmTags.includes(`@${row.ztm}`) && match.name.startsWith(`${row.ztm}:`);
      checks.push(
        ok
          ? { level: 'pass', message: `${row.ztm} matches the tag and scenario-name prefix` }
          : { level: 'fail', message: `${row.ztm} must be both a tag and the scenario-name prefix` },
      );
    } else if (ztmTags.length > 0) {
      checks.push({ level: 'fail', message: `RTM says ${row.ztm}, but the scenario is tagged ${ztmTags.join(' ')}` });
    }
  }

  for (const stepFile of row.stepFiles) {
    checks.push(
      fs.existsSync(path.join(root, stepFile))
        ? { level: 'pass', message: `${stepFile} exists` }
        : { level: 'fail', message: `${stepFile} does not exist` },
    );
  }

  const missing = row.methods.filter((m) => !methodExists(m.pageClass, m.method));
  if (row.methods.length > 0) {
    checks.push(
      missing.length === 0
        ? { level: 'pass', message: `All ${row.methods.length} Page Object methods exist` }
        : { level: 'fail', message: `Missing methods: ${missing.map((m) => `${m.pageClass}.${m.method}()`).join(', ')}` },
    );
  }

  if (run && run.status !== 'passed' && /^Passed/i.test(row.lastResult)) {
    checks.push({ level: 'warn', message: `RTM says "${row.lastResult}", but the latest run was ${run.status}` });
  }
  if (run && run.status === 'passed' && /^Failed/i.test(row.lastResult)) {
    checks.push({ level: 'warn', message: `RTM says "${row.lastResult}", but the latest run passed` });
  }
  return checks;
}

// ---------- rendering ----------

function esc(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!);
}

function formatDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

const statusLabel: Record<Status, string> = {
  passed: 'Passed',
  failed: 'Failed',
  skipped: 'Skipped',
  pending: 'Pending',
  undefined: 'Undefined',
  ambiguous: 'Ambiguous',
  'not-run': 'Not in this run',
};

function badge(status: Status): string {
  const tone = status === 'passed' ? 'pass' : status === 'not-run' ? 'muted' : status === 'skipped' ? 'warn' : 'fail';
  return `<span class="badge ${tone}">${statusLabel[status]}</span>`;
}

function checkList(checks: Check[]): string {
  const icon: Record<Level, string> = { pass: '✓', warn: '!', fail: '✗' };
  return `<ul class="checks">${checks
    .map((c) => `<li class="${c.level}"><span>${icon[c.level]}</span> ${esc(c.message)}</li>`)
    .join('')}</ul>`;
}

function render(): string {
  const { automated, other, lastUpdated } = parseRtm();
  const scenarios = parseFeatures();
  const { results, writtenAt } = parseRun();
  const command = process.argv[2] ?? 'npm run report:rtm (manual)';

  const rowData = automated.map((row) => {
    const run = results.get(`${row.featureFile}::${row.scenario}`);
    return { row, run, checks: checkRow(row, scenarios, run) };
  });

  const mapped = new Set(automated.map((r) => `${r.featureFile}::${r.scenario}`));
  const orphans = scenarios.filter((s) => !mapped.has(`${s.featureFile}::${s.name}`));
  const globalChecks: Check[] = orphans.length
    ? orphans.map((s) => ({ level: 'fail' as Level, message: `Scenario "${s.name}" (${s.featureFile}) has no test case in the RTM` }))
    : [{ level: 'pass', message: `All ${scenarios.length} scenarios in features/ are mapped to at least one test case` }];

  const allChecks = [...globalChecks, ...rowData.flatMap((d) => d.checks)];
  const count = (l: Level) => allChecks.filter((c) => c.level === l).length;

  const runStatuses = [...results.values()].map((r) => r.status);
  const runCount = (s: Status) => runStatuses.filter((x) => x === s).length;
  const runSeconds = [...results.values()].reduce((sum, r) => sum + r.seconds, 0);

  const caseRows = rowData
    .map(({ row, run, checks }) => {
      const worst: Level = checks.some((c) => c.level === 'fail') ? 'fail' : checks.some((c) => c.level === 'warn') ? 'warn' : 'pass';
      return `<tr>
  <td><strong>${esc(row.caseId)}</strong></td>
  <td>${esc(row.ztm)}</td>
  <td>${esc(row.requirement)}</td>
  <td><code>${esc(row.featureFile)}</code><br>${row.coveredWithin ? '<em>covered within</em> ' : ''}${esc(row.scenario)}</td>
  <td>${row.tags.map((t) => `<span class="tag">${esc(t)}</span>`).join(' ')}</td>
  <td>${badge(run?.status ?? 'not-run')}${run ? `<div class="dim">${run.seconds.toFixed(1)} s</div>` : ''}</td>
  <td><details class="${worst}"><summary>${worst === 'pass' ? 'All checks pass' : worst === 'warn' ? 'Warnings' : 'Failures'}</summary>${checkList(checks)}</details></td>
</tr>`;
    })
    .join('\n');

  const scenarioRows = scenarios
    .map((s) => {
      const cases = automated.filter((r) => r.featureFile === s.featureFile && r.scenario === s.name).map((r) => r.caseId);
      const run = results.get(`${s.featureFile}::${s.name}`);
      return `<tr>
  <td><code>${esc(s.featureFile)}</code></td>
  <td>${esc(s.name)}</td>
  <td>${s.tags.map((t) => `<span class="tag">${esc(t)}</span>`).join(' ')}</td>
  <td>${cases.length ? cases.map((c) => `<strong>${esc(c)}</strong>`).join(', ') : '<span class="badge fail">Unmapped</span>'}</td>
  <td>${badge(run?.status ?? 'not-run')}</td>
</tr>`;
    })
    .join('\n');

  const otherRows = other
    .map(
      (o) => `<tr><td><strong>${esc(o.caseId)}</strong></td><td>${esc(o.requirement)}</td><td>${esc(o.status)}</td><td>${esc(o.reason.replace(/`/g, ''))}</td></tr>`,
    )
    .join('\n');

  const runSummary = writtenAt
    ? `<div class="stat"><b>${results.size}</b><span>scenarios in run</span></div>
       <div class="stat pass"><b>${runCount('passed')}</b><span>passed</span></div>
       <div class="stat fail"><b>${runStatuses.length - runCount('passed') - runCount('skipped')}</b><span>failed / undefined</span></div>
       <div class="stat warn"><b>${runCount('skipped')}</b><span>skipped</span></div>
       <div class="stat"><b>${runSeconds.toFixed(1)} s</b><span>scenario time</span></div>`
    : `<p class="dim">No run results found (reports/cucumber-report.json is missing). Run <code>npm test</code> first.</p>`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>ZincBank RTM Coverage</title>
<style>
  :root {
    --bg: #f7f7f5; --panel: #ffffff; --text: #1d1d1b; --dim: #6b6b66; --line: #e3e3de;
    --pass: #1f7a4d; --pass-bg: #e3f3ea; --fail: #b3261e; --fail-bg: #fbe7e5;
    --warn: #8a5a00; --warn-bg: #fdf1d8; --muted-bg: #ececea; --accent: #2f5bd3;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg: #151514; --panel: #1f1f1d; --text: #ececea; --dim: #9c9c96; --line: #34342f;
      --pass: #6fd3a0; --pass-bg: #1d3a2b; --fail: #f28b82; --fail-bg: #45201d;
      --warn: #f2c46b; --warn-bg: #3d3018; --muted-bg: #2c2c29; --accent: #8fa8ff;
    }
  }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--text); font: 14px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
  main { max-width: 1200px; margin: 0 auto; padding: 32px 16px 64px; }
  h1 { font-size: 24px; margin: 0 0 4px; }
  h2 { font-size: 17px; margin: 36px 0 12px; }
  .dim { color: var(--dim); font-size: 12px; }
  .meta { color: var(--dim); margin-bottom: 20px; }
  .stats { display: flex; flex-wrap: wrap; gap: 12px; }
  .stat { background: var(--panel); border: 1px solid var(--line); border-radius: 10px; padding: 12px 16px; min-width: 120px; }
  .stat b { display: block; font-size: 22px; }
  .stat span { color: var(--dim); font-size: 12px; }
  .stat.pass b { color: var(--pass); } .stat.fail b { color: var(--fail); } .stat.warn b { color: var(--warn); }
  .panel { background: var(--panel); border: 1px solid var(--line); border-radius: 10px; overflow-x: auto; }
  table { width: 100%; border-collapse: collapse; }
  th, td { text-align: left; vertical-align: top; padding: 10px 12px; border-bottom: 1px solid var(--line); }
  th { font-size: 12px; text-transform: uppercase; letter-spacing: .04em; color: var(--dim); font-weight: 600; }
  tr:last-child td { border-bottom: 0; }
  code { font: 12px ui-monospace, SFMono-Regular, Menlo, monospace; color: var(--accent); }
  .tag { display: inline-block; font: 12px ui-monospace, Menlo, monospace; background: var(--muted-bg); border-radius: 4px; padding: 1px 6px; margin: 1px 0; }
  .badge { display: inline-block; font-size: 12px; font-weight: 600; border-radius: 999px; padding: 2px 10px; white-space: nowrap; }
  .badge.pass { color: var(--pass); background: var(--pass-bg); }
  .badge.fail { color: var(--fail); background: var(--fail-bg); }
  .badge.warn { color: var(--warn); background: var(--warn-bg); }
  .badge.muted { color: var(--dim); background: var(--muted-bg); }
  details summary { cursor: pointer; font-weight: 600; white-space: nowrap; }
  details.pass summary { color: var(--pass); } details.warn summary { color: var(--warn); } details.fail summary { color: var(--fail); }
  ul.checks { list-style: none; margin: 8px 0 0; padding: 0; }
  ul.checks li { padding: 2px 0; }
  ul.checks li span { display: inline-block; width: 16px; font-weight: 700; }
  ul.checks li.pass span { color: var(--pass); } ul.checks li.warn span { color: var(--warn); } ul.checks li.fail span { color: var(--fail); }
  .summary-checks { padding: 12px 16px; }
</style>
</head>
<body>
<main>
  <h1>ZincBank RTM Coverage</h1>
  <div class="meta">
    Generated ${formatDate(new Date())} by <code>${esc(command)}</code><br>
    Run results: <code>reports/cucumber-report.json</code> ${writtenAt ? `written ${formatDate(writtenAt)}` : '(missing)'} ·
    Mapping: <code>docs/RTM.md</code> (last updated ${esc(lastUpdated)})
  </div>

  <h2>Latest run</h2>
  <div class="stats">${runSummary}</div>

  <h2>RTM checks</h2>
  <div class="stats">
    <div class="stat pass"><b>${count('pass')}</b><span>passed</span></div>
    <div class="stat warn"><b>${count('warn')}</b><span>warnings</span></div>
    <div class="stat fail"><b>${count('fail')}</b><span>failed</span></div>
  </div>
  <div class="panel summary-checks" style="margin-top:12px">${checkList(globalChecks)}</div>

  <h2>Test case → scenario</h2>
  <div class="panel"><table>
    <thead><tr><th>Case</th><th>ZTM</th><th>Requirement</th><th>Scenario</th><th>Tags</th><th>Latest run</th><th>RTM checks</th></tr></thead>
    <tbody>
${caseRows}
    </tbody>
  </table></div>

  <h2>Scenario → test cases</h2>
  <div class="panel"><table>
    <thead><tr><th>Feature</th><th>Scenario</th><th>Tags</th><th>Test cases</th><th>Latest run</th></tr></thead>
    <tbody>
${scenarioRows}
    </tbody>
  </table></div>

  <h2>Not automated / not yet automated</h2>
  <div class="panel"><table>
    <thead><tr><th>Case</th><th>Requirement</th><th>Status</th><th>Reason</th></tr></thead>
    <tbody>
${otherRows}
    </tbody>
  </table></div>
</main>
</body>
</html>
`;
}

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, render());
console.log(`RTM report written: ${path.relative(root, outPath)}`);
