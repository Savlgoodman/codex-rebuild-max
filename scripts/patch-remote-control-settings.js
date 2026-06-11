#!/usr/bin/env node
/**
 * Post-sync patch: inject a placeholder Remote Control settings section.
 *
 * This repo edits upstream Codex Desktop bundles after app.asar extraction.
 * The patch registers a new settings slug, wires it into the navigation and
 * lazy settings component map, then writes a small static renderer chunk.
 *
 * Usage:
 *   node scripts/patch-remote-control-settings.js [platform]
 *   node scripts/patch-remote-control-settings.js win --check
 */
const fs = require("fs");
const path = require("path");
const { SRC_DIR, relPath } = require("./patch-util");

const SLUG = "remote-control-settings";
const ASSET_NAME = "remote-control-settings-dev.js";
const ALL_PLATFORMS = ["mac-arm64", "mac-x64", "win"];

const REMOTE_CONTROL_SETTINGS_ASSET = String.raw`import{t as e}from"./jsx-runtime-DXKlqYIQ.js";import{t as t}from"./settings-content-layout-CHGXJJZh.js";import{n as r,t as n}from"./settings-group-Bceq5TiI.js";import{n as s}from"./settings-row-CFfJvtWn.js";import{t as a}from"./button-C2sUepLV.js";import{t as o}from"./toggle-Dd0Slknv.js";var i=e(),c=[{name:"iPhone 15 Pro",kind:"\u79FB\u52A8\u7AEF",status:"\u5DF2\u6388\u6743",lastSeen:"\u521A\u521A\u5728\u7EBF"},{name:"remote-web-ui",kind:"\u6D4F\u89C8\u5668\u63A7\u5236\u53F0",status:"\u5F85\u786E\u8BA4",lastSeen:"2 \u5206\u949F\u524D"}];function l(e){let{placeholder:t,value:r,type:n}=e;return(0,i.jsx)("input",{type:n??"text",value:r,readOnly:!0,placeholder:t,className:"h-9 w-full rounded-lg border border-token-border bg-token-bg-primary px-3 text-sm text-token-text-primary outline-none placeholder:text-token-text-tertiary"})}function d(e){let{children:t,tone:r}=e,n=r==="warning"?"bg-token-editor-warning-bg text-token-editor-warning-foreground":"bg-token-bg-secondary text-token-text-secondary";return(0,i.jsx)("span",{className:"inline-flex h-6 shrink-0 items-center rounded-md px-2 text-xs font-medium "+n,children:t})}function p(){return(0,i.jsx)("div",{className:"flex flex-col gap-2",children:c.map(e=>(0,i.jsxs)("div",{className:"flex min-h-14 items-center justify-between gap-3 rounded-lg border border-token-border bg-token-bg-primary px-3 py-2",children:[(0,i.jsxs)("div",{className:"min-w-0",children:[(0,i.jsx)("div",{className:"truncate text-sm font-medium text-token-text-primary",children:e.name}),(0,i.jsxs)("div",{className:"mt-0.5 flex min-w-0 flex-wrap items-center gap-2 text-xs text-token-text-secondary",children:[(0,i.jsx)("span",{children:e.kind}),(0,i.jsx)("span",{children:e.lastSeen})]})]}),(0,i.jsxs)("div",{className:"flex shrink-0 items-center gap-2",children:[(0,i.jsx)(d,{tone:e.status==="\u5F85\u786E\u8BA4"?"warning":"default",children:e.status}),(0,i.jsx)(a,{color:"secondary",size:"toolbar",disabled:!0,children:e.status==="\u5F85\u786E\u8BA4"?"\u4FE1\u4EFB":"\u79FB\u9664"})]})]},e.name))})}function m(){return(0,i.jsx)(t,{title:"\u8FDC\u63A7\u8BBE\u7F6E",subtitle:"\u914D\u7F6E\u8FDC\u63A7\u670D\u52A1\u5668\u3001\u914D\u5BF9\u7801\u548C\u5DF2\u6388\u6743\u8BBE\u5907\u3002",children:(0,i.jsxs)("div",{className:"flex flex-col gap-5",children:[(0,i.jsxs)(n,{children:[(0,i.jsx)(n.Header,{title:"\u670D\u52A1\u5668",subtitle:"\u7528\u4E8E\u66FF\u6362\u5B98\u65B9 remote control \u94FE\u8DEF\u7684\u81EA\u5EFA\u4E2D\u8F6C\u670D\u52A1\u3002"}),(0,i.jsxs)(r,{children:[(0,i.jsx)(s,{label:"\u542F\u7528\u81EA\u5EFA\u8FDC\u63A7\u670D\u52A1\u5668",description:"\u5F53\u524D\u4EC5\u5C55\u793A\u914D\u7F6E\u754C\u9762\uFF0C\u5F00\u5173\u4E0D\u4F1A\u5199\u5165\u8BBE\u7F6E\u3002",control:(0,i.jsx)(o,{checked:!1,disabled:!0,ariaLabel:"\u542F\u7528\u81EA\u5EFA\u8FDC\u63A7\u670D\u52A1\u5668"})}),(0,i.jsx)(s,{label:"\u670D\u52A1\u5668\u5730\u5740",description:"\u540E\u7EED\u53EF\u63A5\u5165 wss/http \u4E2D\u8F6C\u670D\u52A1\u5668\u3002",control:(0,i.jsx)(l,{value:"wss://relay.example.com/remote-control"})}),(0,i.jsx)(s,{label:"\u73AF\u5883\u540D\u79F0",description:"\u7528\u4E8E remote-web-ui \u533A\u5206\u4E0D\u540C Codex App \u5B9E\u4F8B\u3002",control:(0,i.jsx)(l,{value:"my-codex-desktop"})})]})]}),(0,i.jsxs)(n,{children:[(0,i.jsx)(n.Header,{title:"\u914D\u5BF9",subtitle:"\u7528\u4E8E remote-web-ui \u4E0E\u672C\u673A Codex App \u5EFA\u7ACB\u6388\u6743\u5173\u7CFB\u3002"}),(0,i.jsxs)(r,{children:[(0,i.jsx)(s,{label:"Pair code",description:"\u9759\u6001\u5360\u4F4D\uFF0C\u540E\u7EED\u53EF\u7531\u672C\u5730\u63A7\u5236\u670D\u52A1\u751F\u6210\u3002",control:(0,i.jsx)(l,{value:"OWL-2026",placeholder:"XXXX-XXXX"})}),(0,i.jsx)(s,{label:"\u914D\u5BF9\u72B6\u6001",description:"\u5F53\u524D\u6CA1\u6709\u5B9E\u9645\u914D\u5BF9\u6D41\u7A0B\u3002",control:(0,i.jsxs)("div",{className:"flex items-center gap-2",children:[(0,i.jsx)(d,{children:"\u672A\u914D\u5BF9"}),(0,i.jsx)(a,{color:"secondary",size:"toolbar",disabled:!0,children:"\u751F\u6210\u914D\u5BF9\u7801"}),(0,i.jsx)(a,{color:"secondary",size:"toolbar",disabled:!0,children:"\u4FDD\u5B58"})]})})]})]}),(0,i.jsxs)(n,{children:[(0,i.jsx)(n.Header,{title:"\u8BBE\u5907\u7BA1\u7406",subtitle:"\u7BA1\u7406\u5DF2\u7ECF\u8FDE\u63A5\u6216\u7B49\u5F85\u786E\u8BA4\u7684\u8FDC\u63A7\u8BBE\u5907\u3002"}),(0,i.jsx)(r,{children:(0,i.jsx)(s,{label:"\u8FDC\u63A7\u8BBE\u5907",description:"\u8FD9\u91CC\u5148\u5C55\u793A\u672A\u6765\u7BA1\u7406\u5F62\u6001\u3002",control:(0,i.jsx)(p,{})})})]})]})})}export{m as RemoteControlSettings};
`;

