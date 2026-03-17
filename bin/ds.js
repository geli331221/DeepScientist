#!/usr/bin/env node
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { spawn, spawnSync } = require('node:child_process');

const repoRoot = path.resolve(__dirname, '..');
const srcPath = path.join(repoRoot, 'src');
const packageJson = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
const pythonCandidates = process.platform === 'win32' ? ['python', 'py'] : ['python3', 'python'];
const pythonCommands = new Set([
  'init',
  'new',
  'status',
  'pause',
  'resume',
  'daemon',
  'run',
  'note',
  'approve',
  'graph',
  'doctor',
  'docker',
  'push',
  'memory',
  'baseline',
  'latex',
  'config',
]);

const optionsWithValues = new Set(['--home', '--host', '--port', '--quest-id', '--mode']);

function printLauncherHelp() {
  console.log(`DeepScientist launcher

Usage:
  ds
  ds --tui
  ds --both
  ds --stop
  ds --restart
  ds doctor
  ds latex status
  ds --home ~/DeepScientist --port 20999

Advanced Python CLI:
  ds init
  ds new "reproduce baseline and test one stronger idea"
  ds doctor
  ds latex install-runtime
  ds run decision --quest-id 001 --message "review current state"
`);
}

function ensureDir(targetPath) {
  fs.mkdirSync(targetPath, { recursive: true });
}

function resolveHome(args) {
  const index = args.indexOf('--home');
  if (index >= 0 && index + 1 < args.length) {
    return path.resolve(args[index + 1]);
  }
  if (process.env.DEEPSCIENTIST_HOME) {
    return path.resolve(process.env.DEEPSCIENTIST_HOME);
  }
  return path.join(os.homedir(), 'DeepScientist');
}

function formatHttpHost(host) {
  const normalized = String(host || '').trim();
  if (!normalized) {
    return '127.0.0.1';
  }
  if (normalized.startsWith('[') && normalized.endsWith(']')) {
    return normalized;
  }
  return normalized.includes(':') ? `[${normalized}]` : normalized;
}

function browserUiUrl(host, port) {
  const normalized = String(host || '').trim();
  const browserHost =
    !normalized || normalized === '0.0.0.0' || normalized === '::' || normalized === '[::]'
      ? '127.0.0.1'
      : normalized;
  return `http://${formatHttpHost(browserHost)}:${port}`;
}

function bindUiUrl(host, port) {
  const normalized = String(host || '').trim() || '0.0.0.0';
  return `http://${formatHttpHost(normalized)}:${port}`;
}

function normalizeMode(value) {
  const normalized = String(value || '')
    .trim()
    .toLowerCase();
  if (normalized === 'tui' || normalized === 'both' || normalized === 'web') {
    return normalized;
  }
  return 'web';
}

function parseBooleanSetting(rawValue, fallback = false) {
  if (typeof rawValue === 'boolean') {
    return rawValue;
  }
  const normalized = String(rawValue || '')
    .trim()
    .toLowerCase();
  if (['true', 'yes', 'on', '1'].includes(normalized)) {
    return true;
  }
  if (['false', 'no', 'off', '0'].includes(normalized)) {
    return false;
  }
  return fallback;
}

function supportsAnsi() {
  return Boolean(process.stdout.isTTY && process.env.TERM !== 'dumb');
}

function stripAnsi(text) {
  return String(text || '')
    .replace(/\u001B]8;;[^\u0007]*\u0007/g, '')
    .replace(/\u001B]8;;\u0007/g, '')
    .replace(/\u001B\[[0-9;]*m/g, '');
}

function visibleWidth(text) {
  return stripAnsi(text).length;
}

function centerText(text, width) {
  const targetWidth = Math.max(visibleWidth(text), width || 0);
  const padding = Math.max(0, Math.floor((targetWidth - visibleWidth(text)) / 2));
  return `${' '.repeat(padding)}${text}`;
}

function hyperlink(url, label = url) {
  if (!supportsAnsi()) {
    return label;
  }
  return `\u001B]8;;${url}\u0007${label}\u001B]8;;\u0007`;
}

function colorize(code, text) {
  if (!supportsAnsi()) {
    return text;
  }
  return `${code}${text}\u001B[0m`;
}

function renderBrandArtwork() {
  const brandPath = path.join(repoRoot, 'assets', 'branding', 'deepscientist-mark.png');
  const chafa = resolveExecutableOnPath('chafa');
  if (!supportsAnsi() || !chafa || !fs.existsSync(brandPath)) {
    return [];
  }
  const width = Math.max(18, Math.min(30, Math.floor((process.stdout.columns || 100) / 3)));
  const height = Math.max(8, Math.floor(width / 2));
  try {
    const result = spawnSync(
      chafa,
      ['--size', `${width}x${height}`, '--format', 'symbols', '--colors', '16', brandPath],
      { encoding: 'utf8' }
    );
    if (result.status === 0 && result.stdout && result.stdout.trim()) {
      return result.stdout.replace(/\s+$/, '').split(/\r?\n/);
    }
  } catch {}
  return [];
}

