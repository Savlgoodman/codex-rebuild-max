#!/usr/bin/env node
/**
 * Smart development startup script
 * Automatically detects system architecture and sets correct CLI path
 */

const { spawn } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');

const projectRoot = path.resolve(__dirname, '..');

// Detect platform and architecture
const platform = process.platform;
const arch = os.arch();

// Map to CLI binary paths
const platformMap = {
  darwin: {
    x64: 'darwin-x64',
    arm64: 'darwin-arm64',
  },
  linux: {
    x64: 'linux-x64',
    arm64: 'linux-arm64',
  },
  win32: {
    x64: 'win32-x64',
  },
};

const binDir = platformMap[platform]?.[arch];
if (!binDir) {
  console.error(`Unsupported platform/arch: ${platform}/${arch}`);
  process.exit(1);
}

const cliName = platform === 'win32' ? 'codex.exe' : 'codex';

// Priority: upstream CLI from src/ > @cometix/codex vendor > resources/bin/
const srcPlatform = platform === 'darwin'
  ? (arch === 'arm64' ? 'mac-arm64' : 'mac-x64')
  : platform === 'win32' ? 'win' : `${platform}-${arch}`;

const candidates = [
  // 1. Upstream CLI (from sync-upstream, matches app version)
  path.join(projectRoot, 'src', srcPlatform, cliName),
  // 2. @cometix/codex platform package (0.128+ uses separate packages)
  (() => {
    const pkgMap = {
      'darwin-arm64': 'codex-darwin-arm64',
      'darwin-x64': 'codex-darwin-x64',
      'linux-arm64': 'codex-linux-arm64',
      'linux-x64': 'codex-linux-x64',
      'win32-x64': 'codex-win32-x64',
    };
    const tripleMap = {
      'darwin-arm64': 'aarch64-apple-darwin',
      'darwin-x64': 'x86_64-apple-darwin',
      'linux-arm64': 'aarch64-unknown-linux-musl',
      'linux-x64': 'x86_64-unknown-linux-musl',
      'win32-x64': 'x86_64-pc-windows-msvc',
    };
    const pkg = pkgMap[binDir], triple = tripleMap[binDir];
    if (!pkg || !triple) return null;
    // New structure: @cometix/codex-{platform}/vendor/{triple}/codex/codex
    const newPath = path.join(projectRoot, 'node_modules', '@cometix', pkg, 'vendor', triple, 'codex', cliName);
    if (fs.existsSync(newPath)) return newPath;
    // Old structure: @cometix/codex/vendor/{triple}/codex/codex
    const oldPath = path.join(projectRoot, 'node_modules', '@cometix', 'codex', 'vendor', triple, 'codex', cliName);
    return fs.existsSync(oldPath) ? oldPath : null;
  })(),
  // 3. Local resources/bin/
  path.join(projectRoot, 'resources', 'bin', binDir, cliName),
].filter(Boolean);

const cliPath = candidates.find(p => fs.existsSync(p));

// Verify CLI exists
if (!fs.existsSync(cliPath)) {
  console.error(`CLI not found at: ${cliPath}`);
  console.error('Tried: resources/bin/ and node_modules/@cometix/codex/vendor/');
  process.exit(1);
}

// Resolve app entry: prefer platform-specific _asar/ (has its own package.json)
const sourceRoot = path.join(projectRoot, 'src', srcPlatform);
const appRoot = path.join(sourceRoot, '_asar');
const appEntry = fs.existsSync(appRoot) ? appRoot : projectRoot;

console.log(`[start-dev] Platform: ${platform}, Arch: ${arch}`);
console.log(`[start-dev] CLI Path: ${cliPath}`);
console.log(`[start-dev] App Root: ${appEntry}`);

function makeChildEnv(overrides = {}) {
  const childEnv = {
    ...process.env,
    CODEX_CLI_PATH: cliPath,
    BUILD_FLAVOR: process.env.BUILD_FLAVOR || 'dev',
    ELECTRON_RENDERER_URL: process.env.ELECTRON_RENDERER_URL || 'app://-/index.html',
    CODEX_ELECTRON_RESOURCES_PATH: sourceRoot,
    CODEX_ELECTRON_BUNDLED_PLUGINS_RESOURCES_PATH: sourceRoot,
    CODEX_NODE_REPL_PATH: path.join(sourceRoot, 'node_repl'),
    CODEX_BROWSER_USE_NODE_PATH: path.join(sourceRoot, 'node'),
    ...overrides,
  };
  delete childEnv.ELECTRON_RUN_AS_NODE;
  return childEnv;
}

function run(command, args, options = {}) {
  const result = spawn(command, args, {
    cwd: projectRoot,
    stdio: 'inherit',
    shell: false,
    ...options,
  });
  return result;
}

