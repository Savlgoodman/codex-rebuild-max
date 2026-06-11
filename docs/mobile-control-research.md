# Codex Mobile Control 调查笔记

本文档记录对 Codex Desktop 上游包中 Mobile Control 相关功能的静态调查，作为后续继续研究、patch 或复现功能链路的参考。

调查基于上游 Codex Desktop macOS x64 包：

- Codex Desktop: `26.608.12217`
- `app.asar` 来源：`https://persistent.oaistatic.com/codex-app-prod/Codex-darwin-x64-26.608.12217.zip`
- 本仓库当前不提交上游 `src/`，分析时临时解包 `app.asar`

## 结论摘要

这里的 Mobile Control 不是传统意义上的“手机自动化控制”，而是 **Codex Mobile + Remote Control + Computer Use / Browser Use** 的组合能力。

它允许用户把手机或另一台设备连接到当前桌面 Codex 环境，然后从移动端继续任务、接收通知、启动任务，并在授权后让 Codex 访问当前桌面的文件、应用和浏览器。

核心能力包括：

- 连接手机或其他设备到当前 Mac/PC
- 使用 QR code / deep link / pairing code 完成配对
- 要求 ChatGPT 账号启用 MFA
- 管理已授权 remote control clients
- 开关本机 remote control enablement
- 与 `computer-use` 插件能力联动
- 与 Chrome extension / browser-use 联动
- 可配置保持电脑唤醒、锁屏时使用 Mac apps 等选项

## 关键代码位置

上游 `app.asar` 解包后，Mobile Control 相关代码主要在：

- `webview/assets/codex-mobile-page-*.js`
- `webview/assets/codex-mobile-setup-dialog-*.js`
- `webview/assets/codex-mobile-setup-flow-*.js`
- `webview/assets/local-remote-control-enabled-sync-*.js`
- `webview/assets/remote-connections-settings-*.js`
- `.vite/build/main-*.js`

相关资源文件：

- `codex-mobile-announcement-background-*.png`
- `codex-mobile-announcement-phone-*.png`
- `dialog-artwork-ssh-remote-control-allow-*.png`
- `remote-control-authorization-dialog-artwork-*.png`

## UI 流程

从文案和状态判断，Mobile Control 的设置流程大致如下：

1. 初始引导

   用户看到 “Connect your phone to this Mac/PC” 或 “Connect a device to this Mac/PC”。

   安全说明明确提示：Codex 会访问桌面文件、应用和浏览器来完成从手机发送的任务，因此只应连接自己拥有且信任的设备。

2. 安全要求检查

   前端调用远程控制相关接口检查账号安全要求。如果账号未满足要求，会进入 MFA required 状态。

3. MFA required

   UI 提示 “Turn on Multi-Factor Authentication”，并引导用户去 `chatgpt.com` 开启 MFA。

4. 等待手机或设备配对

   支持：

   - 扫 QR code 打开 ChatGPT app 中的 Codex
   - 选择 phone type：`iPhone` / `Android`
   - 在另一台电脑上通过 `Settings > Connections > Control other devices` 输入 pairing code

5. 连接成功

   成功后展示 “You’re connected”，并出现后续能力开关：

   - `Keep this Mac/PC awake`
   - `Enable computer use`
   - `Use your Mac apps while locked`
   - `Set up Chrome extension`
   - `Manage connections`

## 后端接口线索

Mobile Control 使用 ChatGPT / WHAM remote control API：

- `GET /wham/remote/control/mfa_requirement`
- `GET /wham/remote/control/clients`
- `DELETE /wham/remote/control/clients/{client_id}`

前端对这些接口做了错误转换：

- `401`：触发 ChatGPT auth required
- `403`：权限或安全要求问题
- `404`：资源不存在

已登记 client 的判断逻辑会过滤 `enrollment_status === "pending_enrollment"` 的条目。也就是说，pending enrollment 不是最终连接状态，只有非 pending 的 client 才被视为有效连接。

## 状态与同步

Mobile Control 与 Codex Desktop 的状态同步依赖两层机制。

第一层是 shared object：

- `remote_control_connections`
- `remote_control_connections_state`
- `local_remote_control_enabled`
- `local_remote_control_environment_id`
- `electron-local-remote-control-environment-id`
- `electron-local-remote-control-installation-id`
- `electron-remote-control-client-enrollments`

这些 key 由主进程维护，renderer 通过 shared object snapshot 和 update 订阅。

第二层是 App Server / IPC request：

前端通过桌面 message bridge 调用主进程 handler，例如：

- `refresh-remote-control-connections`
- `authorize-remote-control-connections`
- `set-remote-control-connections-enabled`
- `set-local-remote-control-enabled`
- `rename-remote-control-environment`
- `delete-remote-control-environment`
- `set-remote-control-enabled-for-host`

其中 `local-remote-control-enabled-sync-*.js` 做了本机 enablement 的串行化/去重逻辑，避免频繁切换时产生并发状态竞争。

## IPC 链路

Codex Desktop 的 renderer 到 main 通信不是直接暴露 Electron API，而是 preload 暴露 `window.electronBridge`。

简化链路：

```text
renderer
  -> window.electronBridge.sendMessageFromView(payload)
  -> ipcRenderer.invoke("codex_desktop:message-from-view", payload)
  -> main process message handler
  -> webContents.send("codex_desktop:message-for-view", response/event)
  -> preload dispatch MessageEvent("message")
  -> renderer state/store
```

Mobile Control 页面和 settings 页面最终都走这套桥接机制调用主进程能力。

主进程中还有同步初始化通道：

