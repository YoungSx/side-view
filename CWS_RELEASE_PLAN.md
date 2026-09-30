# Chrome Web Store 发布计划

更新：2026-09-30。代码基线：`9a4fd98`。这是上架准备计划，不是已送审或已获批准的声明。

## 当前结论

建议先完成下列 P0，再以同一个商店条目的 Unlisted 或 Private 可见性进行小范围测试，稳定后转 Public。
这些可见性均需要同样的审核，不能借此绕过政策。全功能版本可以作为目标，但 Threads 原生接入需要单独说明其可审查性和稳定性。

当前状态：

- MV3；lint、类型检查、53 项测试通过；已有 X / Bluesky / Threads 的实机记录。
- `pnpm zip` 可生成 `.output/side-view-0.1.0-chrome.zip`，manifest 位于 ZIP 根目录。
- 图标已接入：`public/icons/` 包含 16/32/48/128px 透明 PNG，manifest 声明 `icons`；源图和导出说明见 `assets/icon/README.md`。
- 隐私政策已产出：[docs/privacy-policy.md](docs/privacy-policy.md)。商店后台"隐私政策"字段填 `https://github.com/YoungSx/side-view/blob/main/docs/privacy-policy.md`（GitHub 原生渲染 Markdown，无需自建托管）。该网址依赖文件已进入 `main`，合入前不可用。尚缺商店宣传图、标准尺寸截图、专门审核指引和正式支持页面。
- 自动化测试和当前机器验收不能代替全新配置、商店安装版、多账户及平台变更后的验证。

## P0：送审前完成

| 工作 | 具体交付 / 验收标准 |
| --- | --- |
| 最小权限 | 逐项核对 manifest 与 content-script matches；X 改为确有需要的 HTTPS 域名，Threads 收紧为实际使用的根域 / www，保留旧域需有实际用途；不引入 all_urls、cookies、history、debugger 等无关权限。评估按站点可选授权，但不在首发前为形式而重构。 |
| X 网络规则 | 当前规则针对 X/Twitter 同站点发起的 sub_frame，但会去掉整个 CSP。确认是否只去掉 X-Frame-Options 就足够；如确需 CSP 处理，进一步限制目标路径并说明证据。不能在没有测试的情况下直接删除所需规则，也不能对所有站点放宽。 |
| Threads 原生接入审核说明 | 说明 MAIN-world 脚本、只响应真实用户点击、原生 router / mounted callback 的调用、保存并复用一个原生列，以及关闭使用原生“移除列”。解释没有从服务器下载并执行自定义脚本，没有 eval；同时不能把调用站点自身逻辑隐藏为“纯 DOM 样式”。 |
| Threads 稳定性 | 验证新建、连续切换、快速连续点击、刷新、多标签页并发、账号切换、移除后重建、能力缺失回退。当前实现依赖 React fiber、内部模块名和函数特征，需要明确维护责任。 |
| 隐私与数据流 | 隐私政策已产出（[docs/privacy-policy.md](docs/privacy-policy.md)），按当前源码核对撰写：读取页面内容 / 链接仅服务侧栏功能；偏好使用 chrome.storage.sync，列 ID 使用 chrome.storage.local；Threads 原生列配置会通过站点正常功能保存到用户账号，已单独显著说明。仍需由账号持有人提供公开 HTTPS 托管地址。复核点：不得改成"完全不联网"或"所有数据永不离开设备"；每次发布前重新核对源码中是否存在自建的分析上报端点。 |
| 身份与说明 | 独立品牌，不暗示获得 X、Bluesky、Meta 或 Google 官方授权。显著说明 Threads 会持久保存一个原生列，扩展停用或卸载不等于移除该原生列。 |
| 安装体验 | 新配置从零安装，确认设置入口易找到；按需打开、关闭恢复、无双边框、无旧工具栏、图标色 / 悬停尺寸、窄窗口、明暗主题、SPA 跳转、加载失败均正常。更新不能丢偏好或复制 Threads 列。 |

### 审核风险判断

Chrome 的 MV3 政策要求扩展完整功能可从提交的代码判断。隔离 iframe 有相关例外，但并不免除隐私和可审查性要求。
Threads 调用第一方页面内部动作，以及 X 去除 CSP 的范围，是本项目最值得提前解释的两点。
这是工程上的审核风险判断，不是官方已认定违规，也不保证一定获批。

若审核明确不接受 Threads 的调用方式，备选为首版只发布 X/Bluesky，Threads 留在开发构建继续调整。
必须真正从该提交包删除 Threads 代码、入口和相关权限，并同步修改文案；仅隐藏开关不是合规替代方案。
是否采用这一备选，应根据审核反馈及产品取舍决定，不在本计划中擅自裁剪现有功能。

## P1：发布资产与文案

