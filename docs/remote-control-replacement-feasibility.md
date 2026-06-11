# Remote Control 自建链路可行性分析

本文基于 Codex Desktop `26.608.12217` 的静态解包结果，分析“替换官方 Remote Control 服务器链路，并提供一个 remote-web-ui 控制 Codex App”的可行性。

结论先行：

- **完全复刻官方 Remote Control 协议可行，但成本高、脆弱、维护压力大。**
- **接管本地控制函数/handler，再接入自建中转服务器和 remote-web-ui，更适合做 POC 和长期维护。**
- 推荐路线是：**自建协议 + 本地桥接层 + 复用 Codex App 原生执行能力**，不要优先尝试完整伪造官方 `/codex/remote/control/*` 后端。

## 已确认的现有链路

Codex Desktop 的 Remote Control 至少有三层：

1. Renderer / UI 层

   UI 通过 `vscode://codex/<method>` 调用 Electron main 进程的 handler。

   典型方法：

   - `refresh-remote-control-connections`
   - `authorize-remote-control-connections`
   - `set-remote-control-connections-enabled`
   - `set-local-remote-control-enabled`
   - `rename-remote-control-environment`
   - `delete-remote-control-environment`
   - `set-remote-control-enabled-for-host`

2. Electron main / App Server 桥接层

   `preload.js` 暴露 `window.electronBridge.sendMessageFromView()`，最终通过：

   ```text
   renderer
     -> window.electronBridge.sendMessageFromView(payload)
     -> ipcRenderer.invoke("codex_desktop:message-from-view", payload)
     -> main handleVSCodeRequest / app host
     -> webContents.send("codex_desktop:message-for-view", payload)
   ```

   `vscode://codex/*` 请求会进入 main 里的 `handleVSCodeRequest`，再分发到本地 handler。

3. 官方 Remote Control 云端协议层

   main 进程会访问官方 API：

   - `GET /codex/remote/control/environments`
   - `PATCH /codex/remote/control/environments/{env_id}`
   - `DELETE /codex/remote/control/environments/{env_id}`
   - `POST /codex/remote/control/client/enroll/start`
   - `POST /codex/remote/control/client/enroll/finish`
   - `POST /codex/remote/control/client/refresh/start`
   - `POST /codex/remote/control/client/refresh/finish`
   - WebSocket `/codex/remote/control/client`

   renderer 侧还会访问 ChatGPT / WHAM API：

   - `GET /wham/remote/control/mfa_requirement`
   - `GET /wham/remote/control/clients`
   - `DELETE /wham/remote/control/clients/{client_id}`
   - `GET /accounts/mfa_info`

## 方案一：从官方接口协议走

这个方案的意思是：让 Codex App 仍然以为自己在连官方 Remote Control 服务，但实际被导向自建中转服务器。

### 可行点

1. API base 可能可重定向

   解包代码里看到 API base 选择逻辑会读取：

   - `CODEX_API_BASE_URL`
   - `CODEX_API_ENDPOINT=localhost`

   也就是说，理论上可以通过环境变量或 patch 把 `/codex/remote/control/*` 指到自建服务。

2. HTTP 接口边界比较清晰

   环境列表、重命名、删除、client enrollment、refresh 都是普通 HTTP JSON 接口，能按 observed schema 逐步 mock。

3. WebSocket 入口明确

   App 会连：

   ```text
   /codex/remote/control/client
   ```

   并携带 `x-codex-client-session-token: Bearer <remote_control_token>`。

### 难点

1. Enrollment 不是简单登录

   App 会生成本机 device key，并把公钥和 proof 交给服务器。相关本地状态存在：

   - `electron-remote-control-client-enrollments`

   关键流程：

   - enroll/start 返回 `client_id`、`account_user_id`、`device_key_challenge`
   - App 创建 OS protected device key
   - 需要 step-up token，scope 类似 `codex.remote_control.enroll`
   - enroll/finish 校验 `device_key_proof`
   - refresh/start 和 refresh/finish 后拿到 `remote_control_token`

