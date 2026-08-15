# IdleFlow UI 设计评审与修复计划

日期：2026-08-15
范围：`source/apps/desktop/frontend`（App.tsx / styles.css / api.ts / model.ts / policyDraft.ts / index.html）

## 设计原则决议

界面坚持**极简编辑排版**路线：零圆角、黑白纸面、细分割线。不恢复设计稿中的
四格状态条与系统状态侧栏。状态呈现遵循「**常态零噪音，异常态才说话**」：

- 管理模式（策略生效）是常态，界面不多一个元素；
- 观察模式（保存不生效）是异常态，以一条情境提示条呈现，并附带「接管」入口；
- 电源来源、运行时 inhibited、守护进程 PID 等信息**不进界面**。

## 本轮功能决议

| 项目 | 决议 |
| --- | --- |
| 接管当前策略 | 观察模式时，在 `policy-heading` 下方出现一条情境提示条（复用 `.notice` 版式）：「观察模式 · 保存不会接管系统」+「接管当前策略」文字按钮；接管成功后提示条隐退，经 message 区短暂提示「IdleFlow 正在管理」 |
| 回退原策略 | 页脚 `policy-actions` 区放低调文字按钮「回退原策略」，仅管理模式可用（对应 `api.rollback`），与「接管」成本对等 |
| 测试锁屏 | 页脚放「测试锁屏」文字按钮（对应 `api.lock`） |
| 电源 / inhibited 状态 | 不展示 |
| 保存成功文案 | 保留「所有权状态没有改变」的前提是所有权已可见；提示条落地后此文案成立 |

## 问题清单

### P0 — 功能与正确性

**P0-1 所有权状态不可见，无接管/回退入口**
`api.ts` 的 `takeOver` / `rollback` / `inhibited` / `lock` 与 `model.ts:30` 的
`statusLabel()` 均未在 `App.tsx` 使用。观察模式下保存成功但系统行为不变，属静默失败。
→ 按上方「本轮功能决议」实现情境提示条 + 页脚回退/测试锁屏。

**P0-2 通知类型靠文案前缀匹配**
`App.tsx:357` 用 `message?.startsWith('操作未完成')` 判断 error；「无法连接 idled…」
（`App.tsx:326`）不匹配，会被渲染成 success 样式。
→ message 状态改为 `{ text, kind }` 结构，显式携带类型。

**P0-3 busy 期间编辑被静默吞掉**
`busy` 只禁用按钮（`App.tsx:368,466`），滑块/数字输入/开关仍可编辑；操作完成后
`setPolicyDraft(PolicyDraft.from(...))` 整体覆盖草稿，期间的输入丢失。
→ busy 时禁用全部编辑控件。

### P1 — 视觉层级与可访问性

**P1-1 阶段选中态零视觉反馈**
`.route-stage.selected` 在 styles.css 中无任何规则（选择逻辑见 `App.tsx:200`）。
点击阶段按钮/聚焦滑块会更新 `selectedStage` 但界面无变化。
→ 补选中样式（如加粗 + 下划粗线），或删除该状态逻辑。

**P1-2 深色标题栏上焦点不可见**
全局 `outline: 2px solid var(--ink)`（styles.css:64）为纯黑，在 `#0a0a0a`
标题栏上完全隐形，刷新按钮获焦无感知。
→ 深色区域内的控件单独设浅色 outline。

**P1-3 对比度与字号不达标**
- 非激活模式页签 `--soft #a3a3a3` 配 `#f4f4f2`，约 2.4:1（AA 需 4.5:1）；
- 非激活行整行 `opacity: .64`（styles.css:284）但控件仍可操作；
- 微文案 9–11px，移动断点下 7px。
→ 非激活文字改用 `--muted` 或更深；可操作的非激活行不整行降透明度（只淡化装饰元素）；
正文字号下限 11px，微标签下限 9px。

**P1-4 滑块仅 WebKit 样式**
只有 `::-webkit-slider-*`（styles.css:372-385），无 `::-moz-range-*`；
`appearance: none` 未带 `-webkit-` 前缀。Firefox 打开 `?preview` 页面时滑块退化为原生样式。
→ 补 moz 伪元素与前缀。