function selectedPlatforms(args) {
  const platform = args.find((arg) => [...ALL_PLATFORMS, "unix"].includes(arg));
  if (platform === "unix") return ["mac-arm64", "mac-x64"].filter(hasAssetsDir);
  if (platform) return [platform];
  return ALL_PLATFORMS.filter(hasAssetsDir);
}

function hasAssetsDir(platform) {
  return fs.existsSync(assetsDir(platform));
}

function assetsDir(platform) {
  return path.join(SRC_DIR, platform, "_asar", "webview", "assets");
}

function findOne(dir, pattern) {
  if (!fs.existsSync(dir)) return null;
  const matches = fs.readdirSync(dir).filter((name) => pattern.test(name));
  if (matches.length === 0) return null;
  return path.join(dir, matches[0]);
}

function replaceRequired(code, from, to, fileLabel) {
  if (!code.includes(from)) {
    throw new Error(`${fileLabel}: expected pattern not found: ${from.slice(0, 120)}`);
  }
  return code.replace(from, to);
}

function patchTextFile(file, fileLabel, patcher, isCheck) {
  const before = fs.readFileSync(file, "utf8");
  const after = patcher(before);
  if (after === before) {
    console.log(`   [ok] ${fileLabel} already patched`);
    return 0;
  }
  if (isCheck) {
    console.log(`   [?] ${fileLabel} would be patched`);
    return 1;
  }
  fs.writeFileSync(file, after, "utf8");
  console.log(`   [ok] ${fileLabel} patched`);
  return 1;
}