2. App 会严格校验 challenge

   本地校验包含：

   - `purpose === "remote_control_client_enrollment"`
   - `audience === "remote_control_client_enrollment"`
   - `target_origin`
   - `target_path`
   - `account_user_id`
   - `client_id`
   - device identity hash

   WebSocket 连接还会校验：

   - `purpose === "remote_control_client_websocket"`
   - `audience === "remote_control_client_websocket"`
   - scope 必须是 `remote_control_controller_websocket`
   - token sha256 要匹配
   - token 过期时间和 scope 要匹配

3. WebSocket transport 不是裸 JSON-RPC

   已看到的消息类型包括：

   - `device_key_challenge`
   - `ack`
   - `server_message`
   - `server_message_chunk`
   - `pong`

   还存在分片、cursor、seq_id、stream_id、ack buffer、reconnect 等逻辑。remote-web-ui 不能只发一个普通 JSON-RPC 包就控制成功。

4. 仍然绕不开账号/MFA/授权语义

   UI 和 main 都假设存在 ChatGPT auth headers、account id、account user id、MFA 或 step-up。自建服务器可以选择放宽校验，但 App 本地还有一部分校验必须满足或 patch。

### 判断

官方协议路线适合做“兼容官方 Remote Control 行为”的长期逆向项目，但不适合作为第一版 remote-web-ui。

可行性：

- **不 patch App，只靠自建后端复刻官方协议：低到中。**
- **patch API base + patch 掉部分 enrollment/step-up 校验：中。**
- **完整兼容官方 mobile / web controller：低，工作量最大。**

主要风险是协议会随版本变化，且 enrollment / device key / token / websocket transport 任一处变化都会导致链路断开。

## 方案二：接管原生控制函数

这个方案的意思是：不复刻官方云端协议，而是在 Codex App 本地加一个 bridge，让自建中转服务器和 remote-web-ui 通过这个 bridge 调用 Codex App 已有能力。

### 可行点

1. 本地 handler 已经很完整

   main 里已有 `handleVSCodeRequest` 分发机制。remote-web-ui 的命令可以翻译成本地 handler 调用，例如：

   - 刷新连接
   - 启用/禁用本机 remote control
   - 读取 shared object
   - 打开 workspace
   - 创建/继续本地 conversation
   - 触发 App Server 请求
   - 调用 computer-use / browser-use 相关能力

2. 可以绕开官方 enrollment

   自建 bridge 可以自己做 pairing：

   - remote-web-ui 显示 pairing code
   - Codex App 本地 bridge 连接自建中转
   - 中转只保存自定义 session token
   - 不使用官方 `remote_control_token`

3. 可以复用原生执行能力

   真正危险、复杂的部分，例如文件访问、终端、computer-use、browser-use、权限审批，本来就在 Codex App / App Server / plugin 里。bridge 只负责“把远端意图送进去”，不用重写执行层。

### 难点

1. 需要新增或 patch main 进程代码

   最稳定的位置是 main 进程，因为 main 能访问：

   - `sharedObjectRepository`
   - `remoteConnectionsHandler`
   - App Server client
   - window manager
   - existing `handleVSCodeRequest`

   只 patch renderer UI 会受限比较多，尤其是后台连接、持久 socket、权限和 App Server 访问。

2. 需要设计自己的 command schema

   建议不要照抄官方 websocket transport。第一版可以设计成简单的 JSON-RPC / WebSocket：

   ```json
   {
     "id": "req_...",
     "type": "request",
     "method": "codex.createConversation",
     "params": {}
   }
   ```

   Codex App 返回：

   ```json
   {
     "id": "req_...",
     "type": "response",
     "ok": true,
     "result": {}
   }
   ```

3. 权限边界要重新设计

   remote-web-ui 等价于远程操作本机 Codex。必须有：

   - pairing code 或一次性授权
   - session token
   - origin / device allowlist
   - 命令级权限
   - 审计日志
   - 一键断开

4. full computer-use 控制要分阶段

   “让远端网页直接点屏幕、看屏幕、输入键盘”比“远端发 prompt 让 Codex 执行任务”难很多。建议先做任务级控制，再做实时桌面控制。

### 判断

本地 bridge 路线更实际。

可行性：

