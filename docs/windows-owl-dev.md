# Windows Owl Dev Startup

这份文档记录当前项目在 Windows 上启动 Codex Desktop 开发版本的方式。重点是：不要用 npm 安装的普通 Electron 直接启动上游 app，而是使用上游 MSIX 包里自带的 Owl shell runtime。

## 背景

上游 Windows 包里的 native modules 是按 Owl runtime 构建的，不是按本项目 `node_modules/electron` 里的普通 Electron 构建的。典型表现是普通 Electron 可以加载 JS，但打开本地 SQLite 数据库时会失败：

```text
Codex cannot access its local database.
Error: The specified module could not be found.
...better_sqlite3.node
```

`src/win/_asar/node_modules/better-sqlite3/.codex-native-module-build.json` 里可以看到 `runtimeName: "owl"` 和对应 runtime target。因此 Windows 开发启动必须复用官方包里的 `Codex.exe` Owl shell。

## 目录约定

同步上游资源后，项目会有：

```text
src/win/
  _asar/              # app.asar 解包内容，主要修改目标
  app.asar.unpacked/  # native modules
  codex.exe           # CLI/app-server
  plugins/
  native/
```

`npm run dev` 第一次启动时会把 `%TEMP%\codex-sync\win-extract\app` 复制到项目本地缓存：

```text
.codex-runtime/win/app/
  Codex.exe
  resources/
```

这个目录是本地开发缓存，已经加入 `.gitignore`。它比一直依赖 `%TEMP%` 稳定；如果缓存缺失或 Owl shell marker 变化，脚本会从 sync 缓存重新复制。

## 启动流程

推荐流程：

```powershell
npm install
npm run sync -- --skip-mac
npm run dev
```

`npm run dev` 在 Windows 上会自动执行：

1. 确保 `.codex-runtime/win/app/Codex.exe` 存在。
2. 将 `src/win/_asar` 打包为 `src/win/app.asar`。
3. 将新的 `app.asar` 复制到 `.codex-runtime/win/app/resources/app.asar`。
4. 同步 `src/win/app.asar.unpacked` 到 Owl runtime 的 resources。
5. 使用官方 Owl `Codex.exe` 启动开发版本，并传入 `--user-data-dir=<project>/.codex-dev-user-data`。

## 日常注意事项

日常开发时，一般只需要执行：

```powershell
npm run dev
```

只有在以下情况才需要重新同步上游 Windows 包：

```powershell
npm run sync -- --skip-mac
```

- `src/win` 不存在或被清理。
- `.codex-runtime/win/app` 不存在或被清理。
- 上游 Codex Desktop 版本变更，需要重新拉取官方资源。
- Owl runtime 缓存 marker 变化，启动脚本提示需要重新同步。

不要手动修改 `.codex-runtime/win/app/resources/app.asar`，因为 `npm run dev` 每次都会从 `src/win/_asar` 重新打包并覆盖它。需要调试 app 代码时，修改 `src/win/_asar` 下的文件，然后重新执行 `npm run dev`。

如果启动后发现 Codex 窗口已经存在，但这次修改没有生效，优先关闭旧的 dev Codex 进程后再启动。Windows 上单实例锁和已有窗口可能会让新启动行为被旧进程接管。

开发日志默认可以看：

```text
.codex-dev.log
```

启动成功的关键信号包括：

```text
Owl Runtime: <project>\.codex-runtime\win\app
Dev User Data: <project>\.codex-dev-user-data
local app-server sqlite initialized
```

Remote Control 的 ChatGPT 认证警告可以先忽略。它说明官方 websocket 链路需要 ChatGPT 登录态，不代表本地 IPC、app-server 或 SQLite 初始化失败。

如果要临时绕过 Owl runtime，使用普通 npm Electron，可以设置：

```powershell
$env:CODEX_USE_NPM_ELECTRON = "1"
npm run dev
```

但这通常会再次遇到 native module 兼容问题，只适合排查普通 Electron 相关行为。

## User Data 隔离

开发启动默认使用项目内独立目录：

```text
.codex-dev-user-data/
```

启动脚本会设置：

```text
CODEX_ELECTRON_USER_DATA_PATH=<project>/.codex-dev-user-data
BUILD_FLAVOR=dev
--user-data-dir=<project>/.codex-dev-user-data
```

这样不会读写正式 Codex 的 user data，例如：

```text
C:\Users\<user>\AppData\Roaming\Codex\web\Codex
```

这点对 Remote Control / Mobile Control 调研很重要，因为数据库、登录态、线程状态和 app-server 运行状态都应该与正式客户端隔离。

如果需要指定另一个开发数据目录：

```powershell
$env:CODEX_ELECTRON_USER_DATA_PATH = "D:\tmp\codex-dev-user-data"
npm run dev
```

## 自定义 Owl Runtime

默认 runtime 缓存在：

```text
.codex-runtime/win/app
```

如果你想手动指定官方 Owl shell 目录：

```powershell
$env:CODEX_OWL_APP_DIR = "C:\Users\<user>\AppData\Local\Temp\codex-sync\win-extract\app"
npm run dev
```

目录下必须存在：

```text
Codex.exe
resources/
```

## 常见问题

### 仍然使用正式 user data

检查正在运行的进程参数：

```powershell
Get-CimInstance Win32_Process |
  Where-Object { $_.Name -match 'Codex|codex' } |
  Select-Object ProcessId,Name,CommandLine
```

如果看到 `--user-data-dir=C:\Users\<user>\AppData\Roaming\Codex\web\Codex`，说明当前进程不是隔离 dev 启动，或者是旧进程还没退出。关闭旧的 dev Codex 后重新执行 `npm run dev`。

Owl shell 会在 native startup 阶段提前选择 user data，所以只设置 `CODEX_ELECTRON_USER_DATA_PATH` 不够；开发脚本必须同时传 `--user-data-dir`，否则日志里会出现：

```text
Ignoring late userData path change after native startup.
```

### 找不到 Owl runtime

报错类似：

```text
Windows Owl runtime not found. Run "npm run sync -- --skip-mac" first
```

先同步 Windows 包：

```powershell
npm run sync -- --skip-mac
```

如果上游包已经下载过，脚本会复用 `%TEMP%\codex-sync` 缓存。

### better-sqlite3 加载失败

如果还是出现 `better_sqlite3.node` 相关报错，优先确认是否误用了普通 Electron：

```powershell
$env:CODEX_USE_NPM_ELECTRON
```

没有特殊排查需求时，这个变量应该为空。

### Remote Control 认证警告

开发日志里可能出现：

```text
failed to connect to app-server remote control websocket
remote control requires ChatGPT authentication; API key auth is not supported
```

这是官方 Remote Control websocket 链路的认证限制，不代表本地 app-server 或 IPC 链路启动失败。后续自建中转服务器 / remote-web-ui 方案可以在这个隔离 dev 环境里继续验证。

## 对后续 Remote Control 改造的意义

现在开发启动已经具备三个前置条件：

1. 使用与上游 native modules 匹配的 Owl runtime。
2. 修改 `src/win/_asar` 后可以通过 `npm run dev` 快速打包并启动。
3. 使用独立 user data，避免污染正式 Codex。

因此后续可以安全地做两类实验：

1. 官方接口协议方向：拦截或替换 remote control websocket endpoint，验证自建 relay 的消息形态。
2. 原生控制函数方向：在 Electron main/app-server bridge 附近接入本地 HTTP/WebSocket bridge，直接调用现有控制函数或转发 MCP/app-server 请求。