function printLaunchCard({ url, bindUrl, mode, autoOpenRequested, browserOpened, daemonOnly }) {
  const width = Math.max(72, Math.min(process.stdout.columns || 100, 108));
  const divider = colorize('\u001B[38;5;245m', '─'.repeat(Math.max(36, width - 6)));
  const title = colorize('\u001B[1;38;5;39m', 'ResearAI');
  const subtitle = colorize('\u001B[38;5;110m', 'Local-first research operating system');
  const urlLabel = colorize('\u001B[1;38;5;45m', hyperlink(url, url));
  const workspaceMode =
    mode === 'both'
      ? 'Web workspace + terminal workspace'
      : mode === 'tui'
        ? 'Terminal workspace'
        : 'Web workspace';
  const browserLine = autoOpenRequested
    ? browserOpened
      ? 'Browser launch requested successfully.'
      : 'Browser auto-open was requested but is not available in this terminal session.'
    : 'Browser auto-open is disabled. Open the URL manually if needed.';
  const nextStep = daemonOnly
    ? 'Use ds --tui to enter the terminal workspace.'
    : mode === 'web'
      ? 'Use ds --tui to enter the terminal workspace.'
      : mode === 'both'
        ? 'The terminal workspace starts below.'
        : 'Use Ctrl+O inside TUI to reopen the web workspace.';

  console.log('');
  const artwork = renderBrandArtwork();
  for (const line of artwork) {
    console.log(centerText(line, width));
  }
  if (artwork.length === 0) {
    console.log(centerText(colorize('\u001B[1;38;5;39m', '⛰'), width));
  }
  const wordmark = [
    '  ____                  ____       _            _   _     _   ',
    ' |  _ \\  ___  ___ _ __ / ___|  ___(_) ___ _ __ | |_(_)___| |_ ',
    " | | | |/ _ \\/ _ \\ '_ \\\\___ \\ / __| |/ _ \\ '_ \\| __| / __| __|",
    ' | |_| |  __/  __/ |_) |___) | (__| |  __/ | | | |_| \\__ \\ |_ ',
    ' |____/ \\___|\\___| .__/|____/ \\___|_|\\___|_| |_|\\__|_|___/\\__|',
    '                 |_|                                          ',
  ];
  console.log(centerText(title, width));
  for (const line of wordmark) {
    console.log(centerText(colorize('\u001B[1;38;5;39m', line), width));
  }
  console.log(centerText(subtitle, width));
  console.log('');
  console.log(centerText(divider, width));
  console.log(centerText(colorize('\u001B[1m', workspaceMode), width));
  console.log(centerText(urlLabel, width));
  console.log(centerText(divider, width));
  console.log(centerText(browserLine, width));
  console.log(centerText(`Daemon bind: ${bindUrl}`, width));
  console.log(centerText(nextStep, width));
  console.log(centerText('Run ds --stop to stop the managed daemon.', width));
  console.log('');
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function writeCodexPreflightReport(home, probe) {
  const reportDir = path.join(home, 'runtime', 'preflight');
  ensureDir(reportDir);
  const reportPath = path.join(reportDir, 'codex-preflight.html');
  const warnings = Array.isArray(probe?.warnings) ? probe.warnings : [];
  const errors = Array.isArray(probe?.errors) ? probe.errors : [];
  const guidance = Array.isArray(probe?.guidance) ? probe.guidance : [];
  const details = probe && typeof probe.details === 'object' ? probe.details : {};
  const renderItems = (items, tone) =>
    items
      .map(
        (item) =>
          `<li class="item item--${tone}">${escapeHtml(item)}</li>`
      )
      .join('');
  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>DeepScientist Codex check failed</title>
    <style>
      :root { color-scheme: light dark; font-family: Inter, system-ui, sans-serif; }
      body {
        margin: 0;
        min-height: 100vh;
        background:
          radial-gradient(120% 80% at 10% 0%, rgba(210, 198, 180, 0.28), transparent 58%),
          radial-gradient(80% 70% at 90% 10%, rgba(171, 186, 199, 0.24), transparent 55%),
          linear-gradient(180deg, rgba(250,247,241,0.98), rgba(244,239,233,0.98));
        color: #1f2937;
      }
      .page { max-width: 960px; margin: 0 auto; padding: 40px 20px 64px; }
      .panel {
        border: 1px solid rgba(15, 23, 42, 0.08);
        border-radius: 28px;
        background: rgba(255, 255, 255, 0.8);
        box-shadow: 0 24px 80px -52px rgba(18, 24, 32, 0.35);
        backdrop-filter: blur(18px);
        padding: 28px;
      }
      h1 { margin: 0 0 12px; font-size: 28px; }
      h2 { margin: 28px 0 10px; font-size: 16px; }
      p, li { line-height: 1.7; }
      .meta { color: #5b6472; font-size: 14px; }
      .item { margin: 8px 0; padding-left: 12px; border-left: 2px solid transparent; }
      .item--error { border-left-color: rgba(225, 72, 72, 0.55); color: #9f1d1d; }
      .item--warn { border-left-color: rgba(217, 149, 42, 0.55); color: #8a5a00; }
      pre {
        margin: 0;
        padding: 14px 16px;
        overflow: auto;
        border-radius: 18px;
        background: rgba(15, 23, 42, 0.05);
        white-space: pre-wrap;
        word-break: break-word;
      }
      .grid { display: grid; gap: 16px; }
      @media (min-width: 860px) { .grid { grid-template-columns: 1fr 1fr; } }
      .kv { margin: 0; }
      .kv dt { font-size: 12px; color: #667085; text-transform: uppercase; letter-spacing: .08em; }
      .kv dd { margin: 6px 0 0; font-size: 14px; word-break: break-all; }
    </style>
  </head>
  <body>
    <main class="page">
      <section class="panel">
        <h1>DeepScientist could not start Codex</h1>
        <p class="meta">DeepScientist blocked startup because the Codex hello probe did not pass. Please run <code>codex</code>, complete login, then launch <code>ds</code> again.</p>
        <p class="meta">DeepScientist 启动前进行了 Codex 可用性检查，但 hello 探测没有通过。请先手动运行 <code>codex</code> 并完成登录，再重新启动 <code>ds</code>。</p>

        <h2>Summary</h2>
        <p>${escapeHtml(probe?.summary || 'Codex startup probe failed.')}</p>

        ${errors.length ? `<h2>Errors</h2><ul>${renderItems(errors, 'error')}</ul>` : ''}
        ${warnings.length ? `<h2>Warnings</h2><ul>${renderItems(warnings, 'warn')}</ul>` : ''}
        ${guidance.length ? `<h2>What to do next</h2><ul>${guidance.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>` : ''}

        <h2>Probe details</h2>
        <div class="grid">
          <dl class="kv">
            <dt>Binary</dt>
            <dd>${escapeHtml(details.binary || '')}</dd>
          </dl>
          <dl class="kv">
            <dt>Resolved binary</dt>
            <dd>${escapeHtml(details.resolved_binary || '')}</dd>
          </dl>
          <dl class="kv">
            <dt>Model</dt>
            <dd>${escapeHtml(details.model || '')}</dd>
          </dl>
          <dl class="kv">
            <dt>Exit code</dt>
            <dd>${escapeHtml(details.exit_code ?? '')}</dd>
          </dl>
        </div>

        ${details.stdout_excerpt ? `<h2>Stdout</h2><pre>${escapeHtml(details.stdout_excerpt)}</pre>` : ''}
        ${details.stderr_excerpt ? `<h2>Stderr</h2><pre>${escapeHtml(details.stderr_excerpt)}</pre>` : ''}
      </section>
    </main>
  </body>
</html>`;
  fs.writeFileSync(reportPath, html, 'utf8');
  return {
    path: reportPath,
    url: pathToFileURL(reportPath).toString(),
  };
}

function readCodexBootstrapState(home, venvPython) {
  const snippet = [
    'import json, pathlib, sys',
    'from deepscientist.config import ConfigManager',
    'home = pathlib.Path(sys.argv[1])',
    'manager = ConfigManager(home)',
    'print(json.dumps(manager.codex_bootstrap_state(), ensure_ascii=False))',
  ].join('\n');
  const result = runSync(venvPython, ['-c', snippet, home], { capture: true, allowFailure: true });
  if (result.status !== 0) {
    return { codex_ready: false, codex_last_checked_at: null, codex_last_result: {} };
  }
  try {
    return JSON.parse(result.stdout || '{}');
  } catch {
    return { codex_ready: false, codex_last_checked_at: null, codex_last_result: {} };
  }
}

function probeCodexBootstrap(home, venvPython) {
  const snippet = [
    'import json, pathlib, sys',
    'from deepscientist.config import ConfigManager',
    'home = pathlib.Path(sys.argv[1])',
    'manager = ConfigManager(home)',
    'print(json.dumps(manager.probe_codex_bootstrap(persist=True), ensure_ascii=False))',
  ].join('\n');
  const result = runSync(venvPython, ['-c', snippet, home], { capture: true, allowFailure: true });
  let payload = null;
  try {
    payload = JSON.parse(result.stdout || '{}');
  } catch {
    payload = null;
  }
  if (payload && typeof payload === 'object') {
    return payload;
  }
  return {
    ok: false,
    summary: 'Codex startup probe crashed before a structured result was returned.',
    warnings: [],
    errors: [result.stderr || 'Unable to parse the startup probe result.'],
    details: {
      exit_code: result.status ?? null,
      stdout_excerpt: result.stdout || '',
      stderr_excerpt: result.stderr || '',
    },
    guidance: [
      'Run `codex` manually and complete login.',
      'Then start DeepScientist again.',
    ],
  };
}

function createCodexPreflightError(home, probe) {
  const report = writeCodexPreflightReport(home, probe);
  const error = new Error(probe?.summary || 'Codex startup probe failed.');
  error.code = 'DS_CODEX_PREFLIGHT';
  error.reportPath = report.path;
  error.reportUrl = report.url;
  error.probe = probe;
  return error;
}

function parseLauncherArgs(argv) {
  const args = [...argv];
  let mode = null;
  let host = null;
  let port = null;
  let home = null;
  let stop = false;
  let restart = false;
  let openBrowser = null;
  let questId = null;
  let status = false;
  let daemonOnly = false;

  if (args[0] === 'ui') {
    args.shift();
  }

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === 'ui') continue;
    if (arg === '--web') mode = 'web';
    else if (arg === '--tui') mode = 'tui';
    else if (arg === '--both') mode = 'both';
    else if (arg === '--stop') stop = true;
    else if (arg === '--restart') restart = true;
    else if (arg === '--status') status = true;
    else if (arg === '--no-browser') openBrowser = false;
    else if (arg === '--open-browser') openBrowser = true;
    else if (arg === '--daemon-only') daemonOnly = true;
    else if (arg === '--host' && args[index + 1]) host = args[++index];
    else if (arg === '--port' && args[index + 1]) port = Number(args[++index]);
    else if (arg === '--home' && args[index + 1]) home = path.resolve(args[++index]);
    else if (arg === '--quest-id' && args[index + 1]) questId = args[++index];
    else if (arg === '--mode' && args[index + 1]) mode = normalizeMode(args[++index]);
    else if (arg === '--help' || arg === '-h') return { help: true };
    else if (!arg.startsWith('--')) return null;
  }

  return {
    help: false,
    mode,
    host,
    port,
    home,
    stop,
    restart,
    status,
    openBrowser,
    questId,
    daemonOnly,
  };
}

function findFirstPositionalArg(args) {
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (optionsWithValues.has(arg)) {
      index += 1;
      continue;
    }
    if (arg.startsWith('--')) {
      continue;
    }
    return { index, value: arg };
  }
  return null;
}

function resolveSystemPython() {
  for (const binary of pythonCandidates) {
    const result = spawnSync(binary, ['--version'], { stdio: 'ignore' });
    if (result.status === 0) {
      return binary;
    }
  }
  console.error('DeepScientist could not find a working Python 3 interpreter.');
  process.exit(1);
}

function venvPythonPath(home) {
  return process.platform === 'win32'
    ? path.join(home, 'runtime', 'venv', 'Scripts', 'python.exe')
    : path.join(home, 'runtime', 'venv', 'bin', 'python');
}

function venvRootPath(home) {
  return path.join(home, 'runtime', 'venv');
}

function sha256File(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function hashSkillTree() {
  const skillsRoot = path.join(repoRoot, 'src', 'skills');
  const hasher = crypto.createHash('sha256');
  if (!fs.existsSync(skillsRoot)) {
    hasher.update('missing');
    return hasher.digest('hex');
  }
  const stack = [skillsRoot];
  const files = [];
  while (stack.length > 0) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
        continue;
      }
      if (entry.isFile()) {
        files.push(fullPath);
      }
    }
  }
  files.sort();
  for (const filePath of files) {
    hasher.update(path.relative(skillsRoot, filePath));
    hasher.update(fs.readFileSync(filePath));
  }
  return hasher.digest('hex');
}

function discoverSkillIds() {
  const skillsRoot = path.join(repoRoot, 'src', 'skills');
  if (!fs.existsSync(skillsRoot)) {
    return [];
  }
  return fs
    .readdirSync(skillsRoot, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isDirectory() &&
        !entry.name.startsWith('.') &&
        fs.existsSync(path.join(skillsRoot, entry.name, 'SKILL.md'))
    )
    .map((entry) => entry.name)
    .sort();
}

function globalSkillsInstalled() {
  const skillIds = discoverSkillIds();
  const codexRoot = path.join(os.homedir(), '.codex', 'skills');
  const claudeRoot = path.join(os.homedir(), '.claude', 'agents');
  return skillIds.every((skillId) => {
    const codexSkill = path.join(codexRoot, `deepscientist-${skillId}`, 'SKILL.md');
    const claudeSkill = path.join(claudeRoot, `deepscientist-${skillId}.md`);
    return fs.existsSync(codexSkill) && fs.existsSync(claudeSkill);
  });
}

function runSync(binary, args, options = {}) {
  const result = spawnSync(binary, args, {
    cwd: repoRoot,
    stdio: options.capture ? 'pipe' : 'inherit',
    env: {
      ...process.env,
      PYTHONPATH: process.env.PYTHONPATH
        ? `${srcPath}${path.delimiter}${process.env.PYTHONPATH}`
        : srcPath,
    },
    encoding: 'utf8',
  });
  if (result.error) {
    throw result.error;
  }
  if (!options.allowFailure && result.status !== 0) {
    if (options.capture && result.stderr) {
      process.stderr.write(result.stderr);
    }
    process.exit(result.status ?? 1);
  }
  return result;
}

function step(index, total, message) {
  console.log(`[${index}/${total}] ${message}`);
}

function installPythonBundle(venvPython) {
  runSync(venvPython, ['-m', 'pip', 'install', '--upgrade', 'pip', 'setuptools', 'wheel']);
  runSync(venvPython, ['-m', 'pip', 'install', '--upgrade', repoRoot]);
}

function verifyPythonRuntime(venvPython) {
  const result = runSync(
    venvPython,
    ['-c', 'import deepscientist.cli; import cryptography; import _cffi_backend; print("ok")'],
    { capture: true, allowFailure: true }
  );
  return result.status === 0;
}

function recreatePythonRuntime(home, systemPython) {
  fs.rmSync(venvRootPath(home), { recursive: true, force: true });
  step(1, 4, 'Creating local Python runtime');
  runSync(systemPython, ['-m', 'venv', venvRootPath(home)]);
}

function ensurePythonRuntime(home) {
  ensureDir(path.join(home, 'runtime'));
  ensureDir(path.join(home, 'runtime', 'bundle'));
  const systemPython = resolveSystemPython();
  const stampPath = path.join(home, 'runtime', 'bundle', 'python-stamp.json');
  const desiredStamp = {
    version: packageJson.version,
    pyprojectHash: sha256File(path.join(repoRoot, 'pyproject.toml')),
  };

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const venvPython = venvPythonPath(home);
    if (!fs.existsSync(venvPython)) {
      recreatePythonRuntime(home, systemPython);
    }

    let currentStamp = null;
    if (fs.existsSync(stampPath)) {
      try {
        currentStamp = JSON.parse(fs.readFileSync(stampPath, 'utf8'));
      } catch {
        currentStamp = null;
      }
    }

    if (!currentStamp || currentStamp.version !== desiredStamp.version || currentStamp.pyprojectHash !== desiredStamp.pyprojectHash) {
      step(2, 4, 'Installing Python package and dependencies');
      installPythonBundle(venvPython);
      fs.writeFileSync(stampPath, `${JSON.stringify(desiredStamp, null, 2)}\n`, 'utf8');
    }

    if (verifyPythonRuntime(venvPython)) {
      return venvPython;
    }

    console.warn('DeepScientist is repairing the local Python runtime...');
    fs.rmSync(stampPath, { force: true });
    fs.rmSync(venvRootPath(home), { recursive: true, force: true });
  }

  console.error('DeepScientist could not prepare a healthy local Python runtime.');
  process.exit(1);
}

function runPythonCli(venvPython, args, options = {}) {
  return runSync(venvPython, ['-m', 'deepscientist.cli', ...args], options);
}

function normalizePythonCliArgs(args, home) {
  const normalized = [];
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--home') {
      index += 1;
      continue;
    }
    normalized.push(arg);
  }
  return ['--home', home, ...normalized];
}

function ensureInitialized(home, venvPython) {
  const stampPath = path.join(home, 'runtime', 'bundle', 'init-stamp.json');
  let currentStamp = null;
  if (fs.existsSync(stampPath)) {
    try {
      currentStamp = JSON.parse(fs.readFileSync(stampPath, 'utf8'));
    } catch {
      currentStamp = null;
    }
  }
  const desired = {
    version: packageJson.version,
    skills_hash: hashSkillTree(),
  };
  const configPath = path.join(home, 'config', 'config.yaml');
  if (
    currentStamp
    && currentStamp.version === desired.version
    && currentStamp.skills_hash === desired.skills_hash
    && fs.existsSync(configPath)
    && globalSkillsInstalled()
  ) {
    return;
  }
  step(3, 4, 'Preparing DeepScientist home, config, skills, and Git checks');
  const result = runPythonCli(venvPython, ['--home', home, 'init'], { capture: true, allowFailure: true });
  const stdout = result.stdout || '';
  let payload = {};
  try {
    payload = JSON.parse(stdout);
  } catch {
    payload = {};
  }
  if (payload.git && Array.isArray(payload.git.guidance) && payload.git.guidance.length > 0) {
    console.log('Git guidance:');
    for (const line of payload.git.guidance) {
      console.log(`  - ${line}`);
    }
  }
  if (payload.git && payload.git.installed === false) {
    console.error('Git is required before DeepScientist can run correctly.');
    process.exit(result.status || 1 || 1);
  }
  fs.writeFileSync(stampPath, `${JSON.stringify(desired, null, 2)}\n`, 'utf8');
}

function ensureNodeBundle(subdir, entryFile) {
  const fullEntry = path.join(repoRoot, subdir, entryFile);
  if (fs.existsSync(fullEntry)) {
    return fullEntry;
  }
  const subdirRoot = path.join(repoRoot, subdir);
  const manifestPath = path.join(subdirRoot, 'package.json');
  const sourcePath = path.join(subdirRoot, 'src');
  if (!fs.existsSync(manifestPath) || !fs.existsSync(sourcePath)) {
    console.error(
      `Missing prebuilt bundle for ${subdir} in the installed package (${fullEntry}). Reinstall the npm package or use a source checkout.`
    );
    process.exit(1);
  }
  console.log(`Building ${subdir}...`);
  runSync('npm', ['--prefix', path.join(repoRoot, subdir), 'install', '--include=dev', '--no-audit', '--no-fund']);
  runSync('npm', ['--prefix', path.join(repoRoot, subdir), 'run', 'build']);
  return fullEntry;
}

function daemonStatePath(home) {
  return path.join(home, 'runtime', 'daemon.json');
}

function normalizeHomePath(home) {
  try {
    return fs.realpathSync(home);
  } catch {
    return path.resolve(home);
  }
}

function resolveExecutableOnPath(commandName) {
  const pathValue = process.env.PATH || '';
  if (!pathValue) {
    return null;
  }
  const directories = pathValue.split(path.delimiter).filter(Boolean);
  const extensions =
    process.platform === 'win32'
      ? (process.env.PATHEXT || '.EXE;.CMD;.BAT;.COM')
          .split(';')
          .filter(Boolean)
      : [''];
  for (const directory of directories) {
    const base = path.join(directory, commandName);
    for (const extension of extensions) {
      const candidate = process.platform === 'win32' ? `${base}${extension}` : base;
      try {
        if (!fs.existsSync(candidate)) {
          continue;
        }
        const stat = fs.statSync(candidate);
        if (!stat.isFile()) {
          continue;
        }
        if (process.platform !== 'win32') {
          try {
            fs.accessSync(candidate, fs.constants.X_OK);
          } catch {
            continue;
          }
        }
        return candidate;
      } catch {
        continue;
      }
    }
  }
  return null;
}

function findOptionalLatexCompiler() {
  for (const compiler of ['pdflatex', 'xelatex', 'lualatex']) {
    const resolved = resolveExecutableOnPath(compiler);
    if (resolved) {
      return { compiler, path: resolved };
    }
  }
  return null;
}

function optionalRuntimeStatePath(home) {
  return path.join(home, 'runtime', 'bundle', 'optional-runtime.json');
}

function readOptionalRuntimeState(home) {
  const statePath = optionalRuntimeStatePath(home);
  if (!fs.existsSync(statePath)) {
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(statePath, 'utf8'));
  } catch {
    return null;
  }
}

function writeOptionalRuntimeState(home, payload) {
  const statePath = optionalRuntimeStatePath(home);
  ensureDir(path.dirname(statePath));
  fs.writeFileSync(statePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

function latexInstallGuidance() {
  if (resolveExecutableOnPath('apt-get')) {
    return 'sudo apt-get update && sudo apt-get install -y texlive-latex-base texlive-latex-recommended texlive-fonts-recommended texlive-bibtex-extra';
  }
  if (resolveExecutableOnPath('dnf')) {
    return 'sudo dnf install -y texlive-scheme-basic texlive-collection-latex texlive-bibtex';
  }
  if (resolveExecutableOnPath('yum')) {
    return 'sudo yum install -y texlive-scheme-basic texlive-collection-latex texlive-bibtex';
  }
  if (resolveExecutableOnPath('pacman')) {
    return 'sudo pacman -S --needed texlive-basic texlive-latex';
  }
  if (resolveExecutableOnPath('brew')) {
    return 'brew install --cask mactex-no-gui';
  }
  return 'Install a TeX distribution that provides `pdflatex` and `bibtex`.';
}

function maybePrintOptionalLatexNotice(home) {
  const detected = findOptionalLatexCompiler();
  const currentState = {
    version: packageJson.version,
    latex: detected
      ? {
          available: true,
          compiler: detected.compiler,
          path: detected.path,
        }
      : {
          available: false,
          compiler: null,
          path: null,
        },
  };
  const previousState = readOptionalRuntimeState(home);
  const changed = JSON.stringify(previousState || null) !== JSON.stringify(currentState);
  if (!changed) {
    return;
  }
  writeOptionalRuntimeState(home, currentState);
  console.log('');
  if (detected) {
    console.log(`Optional LaTeX runtime: detected ${detected.compiler} at ${detected.path}`);
    console.log('Local paper PDF compilation is available.');
    return;
  }
  console.log('Optional LaTeX runtime: not detected.');
  console.log('DeepScientist still installs and runs normally.');
  console.log('Install LaTeX only if you want local paper PDF compilation from the web workspace.');
  console.log(`Suggested install: ${latexInstallGuidance()}`);
}

function readDaemonState(home) {
  const statePath = daemonStatePath(home);
  if (!fs.existsSync(statePath)) {
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(statePath, 'utf8'));
  } catch {
    return null;
  }
}

function writeDaemonState(home, payload) {
  fs.writeFileSync(daemonStatePath(home), `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

function removeDaemonState(home) {
  const statePath = daemonStatePath(home);
  if (fs.existsSync(statePath)) {
    fs.unlinkSync(statePath);
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function isHealthy(url) {
  const payload = await fetchHealth(url);
  return Boolean(payload && payload.status === 'ok');
}

async function fetchHealth(url) {
  try {
    const response = await fetch(`${url}/api/health`);
    if (!response.ok) {
      return null;
    }
    return await response.json();
  } catch {
    return null;
  }
}

function healthMatchesManagedState({ health, state, home }) {
  if (!health || health.status !== 'ok') {
    return false;
  }
  const expectedHome = normalizeHomePath(home);
  const actualHome = typeof health.home === 'string' && health.home ? normalizeHomePath(health.home) : null;
  if (!actualHome || actualHome !== expectedHome) {
    return false;
  }
  const expectedDaemonId = typeof state?.daemon_id === 'string' ? state.daemon_id.trim() : '';
  const actualDaemonId = typeof health.daemon_id === 'string' ? health.daemon_id.trim() : '';
  if (!expectedDaemonId || !actualDaemonId) {
    return false;
  }
  return expectedDaemonId === actualDaemonId;
}

function healthMatchesHome({ health, home }) {
  if (!health || health.status !== 'ok') {
    return false;
  }
  const expectedHome = normalizeHomePath(home);
  const actualHome = typeof health.home === 'string' && health.home ? normalizeHomePath(health.home) : null;
  return Boolean(actualHome && actualHome === expectedHome);
}

function daemonIdentityError({ url, home, health, state }) {
  const expectedHome = normalizeHomePath(home);
  const actualHome = typeof health?.home === 'string' ? health.home : 'unknown';
  const actualDaemonId = typeof health?.daemon_id === 'string' ? health.daemon_id : 'unknown';
  const expectedDaemonId = typeof state?.daemon_id === 'string' ? state.daemon_id : 'missing';
  return [
    `Refusing to operate on daemon at ${url} because its identity does not match this launcher state.`,
    `Expected home: ${expectedHome}`,
    `Reported home: ${actualHome}`,
    `Expected daemon_id: ${expectedDaemonId}`,
    `Reported daemon_id: ${actualDaemonId}`,
  ].join('\n');
}

async function requestDaemonShutdown(url, daemonId) {
  try {
    const response = await fetch(`${url}/api/admin/shutdown`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ source: 'ds-launcher', daemon_id: daemonId || null }),
    });
    if (!response.ok) {
      return false;
    }
    const payload = await response.json().catch(() => ({}));
    return payload.ok !== false;
  } catch {
    return false;
  }
}

function isPidAlive(pid) {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function killManagedProcess(pid, signal) {
  if (!pid) return false;
  if (process.platform === 'win32') {
    const taskkillArgs = ['/PID', String(pid)];
    if (signal === 'SIGKILL') {
      taskkillArgs.push('/T', '/F');
    }
    const result = spawnSync('taskkill', taskkillArgs, { stdio: 'ignore' });
    return result.status === 0;
  }
  try {
    process.kill(-pid, signal);
    return true;
  } catch {
    try {
      process.kill(pid, signal);
      return true;
    } catch {
      return false;
    }
  }
}

async function waitForDaemonStop({ url, pid, attempts = 20, delayMs = 200 }) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const healthy = url ? await isHealthy(url) : false;
    const alive = pid ? isPidAlive(pid) : false;
    if (!healthy && !alive) {
      return true;
    }
    if (!healthy && !pid) {
      return true;
    }
    await sleep(delayMs);
  }
  return false;
}

function tailLog(logPath) {
  if (!fs.existsSync(logPath)) {
    return '';
  }
  const content = fs.readFileSync(logPath, 'utf8').trim();
  return content.split(/\r?\n/).slice(-20).join('\n');
}

async function stopDaemon(home) {
  const state = readDaemonState(home);
  const configured = readConfiguredUiAddressFromFile(home);
  const url = state?.url || browserUiUrl(state?.host || configured.host, state?.port || configured.port);
  const healthBefore = await fetchHealth(url);
  const healthyBefore = Boolean(healthBefore && healthBefore.status === 'ok');
  const sameHomeHealthy = healthMatchesHome({ health: healthBefore, home });
  const pid = state?.pid || (sameHomeHealthy ? healthBefore?.pid : null);
  const shutdownDaemonId = sameHomeHealthy ? healthBefore?.daemon_id : state?.daemon_id;

  if (!state && !healthyBefore) {
    console.log('No managed DeepScientist daemon is running.');
    removeDaemonState(home);
    return;
  }

  if (!state && healthyBefore) {
    if (!sameHomeHealthy) {
      console.error(
        [
          `A DeepScientist daemon is reachable at ${url}, but there is no managed daemon state for ${normalizeHomePath(home)}.`,
          'Refusing to stop an unverified daemon.',
        ].join('\n')
      );
      process.exit(1);
    }
  }

  if (healthyBefore && !healthMatchesManagedState({ health: healthBefore, state, home })) {
    if (!sameHomeHealthy) {
      console.error(daemonIdentityError({ url, home, health: healthBefore, state }));
      process.exit(1);
    }
  }

  let stopped = false;

  if (healthyBefore) {
    await requestDaemonShutdown(url, shutdownDaemonId || null);
    stopped = await waitForDaemonStop({ url, pid, attempts: 20, delayMs: 200 });
  }

  if (!stopped && pid && isPidAlive(pid)) {
    killManagedProcess(pid, 'SIGTERM');
    stopped = await waitForDaemonStop({ url, pid, attempts: 30, delayMs: 200 });
  }

  if (!stopped && pid && isPidAlive(pid)) {
    killManagedProcess(pid, 'SIGKILL');
    stopped = await waitForDaemonStop({ url, pid, attempts: 20, delayMs: 150 });
  }

  const stillHealthy = await isHealthy(url);
  if (!stopped && (stillHealthy || (pid && isPidAlive(pid)))) {
    console.error('DeepScientist daemon is still running after shutdown attempts.');
    process.exit(1);
  }

  removeDaemonState(home);
  console.log('DeepScientist daemon stopped.');
}

async function readConfiguredUiAddress(home, venvPython, fallbackHost, fallbackPort) {
  try {
    const result = runPythonCli(venvPython, ['--home', home, 'config', 'show', 'config'], { capture: true, allowFailure: true });
    const text = result.stdout || '';
    const hostMatch = text.match(/^\s*host:\s*["']?([^"'\n]+)["']?\s*$/m);
    const portMatch = text.match(/^\s*port:\s*(\d+)\s*$/m);
    const modeMatch = text.match(/^\s*default_mode:\s*["']?([^"'\n]+)["']?\s*$/m);
    const autoOpenMatch = text.match(/^\s*auto_open_browser:\s*([^\n]+)\s*$/m);
    return {
      host: fallbackHost || (hostMatch ? hostMatch[1].trim() : '0.0.0.0'),
      port: fallbackPort || (portMatch ? Number(portMatch[1]) : 20999),
      defaultMode: normalizeMode(modeMatch ? modeMatch[1].trim() : 'web'),
      autoOpenBrowser: parseBooleanSetting(autoOpenMatch ? autoOpenMatch[1].trim() : true, true),
    };
  } catch {
    return {
      host: fallbackHost || '0.0.0.0',
      port: fallbackPort || 20999,
      defaultMode: 'web',
      autoOpenBrowser: true,
    };
  }
}

function readConfiguredUiAddressFromFile(home, fallbackHost, fallbackPort) {
  const configPath = path.join(home, 'config', 'config.yaml');
  if (!fs.existsSync(configPath)) {
    return {
      host: fallbackHost || '0.0.0.0',
      port: fallbackPort || 20999,
      defaultMode: 'web',
      autoOpenBrowser: true,
    };
  }
  try {
    const text = fs.readFileSync(configPath, 'utf8');
    const hostMatch = text.match(/^\s*host:\s*["']?([^"'\n]+)["']?\s*$/m);
    const portMatch = text.match(/^\s*port:\s*(\d+)\s*$/m);
    const modeMatch = text.match(/^\s*default_mode:\s*["']?([^"'\n]+)["']?\s*$/m);
    const autoOpenMatch = text.match(/^\s*auto_open_browser:\s*([^\n]+)\s*$/m);
    return {
      host: fallbackHost || (hostMatch ? hostMatch[1].trim() : '0.0.0.0'),
      port: fallbackPort || (portMatch ? Number(portMatch[1]) : 20999),
      defaultMode: normalizeMode(modeMatch ? modeMatch[1].trim() : 'web'),
      autoOpenBrowser: parseBooleanSetting(autoOpenMatch ? autoOpenMatch[1].trim() : true, true),
    };
  } catch {
    return {
      host: fallbackHost || '0.0.0.0',
      port: fallbackPort || 20999,
      defaultMode: 'web',
      autoOpenBrowser: true,
    };
  }
}

async function startDaemon(home, venvPython, host, port) {
  const browserUrl = browserUiUrl(host, port);
  const daemonBindUrl = bindUiUrl(host, port);
  const state = readDaemonState(home);
  const existingHealth = await fetchHealth(browserUrl);
  if (existingHealth && existingHealth.status === 'ok') {
    if (state && healthMatchesManagedState({ health: existingHealth, state, home })) {
      return { url: browserUrl, bindUrl: daemonBindUrl, reused: true };
    }
    console.error(
      state
        ? daemonIdentityError({ url: browserUrl, home, health: existingHealth, state })
        : [
            `A DeepScientist daemon is already listening at ${browserUrl}, but it is not associated with the managed state for ${normalizeHomePath(home)}.`,
            'Use a different port or stop the foreign daemon first.',
          ].join('\n')
    );
    process.exit(1);
  }

  if (state && state.pid && !isPidAlive(state.pid)) {
    removeDaemonState(home);
  }

  const bootstrapState = readCodexBootstrapState(home, venvPython);
  if (!bootstrapState.codex_ready) {
    console.log('Codex is not marked ready yet. Running startup probe...');
    const probe = probeCodexBootstrap(home, venvPython);
    if (!probe || probe.ok !== true) {
      throw createCodexPreflightError(home, probe);
    }
  }

  ensureNodeBundle('src/ui', 'dist/index.html');

  const logPath = path.join(home, 'logs', 'daemon.log');
  ensureDir(path.dirname(logPath));
  const out = fs.openSync(logPath, 'a');
  const daemonId = crypto.randomUUID();
  const child = spawn(
    venvPython,
    ['-m', 'deepscientist.cli', '--home', home, 'daemon', '--host', host, '--port', String(port)],
    {
      cwd: repoRoot,
      detached: true,
      stdio: ['ignore', out, out],
      env: {
        ...process.env,
        DS_DAEMON_ID: daemonId,
        DS_DAEMON_MANAGED_BY: 'ds-launcher',
        PYTHONPATH: process.env.PYTHONPATH
          ? `${srcPath}${path.delimiter}${process.env.PYTHONPATH}`
          : srcPath,
      },
    }
  );
  child.unref();
  const statePayload = {
    pid: child.pid,
    host,
    port,
    url: browserUrl,
    bind_url: daemonBindUrl,
    log_path: logPath,
    started_at: new Date().toISOString(),
    home: normalizeHomePath(home),
    daemon_id: daemonId,
  };
  writeDaemonState(home, statePayload);

  for (let attempt = 0; attempt < 60; attempt += 1) {
    const health = await fetchHealth(browserUrl);
    if (health && health.status === 'ok') {
      if (!healthMatchesManagedState({ health, state: readDaemonState(home), home })) {
        console.error(daemonIdentityError({ url: browserUrl, home, health, state: readDaemonState(home) }));
        process.exit(1);
      }
      return { url: browserUrl, bindUrl: daemonBindUrl, reused: false };
    }
    await sleep(250);
  }

  console.error('DeepScientist daemon failed to become healthy.');
  const logTail = tailLog(logPath);
  if (logTail) {
    console.error(logTail);
  }
  process.exit(1);
}

function openBrowser(url) {
  const spawnDetached = (command, args) => {
    try {
      const child = spawn(command, args, { detached: true, stdio: 'ignore' });
      child.unref();
      return true;
    } catch {
      return false;
    }
  };

  if (process.platform === 'darwin') {
    const opener = resolveExecutableOnPath('open');
    return opener ? spawnDetached(opener, [url]) : false;
  }
  if (process.platform === 'win32') {
    return spawnDetached('cmd', ['/c', 'start', '', url]);
  }

  const commands = [
    { command: 'xdg-open', args: [url] },
    { command: 'gio', args: ['open', url] },
    { command: 'sensible-browser', args: [url] },
    { command: 'gnome-open', args: [url] },
    { command: 'kde-open', args: [url] },
    { command: 'kde-open5', args: [url] },
  ];
  for (const candidate of commands) {
    const resolved = resolveExecutableOnPath(candidate.command);
    if (!resolved) {
      continue;
    }
    if (spawnDetached(resolved, candidate.args)) {
      return true;
    }
  }
  return false;
}

function handleCodexPreflightFailure(error) {
  if (!error || error.code !== 'DS_CODEX_PREFLIGHT') {
    return false;
  }
  console.error('');
  console.error('DeepScientist could not start because Codex is not ready yet.');
  console.error(`Report: ${error.reportPath}`);
  if (Array.isArray(error.probe?.errors)) {
    for (const item of error.probe.errors) {
      console.error(`  - ${item}`);
    }
  }
  openBrowser(error.reportUrl);
  process.exit(1);
  return true;
}

function launchTui(url, questId, home, venvPython) {
  const entry = ensureNodeBundle('src/tui', 'dist/index.js');
  const args = [entry, '--base-url', url];
  if (questId) {
    args.push('--quest-id', questId);
  }
  const child = spawn(process.execPath, args, {
    cwd: repoRoot,
    stdio: 'inherit',
    env: {
      ...process.env,
      DEEPSCIENTIST_TUI_HOME: home,
      DEEPSCIENTIST_TUI_PYTHON: venvPython,
      DEEPSCIENTIST_VENV_PYTHON: venvPython,
    },
  });
  child.on('exit', (code) => {
    process.exit(code ?? 0);
  });
}

async function launcherMain(rawArgs) {
  const options = parseLauncherArgs(rawArgs);
  if (!options) {
    return false;
  }
  if (options.help) {
    printLauncherHelp();
    process.exit(0);
  }

  const home = options.home || resolveHome(rawArgs);
  ensureDir(home);

  if (options.stop) {
    await stopDaemon(home);
    process.exit(0);
  }

  if (options.status) {
    const state = readDaemonState(home);
    const configured = readConfiguredUiAddressFromFile(home, options.host, options.port);
    const url = state?.url || browserUiUrl(configured.host, configured.port);
    const health = await fetchHealth(url);
    const healthy = Boolean(health && health.status === 'ok');
    const identityMatch = state ? healthMatchesManagedState({ health, state, home }) : false;
    console.log(
      JSON.stringify(
        {
          healthy,
          identity_match: identityMatch,
          managed: Boolean(state),
          home,
          url,
          daemon: state,
          health,
        },
        null,
        2
      )
    );
    process.exit(healthy && (!state || identityMatch) ? 0 : 1);
  }

  const venvPython = ensurePythonRuntime(home);
  ensureInitialized(home, venvPython);
  maybePrintOptionalLatexNotice(home);

  const configuredUi = await readConfiguredUiAddress(home, venvPython, options.host, options.port);
  const host = configuredUi.host;
  const port = configuredUi.port;
  const mode = normalizeMode(options.mode ?? 'web');
  const shouldOpenBrowser = options.daemonOnly
    ? false
    : options.openBrowser === null
      ? configuredUi.autoOpenBrowser !== false && mode !== 'tui'
      : options.openBrowser;
  if (options.restart) {
    await stopDaemon(home);
  }

  step(4, 4, 'Starting local daemon and UI surfaces');
  let started;
  try {
    started = await startDaemon(home, venvPython, host, port);
  } catch (error) {
    if (handleCodexPreflightFailure(error)) return true;
    throw error;
  }
  const browserOpened = shouldOpenBrowser ? openBrowser(started.url) : false;
  printLaunchCard({
    url: started.url,
    bindUrl: started.bindUrl,
    mode,
    autoOpenRequested: shouldOpenBrowser,
    browserOpened,
    daemonOnly: options.daemonOnly,
  });

  if (options.daemonOnly) {
    process.exit(0);
  }
  if (mode === 'web') {
    process.exit(0);
  }
  launchTui(started.url, options.questId, home, venvPython);
  return true;
}

async function main() {
  const args = process.argv.slice(2);
  const positional = findFirstPositionalArg(args);
  if (args.length === 0 || args[0] === 'ui' || (!positional && args[0]?.startsWith('--'))) {
    await launcherMain(args);
    return;
  }
  if (args[0] === '--help' || args[0] === '-h') {
    printLauncherHelp();
    return;
  }
  if (positional && pythonCommands.has(positional.value)) {
    const home = resolveHome(args);
    const venvPython = ensurePythonRuntime(home);
    if (positional.value === 'run' || positional.value === 'daemon') {
      maybePrintOptionalLatexNotice(home);
    }
    if (positional.value === 'run' || positional.value === 'daemon') {
      const bootstrapState = readCodexBootstrapState(home, venvPython);
      if (!bootstrapState.codex_ready) {
        try {
          const probe = probeCodexBootstrap(home, venvPython);
          if (!probe || probe.ok !== true) {
            throw createCodexPreflightError(home, probe);
          }
        } catch (error) {
          if (handleCodexPreflightFailure(error)) return;
          throw error;
        }
      }
    }
    const result = runPythonCli(venvPython, normalizePythonCliArgs(args, home), { allowFailure: true });
    process.exit(result.status ?? 0);
    return;
  }
  await launcherMain(args);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