function patchSettingsSections(file, isCheck) {
  return patchTextFile(file, relPath(file), (code) => {
    if (!code.includes(SLUG)) {
      code = replaceRequired(
        code,
        "`mcp-settings`,`hooks-settings`,`connections`,`plugins-settings`",
        "`mcp-settings`,`hooks-settings`,`connections`,`remote-control-settings`,`plugins-settings`",
        relPath(file)
      );
      code = replaceRequired(
        code,
        "{slug:`connections`},{slug:`local-environments`}",
        "{slug:`connections`},{slug:`remote-control-settings`},{slug:`local-environments`}",
        relPath(file)
      );
    } else if (!code.includes("{slug:`remote-control-settings`}")) {
      code = replaceRequired(
        code,
        "{slug:`connections`},{slug:`local-environments`}",
        "{slug:`connections`},{slug:`remote-control-settings`},{slug:`local-environments`}",
        relPath(file)
      );
    }
    return code;
  }, isCheck);
}

function patchSettingsShared(file, isCheck) {
  return patchTextFile(file, relPath(file), (code) => {
    if (!code.includes('"remote-control-settings":{id:`settings.nav.remote-control-settings`')) {
      code = replaceRequired(
        code,
        'connections:{id:`settings.nav.connections`,defaultMessage:`Connections`,description:`Title for connections settings section`},"plugins-settings"',
        'connections:{id:`settings.nav.connections`,defaultMessage:`Connections`,description:`Title for connections settings section`},"remote-control-settings":{id:`settings.nav.remote-control-settings`,defaultMessage:`\\u8FDC\\u63A7\\u8BBE\\u7F6E`,description:`Title for remote control settings section`},"plugins-settings"',
        relPath(file)
      );
    }
    if (!code.includes("case`remote-control-settings`")) {
      code = replaceRequired(
        code,
        "function m(e){let t=(0,u.c)(21)",
        "function m(e){let t=(0,u.c)(22)",
        relPath(file)
      );
      code = replaceRequired(
        code,
        "case`connections`:{let e;return t[18]===Symbol.for(`react.memo_cache_sentinel`)?(e=(0,d.jsx)(n,{id:`settings.section.connections`,defaultMessage:`Connections`,description:`Title for connections settings section`}),t[18]=e):e=t[18],e}case`plugins-settings`:",
        "case`connections`:{let e;return t[18]===Symbol.for(`react.memo_cache_sentinel`)?(e=(0,d.jsx)(n,{id:`settings.section.connections`,defaultMessage:`Connections`,description:`Title for connections settings section`}),t[18]=e):e=t[18],e}case`remote-control-settings`:{let e;return t[21]===Symbol.for(`react.memo_cache_sentinel`)?(e=(0,d.jsx)(n,{id:`settings.section.remote-control-settings`,defaultMessage:`\\u8FDC\\u63A7\\u8BBE\\u7F6E`,description:`Title for remote control settings section`}),t[21]=e):e=t[21],e}case`plugins-settings`:",
        relPath(file)
      );
    }
    return code;
  }, isCheck);
}