function runSync(command, args, options = {}) {
  const { spawnSync } = require('child_process');
  const result = spawnSync(command, args, {
    cwd: projectRoot,
    stdio: 'inherit',
    shell: false,
    ...options,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} exited with code ${result.status}`);
  }
}

function copyDir(src, dest) {
  fs.rmSync(dest, { recursive: true, force: true });
  fs.cpSync(src, dest, { recursive: true, force: true });
}

function readTextIfExists(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return null;
  }
}

function ensureWindowsOwlRuntime() {
  const configuredAppDir = process.env.CODEX_OWL_APP_DIR?.trim();
  const runtimeAppDir = configuredAppDir
    ? path.resolve(configuredAppDir)
    : path.join(projectRoot, '.codex-runtime', 'win', 'app');
  const runtimeExe = path.join(runtimeAppDir, 'Codex.exe');
  const tempAppDir = path.join(os.tmpdir(), 'codex-sync', 'win-extract', 'app');
  const tempExe = path.join(tempAppDir, 'Codex.exe');

  if (!configuredAppDir) {
    const runtimeMarker = readTextIfExists(path.join(runtimeAppDir, '.installed-owl-shell.json'));
    const tempMarker = readTextIfExists(path.join(tempAppDir, '.installed-owl-shell.json'));
    if (!fs.existsSync(runtimeExe) || (tempMarker && runtimeMarker !== tempMarker)) {
      if (!fs.existsSync(tempExe)) {
        throw new Error(
          `Windows Owl runtime not found. Run "npm run sync -- --skip-mac" first, or set CODEX_OWL_APP_DIR.`
        );
      }
      console.log(`[start-dev] Copy Owl runtime -> ${path.relative(projectRoot, runtimeAppDir)}`);
      copyDir(tempAppDir, runtimeAppDir);
    }
  }

  if (!fs.existsSync(runtimeExe)) {
    throw new Error(`Windows Owl runtime not found at: ${runtimeExe}`);
  }
  return runtimeAppDir;
}

function startWindowsOwlDev() {
  if (!fs.existsSync(appRoot)) {
    throw new Error(`Windows app source not found at: ${appRoot}. Run "npm run sync -- --skip-mac" first.`);
  }

  const runtimeAppDir = ensureWindowsOwlRuntime();
  const runtimeResourcesDir = path.join(runtimeAppDir, 'resources');
  const packedAsarPath = path.join(sourceRoot, 'app.asar');
  const unpackedSource = path.join(sourceRoot, 'app.asar.unpacked');
  const runtimeCliPath = path.join(runtimeResourcesDir, cliName);
  const userDataPath = path.resolve(
    process.env.CODEX_ELECTRON_USER_DATA_PATH?.trim() || path.join(projectRoot, '.codex-dev-user-data')
  );
  fs.mkdirSync(userDataPath, { recursive: true });

  console.log(`[start-dev] Owl Runtime: ${runtimeAppDir}`);
  console.log(`[start-dev] Dev User Data: ${userDataPath}`);
  console.log('[start-dev] Packing app.asar from src/win/_asar');
  runSync(process.execPath, [
    path.join(projectRoot, 'node_modules', '@electron', 'asar', 'bin', 'asar.mjs'),
    'pack',
    appRoot,
    packedAsarPath,
  ]);

  fs.mkdirSync(runtimeResourcesDir, { recursive: true });
  fs.copyFileSync(packedAsarPath, path.join(runtimeResourcesDir, 'app.asar'));
  if (fs.existsSync(unpackedSource)) {
    console.log('[start-dev] Syncing app.asar.unpacked');
    copyDir(unpackedSource, path.join(runtimeResourcesDir, 'app.asar.unpacked'));
  }

  const childEnv = makeChildEnv({
    CODEX_CLI_PATH: fs.existsSync(runtimeCliPath) ? runtimeCliPath : cliPath,
    CODEX_ELECTRON_USER_DATA_PATH: userDataPath,
    CODEX_ELECTRON_RESOURCES_PATH: runtimeResourcesDir,
    CODEX_ELECTRON_BUNDLED_PLUGINS_RESOURCES_PATH: runtimeResourcesDir,
    CODEX_NODE_REPL_PATH: path.join(runtimeResourcesDir, 'node_repl'),
    CODEX_BROWSER_USE_NODE_PATH: path.join(runtimeResourcesDir, 'node'),
  });

  const child = run(path.join(runtimeAppDir, 'Codex.exe'), [`--user-data-dir=${userDataPath}`], {
    cwd: runtimeAppDir,
    env: childEnv,
  });

  child.on('close', (code) => {
    process.exit(code);
  });
}

if (platform === 'win32' && fs.existsSync(appRoot) && process.env.CODEX_USE_NPM_ELECTRON !== '1') {
  try {
    startWindowsOwlDev();
  } catch (error) {
    console.error(`[start-dev] ${error.message}`);
    process.exit(1);
  }
  return;
}

const childEnv = makeChildEnv();

// Launch Electron with CLI path
const electronBin = require('electron');
const child = run(electronBin, [appEntry], {
  cwd: projectRoot,
  env: childEnv,
});

child.on('close', (code) => {
  process.exit(code);
});