- **remote-web-ui 发起任务、选择目录、查看状态、继续会话：高。**
- **remote-web-ui 触发 browser-use / computer-use 的已有能力：中。**
- **remote-web-ui 实时远程桌面级控制：中到低，需要单独协议和权限设计。**
- **兼容官方 Mobile Control UI：中，需要 patch shared object 和入口状态。**

## 推荐架构

推荐做一个三段式架构：

```text
remote-web-ui
  <-> 自建 relay server
  <-> Codex App 本地 bridge
  <-> Codex App main handlers / App Server / plugins
```

### Codex App 本地 bridge

职责：

- 启动时连接自建 relay server
- 本地生成 installation id / environment id
- 与 relay 完成 pairing
- 接收 remote-web-ui 命令
- 调用 Codex App 本地 handler 或 App Server client
- 把状态、日志、conversation event 推回 relay

建议第一版不要侵入官方 Remote Control class，而是新增独立 bridge。这样官方协议变化不会直接影响自建链路。

### Relay server

职责：

- 设备注册
- pairing code
- session/token 管理
- WebSocket 转发
- 命令鉴权
- 状态缓存

Relay 不需要理解 Codex 内部所有状态，只要能转发 command 和 event。

### remote-web-ui

职责：

- 登录或本地口令保护
- 展示在线 Codex App 环境
- 发送 prompt / command
- 查看 conversation 状态
- 管理连接和权限

第一版功能建议：

- 设备列表
- 连接/断开
- 选择 workspace
- 发送 prompt
- 查看执行状态和最新输出
- 停止任务

第二版再考虑：

- 文件树浏览
- 权限审批
- browser-use 面板
- computer-use 截图/输入

## 两条路线对比

| 维度 | 复刻官方协议 | 接管本地控制函数 |
| --- | --- | --- |
| 初始 POC 难度 | 高 | 中 |
| 协议稳定性 | 低 | 中到高 |
| 对官方账号依赖 | 高 | 可低 |
| 是否需要 patch | 大概率需要 | 需要，但范围可控 |
| 能否接官方 Mobile | 理论可行，难 | 不兼容官方 Mobile，服务自建 web-ui |
| 安全模型 | 需要复刻官方 | 可自定义 |
| 推荐度 | 不推荐第一版 | 推荐 |

## POC 路线

建议按以下顺序推进：

1. 证明 main 进程可调用本地 handler

   目标是通过 patch 或注入，在 main 进程里调用一个简单 handler，例如：

   - `set-local-remote-control-enabled`
   - `home-directory`
   - `app-server-connection-state`

2. 做本地-only bridge

   先开 `localhost` WebSocket，不经过公网 relay。

   remote-web-ui 调用：

   - `GET /state`
   - `POST /command`
   - `WS /events`

3. 接入 relay server

   Codex App 主动连 relay，避免 NAT 穿透问题。

4. 实现任务级控制

   优先能力：

   - 新建 conversation
   - 发送 prompt
   - 停止任务
   - 读取 conversation 状态

5. 再研究 computer-use / browser-use

   重点看这些 handler / plugin 能力：

   - `computer-use-start-capture`
   - `computer-use-frontmost-window`
   - `browser-use`
   - `browser-use-session-route-capture`
   - Chrome extension 管理能力

## 需要继续验证的问题

1. `handleVSCodeRequest` 是否容易从新增 bridge 直接复用，还是需要绕过 class 私有上下文。
2. 创建 conversation / 发送 prompt 的最小 handler 是哪个。
3. App Server client 的事件流如何订阅并转发给 remote-web-ui。
4. computer-use 的截图流和输入事件是否能从 main 直接触发。
5. Windows 和 macOS 的权限模型差异。
6. 自建 relay 的 pairing 和撤销机制如何落地。

## 最终建议

不要第一步就复刻官方 Remote Control 云端协议。那条路会把大量时间花在 enrollment、device key、step-up token、websocket transport 兼容上，而这些并不是 remote-web-ui 的核心价值。

更推荐先做：

```text
自建 relay + Codex App 本地 bridge + 复用原生 handler
```

等任务级 remote-web-ui 跑通后，再决定是否要兼容官方协议层，或者只 patch 官方 Mobile Control UI 让它显示自建连接状态。