- 图标文件已完成：包内 128×128 PNG 使用 96px 内容框和透明边距，并提供 16、32、48px 版本及 manifest `icons`。当前选定图案引用旧 Twitter 鸟标；发布前需确认使用权及非官方身份表达，尺寸合规不代表商标使用已获许可或商店审核已通过。见 [图标说明](assets/icon/README.md)。
- 必需的 440×280 小宣传图；1400×560 大宣传图可后续补。
- 准备 3–5 张 1280×800 截图（官方允许 640×400；至少 1 张）：X 原生顶栏融合、Bluesky 原按钮让位、Threads 真原生多列、设置页。使用自有或获许可的中性演示内容，避免暴露私人消息、账号详情或不适合商店展示的动态流内容。
- 商店标题已定：`Side View — Social Post Sidebar`（中文 `Side View — 社交动态侧栏`）。标题无独立字段，取自 `manifest.name`，已改为 `__MSG_extName__` 按四语言本地化；平台名放在 description，不进标题以规避商标风险。
- 单一用途草案：`Read social posts beside the feed without losing your place.`
- 简述草案：`Read X and Bluesky posts beside your feed, and open Threads posts in a reusable native column.`（manifest description 上限 132 字符。）
- 详细说明包括平台差异、开关 / 最大栏宽 / Compact 的适用范围、Threads 持久列行为、恢复原布局方式、已知限制、非官方声明和支持入口。
- 提供公开 HTTPS 隐私政策地址、支持邮箱 / GitHub Issues、版本更新记录。可使用项目 GitHub Pages 托管说明页。

## P2：开发者账号与后台

由账号持有人准备：

1. 注册 Chrome Web Store 开发者账号，接受条款并支付一次性注册费；金额以当前后台为准。
2. 开启 Google 账号两步验证，设置发布者名称，验证联系邮箱，完成后台要求的身份 / 地区资料。
3. 上传 ZIP，填写 Store listing、Privacy practices、Distribution 和 Test instructions。
4. 单一用途、权限理由、隐私政策和代码行为必须一致。
5. 推荐先关闭审核通过后自动公开发布，使用 deferred publishing 控制上线时机。

权限理由草案（需随最终包修改）：

| 权限 | 理由 |
| --- | --- |
| storage | 保存功能偏好和复用 Threads 原生详情列所需的列 ID。明确 sync 与 local 的差异。 |
| X / Bluesky 主机访问 | 在用户访问相应站点时识别帖子、挂载详情、融入原生顶栏并恢复布局。 |
| Threads 主机访问 | 响应用户点击，使用站点自身列功能创建 / 更新一个原生详情列。 |
| declarativeNetRequestWithHostAccess | 仅为 X/Twitter 的同源详情子框架处理必要的响应头；无 Threads 或 Bluesky 的网络放宽规则。 |

远程代码字段必须结合最终实现和 MV3 政策填写，不能仅凭“没有 fetch 脚本”就草率回答。准备独立审核备注解释页面逻辑与扩展包内逻辑的边界。

## P3：可复现包和审核指引

发布命令顺序：

```powershell
pnpm install --frozen-lockfile
pnpm lint
pnpm compile
pnpm test
pnpm zip
```

- 冻结版本（建议首发准备完成后使用 0.1.1），每次更新递增。
- ZIP 只包含生产输出，manifest 位于根目录，不含源码研究副本、日志、测试截图、凭据或开发服务器地址。
- 记录源码提交、Node / pnpm 版本、ZIP SHA-256，保存该次产物；未来不能用同版本不同内容替换留档。
- 三平台各写一条独立测试路径：登录 / 可公开访问前提 → 点击 → 切换 → 关闭 / 移除 → 刷新重开。
- 若审核需账号，提供专门测试账号和具体步骤到后台测试说明字段；不提交个人主账号，不将任何凭据写入 Git。
- 记录扩展请求的网络 / 存储行为，说明帖子和账号操作仍由原站点完成。

## P4：审核与上线

1. 先小范围分发，收集不同窗口尺寸、不同账号和不同主题的反馈。
2. 审核通过后安装商店签名版本复测，排除仅 unpacked 环境可用的问题。
3. 验证完成再 Public；上线后关注支持反馈和三个平台的 DOM / 内部接口变化。
4. 官方说明多数审核需数日，也可能数周；不能承诺固定过审日期。延期发布通过后通常有 30 天发布窗口。

建议推进顺序：先完成权限与 Threads 审核说明 → 图标 / 隐私政策 / 文案 → 固定版本并跑完整回归 → 后台录入与小范围发布。
准备工作可并行；评估 2–4 个工作日是工程估计，不包含账号验证和 Google 审核等待。

## 官方资料（本次实时查阅）

- [注册账号](https://developer.chrome.com/docs/webstore/register)
- [账号设置](https://developer.chrome.com/docs/webstore/set-up-account)
- [两步验证](https://developer.chrome.com/docs/webstore/program-policies/two-step-verification)
- [发布包准备](https://developer.chrome.com/docs/webstore/prepare)
- [图片要求](https://developer.chrome.com/docs/webstore/images)
- [隐私字段与权限理由](https://developer.chrome.com/docs/webstore/cws-dashboard-privacy)
- [MV3 代码要求](https://developer.chrome.com/docs/webstore/program-policies/mv3-requirements)
- [测试说明](https://developer.chrome.com/docs/webstore/cws-dashboard-test-instructions)
- [可见性与测试分发](https://developer.chrome.com/docs/webstore/cws-dashboard-distribution)
- [送审与延期发布](https://developer.chrome.com/docs/webstore/publish)
- [审核流程与时间](https://developer.chrome.com/docs/webstore/review-process)