- `codex_desktop:get-shared-object-snapshot`
- `codex_desktop:get-build-flavor`
- `codex_desktop:get-system-theme-variant`
- `codex_desktop:get-sentry-init-options`

## 与 Computer Use 的关系

Mobile Control 连接成功后会引导开启 `computer-use`。

相关能力：

- `computer-use-frontmost-window`
- `computer-use-start-capture`
- `computer-use-native-desktop-app-icon`
- `computer-use-app-approvals-read`
- `computer-use-background-auth-read`
- `computer-use-background-auth-write`

`codex-mobile-setup-dialog` 中会检查 `computer-use` 插件是否已安装且启用。如果满足条件，会展示 “Enable computer use” 和相关配置项。

macOS 上还出现：

- `Use your Mac apps while locked`
- `getInputMonitoringPermissionStatus`
- `openInputMonitoringSettings`

这些说明 mobile control 需要与 macOS 权限、输入监听、桌面捕获能力配合。

## 与 Browser Use / Chrome Extension 的关系

连接成功页中还有 “Set up Chrome extension”。

文案说明：

> Let Codex navigate and fill out forms on websites

这与 `browser-use`、`chrome` / `chrome-dev` / `chrome-internal` 插件相关。Mobile Control 本身不直接实现浏览器自动化，而是把移动端发起的任务接入桌面端已有的 Browser Use 能力。

## 与 Remote Connections Settings 的关系

Settings 中有 Remote Connections 页面，包含 SSH remote 和 remote control 两套连接。

Remote Control 相关操作包括：

- 刷新 remote control connections
- 授权 remote control
- 重命名 remote control environment
- 删除 remote control environment
- revoke client
- 控制当前 Mac/PC
- 控制其他设备

settings 页面会读取：

- `remote_ssh_connections`
- `remote_control_connections`
- `remote_control_connections_state`

并根据 gate / feature availability 判断是否显示 remote control 区域。

## Feature Gate 线索

发现的 gate ID：

- `1042620455`：用于 remote control connections enablement 同步
- `410065390`：出现在 Codex Mobile setup dialog 中
- `2055603567`：与 mobile MFA setup required 相关

这些 gate 可能由 Statsig 或服务端策略控制。后续如果要强制启用 Mobile Control，需要同时检查：

- renderer 侧是否隐藏入口
- main 侧 feature availability 是否允许
- App Server / API 侧是否真的授权
- 账号是否满足 MFA / plan / allowlist 要求

## 与 Codex Micro 的区别

调查过程中也发现了 `CodexMicroService`，但它不是 Mobile Control。

`CodexMicroService` 负责 Work Louder / Creator Micro 外设：

- 查找 `CreatorMicroV2`
- 监听 HID key event
- 监听 joystick event
- 同步灯光状态
- 向窗口发送：
  - `codex-micro-device-state-changed`
  - `codex-micro-hid-event`
  - `codex-micro-joystick-event`

它是硬件外设集成，不是手机远程控制。

## 后续研究方向

1. 还原完整状态机

   重点读 `codex-mobile-setup-dialog-*.js` 中的状态计算：

   - `initial`
   - `mfa-required`
   - `waiting`
   - `connected`
   - `dismiss`

   目标是画出每个状态依赖哪些 API、shared object 和 feature gate。

2. 追踪 pairing code 来源

   目前已看到 pairing code / QR / deep link 文案，但还需要定位 pairing code 的生成接口或 App Server handler。

   关键词：

   - `remote-control-server-pairing`
   - `remote-control-pairing-enablement`
   - `waiting-for-added`
   - `remote-control-clients`

3. 验证本机 enablement

   重点看：

   - `set-local-remote-control-enabled`
   - `set-remote-control-enabled-for-host`
   - `local-remote-control-enabled-sync`

   目标是确认本机打开 remote control 后，App Server 写入了什么配置、启动了什么服务。

4. 追踪 remote control authorization

   重点看：

   - `authorize-remote-control-connections`
   - `remote_control_connections_state.authRequired`
   - `remote_control_connections_state.clientAuthorized`
   - `remote_control_enrollment_account_mismatch`

5. 研究与 computer-use 的权限边界

   重点确认：

   - macOS 输入监听权限
   - 屏幕捕获权限
   - 锁屏时控制 Mac apps 的实现
   - Windows 下 `CODEX_ELECTRON_ENABLE_WINDOWS_COMPUTER_USE`

6. 研究 Browser Use 接入

   Mobile Control 本身应该只是入口和授权层，真正网页控制仍由 Browser Use / Chrome Extension 实现。

   重点关键词：

   - `browser-use`
   - `browser-use-session-route-capture`
   - `browser-sidebar-sync`
   - `browser-sidebar-owner-sync`
   - `chrome`
   - `chrome-dev`
   - `chrome-internal`

7. 判断哪些部分可以 patch

   可以考虑 patch 的层：

   - UI 入口隐藏逻辑
   - feature availability
   - Statsig gate
   - 本机 shared object 默认值

   不宜轻易 patch 的层：

   - 账号 MFA 要求
   - `/wham/remote/control/*` 服务端授权
   - remote control client enrollment
   - 设备信任与安全校验

## 推荐下一步

如果后续要继续研究，建议先运行一次完整上游同步：

```bash
npm run sync
```

然后对 `src/mac-x64/_asar` 或 `src/win/_asar` 做定向分析。推荐搜索：

```bash
rg -n "codex-mobile|remote-control|remote_control|local_remote_control|pairing|mfa_requirement|computer-use|browser-use" src
```

如果要写 patch，应优先写成 AST/结构化匹配，避免依赖压缩后的变量名。