**P1-5 滑块 step 与数字输入不一致**
交流电滑块 step=5（App.tsx:142-144），数字框接受任意整数。输入 17 时滑块吸附到
15/20 渲染，而自绘 connector（`--node-position`）按 17 定位，节点与连线分离。
→ 数字输入 blur 时吸附到 step，或交流电滑块改 step=1。

**P1-6 时间轴刻度误导**
三个阶段滑块各有独立 min/max（电池 1–30 / 1–60 / 5–120），节点横向位置跨阶段不可比，
但连通粗线 + 箭头暗示同一时间轴。
→ 决策点：a) 统一为全局时间刻度；b) 弱化连通线，改为三段独立标尺。倾向 b，改动小且保留现有版式。

### P2 — 一致性与打磨

**P2-1 展示字体割裂**
`--display`（Noto Sans ExtraCondensed Black）只用于加载屏 h1（styles.css:499）；
主标题栏 IDLEFLOW 用 CJK 900 字重（styles.css:129），加载→主界面品牌字形跳变。
→ 主标题改用 `--display`。

**P2-2 无「放弃更改」途径**
`change-flag` 能显示「未保存」，但无法一键还原。`PolicyDraft.#saved` 现成。
→ 页脚加「重置」文字按钮，仅 `hasChanges` 时可用。

**P2-3 模式页签与行激活冗余**
左侧页签（切 profileKey）与「点击行激活」是两套并行选择手段；非激活行仍可编辑只是变淡。
→ 决策点：保留页签但让它真正切换单行视图，或保留双行常显、移除页签改为行标题。倾向后者，更报纸感。

**P2-4 交互细节不一致**
- hover 反转方向相反：保存按钮黑→白（styles.css:484），通知关闭键透明→黑（styles.css:225）；
- 加载屏「重新连接」按钮无 hover 态（styles.css:501）。
→ 统一反转方向，补齐 hover。

**P2-5 死代码**
`.stage-index` 恒 `display:none`（styles.css:352）；`statusLabel()` 是否保留取决于 P0-1
实现方式；`api.inhibited` 决议不进界面。
→ P0 落地后清理。

**P2-6 裁剪风险**
`.app-shell { overflow: hidden }`（styles.css:110）+ 固定像素布局，多行错误消息或
系统字体放大时底部保存栏可能被裁，无滚动兜底。
→ 改 `overflow-y: auto` 或让 `.policy-sheet` 独立滚动。

**P2-7 560px 断点半成品**
`.minute-field` 宽 86px 超过该断点下列宽（约 83px）会重叠；`.editorial-toggle b` 隐藏后
checkbox 失去可访问名称。Tauri `minWidth: 680` 使该断点在应用内不可达。
→ 修复（供浏览器预览）或删除断点；若保留需给 toggle 补 `aria-label`。

### P3 — 策略说明

**P3-1 仅亮色**
`color-scheme: light` 锁死（styles.css:18）。若为刻意的纸面风格，在 README 说明；
否则跟随 `prefers-color-scheme` 出深色纸面。
→ 先文档说明，深色主题另立专项。

## 任务映射

| # | 任务 | 对应问题 |
| --- | --- | --- |
| 1 | 所有权状态：观察模式提示条 + 接管 + 页脚回退 | P0-1 |
| 2 | 页脚「测试锁屏」按钮 | P0-1 / 决议 |
| 3 | 消息显式 kind，移除文案匹配 | P0-2 |
| 4 | busy 期间禁用全部编辑控件 | P0-3 |
| 5 | 阶段选中态样式 | P1-1 |
| 6 | 深色区焦点轮廓 | P1-2 |
| 7 | 对比度与字号下限 | P1-3 |
| 8 | 滑块跨引擎兼容 | P1-4 |
| 9 | 数字输入 step 对齐 | P1-5 |
| 10 | 时间轴刻度（先决策 a/b） | P1-6 |
| 11 | 主标题用 --display | P2-1 |
| 12 | 「重置为已保存」按钮 | P2-2 |
| 13 | 页签/行激活去重（先决策） | P2-3 |
| 14 | hover 一致性 | P2-4 |
| 15 | 死代码清理 | P2-5 |
| 16 | overflow 裁剪兜底 | P2-6 |
| 17 | 560px 断点修复或删除 | P2-7 |
| 18 | README 说明亮色策略 | P3-1 |