function patchSettingsPage(file, isCheck) {
  return patchTextFile(file, relPath(file), (code) => {
    if (!code.includes('"remote-control-settings":J')) {
      code = replaceRequired(code, 'connections:J,"plugins-settings":k', 'connections:J,"remote-control-settings":J,"plugins-settings":k', relPath(file));
    }
    if (!code.includes("`connections`,`remote-control-settings`,`git-settings`")) {
      code = replaceRequired(code, "`mcp-settings`,`hooks-settings`,`connections`,`git-settings`", "`mcp-settings`,`hooks-settings`,`connections`,`remote-control-settings`,`git-settings`", relPath(file));
    }
    if (!code.includes("`mcp-settings`,`remote-control-settings`,`plugins-settings`")) {
      code = replaceRequired(
        code,
        "slugs:[`appshots`,`codex-micro`,`mcp-settings`,`plugins-settings`,`skills-settings`,`browser-use`,`computer-use`]",
        "slugs:[`appshots`,`codex-micro`,`mcp-settings`,`remote-control-settings`,`plugins-settings`,`skills-settings`,`browser-use`,`computer-use`]",
        relPath(file)
      );
    }
    if (!code.includes("case`remote-control-settings`:return!0")) {
      code = replaceRequired(code, "case`connections`:return d&&!u;case`usage`", "case`connections`:return d&&!u;case`remote-control-settings`:return!0;case`usage`", relPath(file));
    }
    if (!code.includes("case`mcp-settings`:case`remote-control-settings`:case`connections`")) {
      code = replaceRequired(
        code,
        "case`local-environments`:case`worktrees`:case`environments`:case`mcp-settings`:case`connections`:case`plugins-settings`:case`skills-settings`:case`hooks-settings`:I=!1",
        "case`local-environments`:case`worktrees`:case`environments`:case`mcp-settings`:case`remote-control-settings`:case`connections`:case`plugins-settings`:case`skills-settings`:case`hooks-settings`:I=!1",
        relPath(file)
      );
    }
    return code;
  }, isCheck);
}

function patchAppMain(file, isCheck) {
  return patchTextFile(file, relPath(file), (code) => {
    if (code.includes('"remote-control-settings":(0,$.lazy)')) return code;
    return replaceRequired(
      code,
      "connections:(0,$.lazy)(()=>yt(()=>import(`./remote-connections-settings-_qCx7Yx9.js`).then(e=>({default:e.RemoteConnectionsSettings}))",
      '"remote-control-settings":(0,$.lazy)(()=>import(`./remote-control-settings-dev.js`).then(e=>({default:e.RemoteControlSettings}))),connections:(0,$.lazy)(()=>yt(()=>import(`./remote-connections-settings-_qCx7Yx9.js`).then(e=>({default:e.RemoteConnectionsSettings}))',
      relPath(file)
    );
  }, isCheck);
}

function writeRemoteSettingsAsset(dir, isCheck) {
  const file = path.join(dir, ASSET_NAME);
  const before = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : null;
  if (before === REMOTE_CONTROL_SETTINGS_ASSET) {
    console.log(`   [ok] ${relPath(file)} already up to date`);
    return 0;
  }
  if (isCheck) {
    console.log(`   [?] ${relPath(file)} would be written`);
    return 1;
  }
  fs.writeFileSync(file, REMOTE_CONTROL_SETTINGS_ASSET, "utf8");
  console.log(`   [ok] ${relPath(file)} written`);
  return 1;
}

function patchPlatform(platform, isCheck) {
  const dir = assetsDir(platform);
  if (!fs.existsSync(dir)) {
    console.log(`-- [${platform}] skipped: assets dir not found`);
    return 0;
  }

  console.log(`\n-- [${platform}] remote control settings`);
  const files = {
    sections: findOne(dir, /^settings-sections-.*\.js$/),
    shared: findOne(dir, /^settings-shared-.*\.js$/),
    page: findOne(dir, /^settings-page-.*\.js$/),
    appMain: findOne(dir, /^app-main-.*\.js$/),
  };

  for (const [key, file] of Object.entries(files)) {
    if (!file) throw new Error(`${platform}: ${key} bundle not found`);
  }

  let changes = 0;
  changes += patchSettingsSections(files.sections, isCheck);
  changes += patchSettingsShared(files.shared, isCheck);
  changes += patchSettingsPage(files.page, isCheck);
  changes += patchAppMain(files.appMain, isCheck);
  changes += writeRemoteSettingsAsset(dir, isCheck);
  return changes;
}

function main() {
  const args = process.argv.slice(2);
  const isCheck = args.includes("--check");
  const platforms = selectedPlatforms(args);

  if (platforms.length === 0) {
    console.log("[ok] No platform assets found");
    return;
  }

  let changes = 0;
  for (const platform of platforms) changes += patchPlatform(platform, isCheck);
  console.log(`\n=> remote control settings patch ${isCheck ? "check" : "complete"}: ${changes} change(s)`);
}

main();
