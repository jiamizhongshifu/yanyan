---
title: Yanyan Phase 2 — 个体回归引擎 + 体检 OCR + 生产硬化
type: feat
status: active
date: 2026-05-04
deepened: 2026-05-04
origin: docs/brainstorms/2026-05-04-yanyan-tcm-inflammation-system-requirements.md
---

# Yanyan Phase 2 — 个体回归引擎 + 体检 OCR + 生产硬化

## Summary

承接 Phase 1 已 ship 的 14 unit MVP,Phase 2 用 12 周完成 **(1) 个体 Bayesian 回归引擎** 替换 PDF 群体先验为个体版 + **(2) 体检 OCR + 反例反馈** 数据扩展 + **(3) 生产级数据接入** 替换 Phase 1 占位实现(LLM、KMS、Web Push、RLS)。本 plan 是 [2026-05-04-001-feat-yanyan-h5-mvp-plan.md](2026-05-04-001-feat-yanyan-h5-mvp-plan.md) 的续作,经 ce-doc-review 一轮深化后(吸纳 35 项 finding)将 unit 数从初稿 13 减至 10,移除过早抽象(hedged-router、物化视图、puppeteer 服务端 PDF),将 ICP 备案 + 服务号备份通道延后至 Phase 3。

---

## Problem Frame

Phase 1 完成了核心日活机制(火分 + 4 tab + 次晨打卡)和 Day 30 兑现承诺(PDF v0.5 群体先验版),**但产品差异化承诺中真正的核心资产 — 个体发物清单 — 还未交付**:Phase 1 PDF 是群体先验,无法回答"哪几样食物对**这个用户**最易引发次日反应"(STRATEGY.md "Who it's for" 的核心 hire job)。同时 Phase 1 留下了若干"占位实现"(LLM stub client、KMS LocalStub、Web Push StubSender、Supabase RLS 未启用),Beta 上线前必须替换为生产实现。

origin: [docs/brainstorms/2026-05-04-yanyan-tcm-inflammation-system-requirements.md](../brainstorms/2026-05-04-yanyan-tcm-inflammation-system-requirements.md)

---

## Requirements

继承自 origin 的 R20、R20b、R21、R21b、R22、R23、R24、R25、R26、R31、R32(R33 已在 Phase 1 完成,本 plan 不再涉及)。下列 P2-R 编号是本 plan 内部编号,与 origin R 编号正交:

- **P2-R1.** 个体发物回归:用户累计 ≥ 14 天数据后,渐进显示候选发物清单 + 置信度(F4 / origin R21、R21b、AE5)
- **P2-R2.** Empirical Bayes shrinkage:个体回归向 onboarding 7 维度症状频次群体先验做加权平均(origin R22、R23 先验来源已锁)
- **P2-R3.** 环境混杂扣除:在 EB 喂入前从 fireScore 中扣除 PM2.5 / 花粉 / 季节因素(origin R20)
- **P2-R4.** Day 30 PDF 个体版:替换 v0.5 群体先验,内容 = 个体发物 top-N + 置信区间 + 30 天 Yan-Score 趋势 + 体检对照(若有)+ 免责(origin R24、R25、R26、AE6)
- **P2-R5.** 体检报告后置上传 + OCR 解析(F5 / origin R31、R32):血糖 / 尿酸 / 鼻炎相关字段
- **P2-R6.** 反例反馈通道:用户标记"我没反应 / 误识别",写回训练队列 + 速率限制(origin R23)
- **P2-R7.** R20b 周内趋势线:累计 ≥ 21 天后启用(Phase 1 已埋阈值,Phase 2 启用 UI)
- **P2-R8.** 真实 LLM + 多模态接入 + cost-monitor + 飞书告警:替换 Phase 1 占位 client(DeepSeek + 豆包 / Qwen-VL)
- **P2-R9.** 真实 Web Push 发送 + Vercel Cron 调度:替换 StubPushSender;Web Push 不可用降级到 in-app 通知兜底
- **P2-R10.** 真实 KMS 阿里云迁移 + Supabase RLS 启用:替换 Phase 1 占位实现,达到 Beta 上线安全水位

**Origin actors:** A1 中产用户;A2 中医顾问委员会(本 plan 仅 U6 反馈队列预留接口,真正接入推到 Phase 3);S3 发物回归引擎(本 plan 交付)
**Origin flows:** F4 Day 14-30→30 发物清单(本 plan U1-U4 + U7 完整交付);F5 体检报告后置上传(U5 完整交付)
**Origin acceptance examples:** AE5 个体发物候选清单 ≥ 3 项(U2 验证);AE6 30 天体质档案 PDF 个体版生成 + 分享(U4 验证)

---

## Scope Boundaries

- **不重做 Phase 1 已 ship 的火分 / 拍照 / 打卡 / 主屏架构** — Phase 2 是引擎升级 + 占位替换,不是 UI 重构
- **不接入中医顾问委员会** — 真正接入(KOL 池 / 食物分类 v2 多流派输出 / 公开审核)在 Phase 3
- **不做 native app** / 海外 / 英文版 — Phase 3 评估
- **不做反向定位自动化文案审查** — Phase 1 已实现 webhook,自动文案审查在 Phase 3
- **不上 Python 服务** — Phase 1 全 Node + TS 栈,Phase 2 EB 引擎、OCR 字段提取都用 TS 实现,保持单一技术栈
- **不切到服务端 puppeteer PDF** — Phase 1 客户端 print 模式继续,Phase 2 仅升级 `/profile/v05` 返回 shape;真正的服务端 PDF + OSS 签名 URL 推到 Phase 3 数据规模化时

### Deferred for later

(继承自 origin "Deferred for later")

- 中医顾问委员会公开运营机制
- 流派标注 / 多分类输出
- Native app
- 海外华人 / 英文版

### Outside this product's identity

(继承自 origin)

- 减肥 / 卡路里语言
- CGM / 手环硬件依赖
- 与西方循证科学权威叙事正面对抗

### Deferred to Follow-Up Work

- **微信服务号备份推送通道(原 U10)**:Phase 2 收集 Web Push 真实失败率数据后,Phase 3 立项;Phase 2 内 Web Push 失败降级到 in-app 通知兜底(成本极低,Phase 1 tracker.ts 基础设施已就绪)
- **PostgreSQL 物化视图 / ClickHouse 迁移(原 U12)**:Beta 期事件量级(~30 万行/月)用现有 SQL + PG 索引足够;dashboard P99 > 500ms 后再优化。本 plan 仅把飞书告警内联到 U8 完成
- **ICP 备案 + 阿里云域名迁移 + PIA 法务报告(原 U13)**:Vercel 海外架构与境内 ICP 备案有架构冲突 — Phase 2 维持私人 beta 邀请制(不公开发布),Phase 3 启动正式 ICP 备案 + 阿里云域名迁移;PIA 报告 Phase 3 同期产出
- **顾问委员会反例审核 UI**:本 plan U6 只交付反馈队列写入 + 误识别 fine-tune 自动化 hook;顾问委员会人工审核界面留 Phase 3
- **食物分类引擎 v2**(流派标注 + 多分类输出):本 plan 仅升级数据(LLM 派生覆盖率 + 人工 spot check 抽样从 100 → 200 个),v2 schema 改造留 Phase 3

---

## Context & Research

### Relevant Code and Patterns(Phase 1 已落地)

- **服务依赖注入模式**:`server/src/api/v1/*.ts` 全部已支持 `deps?` 注入,Phase 2 新单元沿用
- **envelope encryption**:`server/src/crypto/envelope.ts`(LocalKmsStub → 阿里云 KMS 在 U10;DEK 缓存 LRU,1h TTL,1000 capacity)
- **Yan-Score 4 Part 重分配 + null 降级**:`server/src/services/score/`(Phase 2 EB 回归输出在 SymptomPart 内消费)
- **Recommend 群体维度模式**:`server/src/services/recommend/today-list.ts` 4 模式 (`fa_heavy` / `mild_balanced` / `all_calm` / `insufficient_data`);U2 EB 输出在 `fa_heavy` 模式时替换库内 top-N 提升精度
- **Profile v0.5**:`server/src/services/profile/builder.ts`(U4 用个体版替换;data shape 兼容,新增 `faCandidates` 字段)
- **测试 Fake store 模式**:`server/tests/integration/*.ts` 现有 FakeMealStore / FakeSymptomStore / FakeClassifierStore,Phase 2 新 store 沿用 implements interface 注入
- **客户端 PDF 渲染**:`web/src/pages/ProfilePdf.tsx` `@media print` + `window.print()` Phase 1 已就绪,Phase 2 仅升级数据 shape

### Institutional Learnings

- **Round 2 review 修订**(Phase 1 已应用,Phase 2 须保持):4 Part 单 Part 重分配上限 ×2 / < 2 Part → null;滑块无默认值;multi-菜肴用标准化均值不用 max
- **plan 工期比初版扩 30%**(Phase 1 经验):Phase 2 原 8 周扩为 12 周
- **占位实现风险**:Phase 1 的 Stub / Local 占位让 ce-work 推进很顺,但 Beta 上线前必须 sweep 替换 — Phase 2 把 sweep 显式列为 U8 / U9 / U10 三个 unit
- **Vercel 函数限制**:`vercel.json` 现 `memory: 512, maxDuration: 10`;ce-doc-review 反馈服务端 puppeteer 不可行,U2 EB 重算也不能直接跑 Vercel cron — 须独立 worker

### External References

- **Empirical Bayes shrinkage**:Efron & Morris (1975) Stein's Paradox;Casella (1985) An Introduction to Empirical Bayes
- **阿里云 KMS / OCR**:阿里云开放平台官方 SDK
- **web-push library**:[npm:web-push](https://www.npmjs.com/package/web-push)(VAPID 已在 Phase 1 .env 占位)
- **Supabase RLS**:[https://supabase.com/docs/guides/auth/row-level-security](https://supabase.com/docs/guides/auth/row-level-security)

---

## Key Technical Decisions

- **EB shrinkage TS 端实现**:不上 Python micro-service。Beta 期 ~ 1k 用户 × 30 天 × 7 维度,稀疏矩阵用 Node.js 简化运算可控。alternative `frequentist Wilson score interval baseline + Phase 3 EB` 已考虑但拒绝 — Phase 2 必须交付差异化承诺
- **EB 先验来源**:onboarding 7 维度症状频次 K-means 聚类(K=5)。**关键:7 维度数据 K-means 前必须 z-score 标准化**(每维度均值 0、方差 1),否则高方差维度(如"口干")会主导距离 → 5 cluster 退化为 1 维分群(adversarial F4 finding 落地)
- **EB 数据 pipeline 跑在独立 worker / Supabase Functions,不跑 Vercel cron**(feasibility F2 落地):Vercel cron 10s 不够 90k 解密 + 矩阵运算;采用 Supabase Edge Functions(Deno runtime,无 10s 限制)或 Vercel 独立 long-running container,服务角色 bypass RLS。具体选型在 ce-work U2 阶段 spike
- **环境扣除回归**:用户级混合效应模型(每用户单独拟合 PM2.5 / pollen / season → fireScore 系数),不上全用户 pooled regression(adversarial F12 落地);用户数据不足时 fallback 到群体平均系数
- **Day 30 PDF 切换策略 + 老 PDF 版本印章**:Phase 1 客户端 print 模式继续(不切服务端 puppeteer);路由 `/api/v1/profile/v05` 保持兼容,新增 `data.faCandidates` 字段。**关键:每份 PDF 嵌入 `generatedAt` + `version: "v0.5" | "v1.0"` 字段 + 页脚版本号**,用户分享的老 PDF 在新版 PDF 中标注"基于群体先验,新版本已可用"超链接(adversarial F5 落地)
- **OCR 字段抽取 + 双重人工确认**(adversarial F6 落地):阿里云通用文字识别 + 自研字段抽取;**用户必经"原文 + 抽取数值 + 单位"三栏对照页人工确认才入库**;数值字段在 PDF 体检对照里加"OCR 抽取(已确认)"角标 + 通用医疗免责;abstraction 不做模板自适应
- **Web Push 不可用降级到 in-app 通知兜底**(scope SG-002 落地):Web Push 发送失败 / 用户未授权 → 用户下次打开应用时显示打卡提醒 banner(复用 Phase 1 tracker.ts);服务号备份通道延后到 Phase 3
- **ClickHouse vs PostgreSQL**:Phase 2 暂不上 ClickHouse 也不上物化视图(scope SG-003 落地)— Beta 期 ~30 万行/月直接 SQL + PG 索引;dashboard P99 > 500ms 时再优化
- **KMS rewrap 策略 — 加版本字段而非 dual-write**(feasibility F8 落地):
  - 在 envelope payload 加 1 byte `kms_version` prefix(0x00 = LocalKms,0x01 = AliyunKms);reader 按版本选 KMS 路径
  - 新写入直接走 AliyunKms(version=0x01);后台一次性 rewrap 脚本扫所有 v0 → 解密 → 重加密为 v1;脚本支持 checkpoint + resume + dry-run
  - 30 天硬删 sweep 与 rewrap 的竞态:rewrap job 在 SELECT 时加 `WHERE deleted_at IS NULL`,删除 job 之后再扫一次清残留
- **RLS 选型 — 切 Supabase JS client**(feasibility F3 落地):放弃 raw `pg` + `SET LOCAL`(每查询包裹太脆),全量切到 Supabase JS client;client 自动注入 JWT 让 RLS 的 `auth.uid()` 工作。`X-User-Id` DevHeader 仅 NODE_ENV=test 启用;tests 改用 Supabase test client + 注入 service-role token
- **U8 LLM fallback — 顺序而非并发 hedged**(scope SG-001 落地):Beta 1k 用户量级用 try-DeepSeek → catch fallback Qwen 顺序调用即可;不引入 hedged-router 抽象层

---

## Open Questions

### Resolved During Planning

- **个体回归算法选型**:Empirical Bayes shrinkage,先验聚类来自 onboarding 7 维度(已锁,Phase 1 origin)
- **OCR 引擎**:阿里云通用文字识别 + 自研字段抽取(已锁)
- **PDF 引擎**:客户端 `window.print()` 继续(不切服务端 puppeteer)
- **EB 数据 pipeline 运行环境**:独立 worker / Supabase Edge Functions,不跑 Vercel cron(架构决策上面)
- **ICP / 海外架构冲突**:Phase 2 维持私人 beta 邀请制,正式 ICP 推 Phase 3
- **服务号备份通道**:Phase 2 不做,Web Push 失败降级 in-app 通知

### Deferred to Implementation

**(常规 implementation-time 调优)**

- **EB shrinkage 数值稳定性**:稀疏数据下 α 因子边界(食物只吃过 1 次时不可信),具体阈值在 ce-work U2 调优
- **K-means 聚类 K 值**:plan 假设 K=5,真实数据上 elbow / silhouette 可能微调到 4-7,U1 实施时确定;K 调整时所有 fa_candidates 触发 cluster_id 重映射 + lazy 重算
- **OCR 字段抽取召回率底线**:实现时跑 50 份真实体检报告 spot check,验证标准是"用户人工确认率 ≥ 95%"(不是数值召回率)
- **EB worker 选型 spike**:U2 起步前 1 周 spike Supabase Edge Functions vs Vercel container,选 latency / 成本 / 部署成本最低的
- **Vercel Cron 跨时区调度细节**:Phase 1 用户首批集中华东,可单时区开始

**(adversarial findings → 需要 ce-work 阶段决策的策略)**

- **EB 对抗用户防御**(adversarial F1):症状方差 < 阈值(单调高 / 单调低)用户的 candidates 是否标 `low_confidence`?是否引入 onboarding 重测在 Day 14 / Day 30 校准?ce-work U2 阶段决策
- **食物分类漂移历史回填**(adversarial F2):classifier spot-check 修订一个食物时,该食物的历史 fireScore 是否 batch 重算?Phase 2 第一个版本可以接受 silent drift + 加审计 log,Phase 3 顾问会上线时引入正式版本号
- **U6 反馈速率限制**(adversarial F7):同一用户 24h 内 misrecognized 反馈 > 5 条 触发 review queue + flag suspicious;同一 meal-item 同一用户重复 upsert(不累计降权)
- **EB 正确性验证**(adversarial F14):Beta 启动前找 5-10 个 sample 用户跑 EB,人工抽样验证 top-3 候选是否符合用户主观印象;对比 Phase 1 群体先验 baseline,A/B PDF 满意度

---

## Output Structure

```
server/
├── src/
│   ├── services/
│   │   ├── regression/         # U1 + U2 + U3 (新增)
│   │   │   ├── prior.ts        # K-means 群体先验(z-score 标准化)
│   │   │   ├── eb-shrinkage.ts # 个体 EB 回归
│   │   │   ├── env-confound.ts # 用户级环境扣除(每用户单独拟合)
│   │   │   ├── store.ts        # fa_candidates 表读写
│   │   │   └── index.ts
│   │   ├── ocr/                # U5 (新增)
│   │   │   ├── aliyun-client.ts
│   │   │   ├── checkup-extract.ts
│   │   │   └── index.ts
│   │   ├── feedback/           # U6 (新增,含 rate-limit)
│   │   │   ├── store.ts
│   │   │   └── index.ts
│   │   ├── push/               # U9 (Phase 1 占位 → 真实)
│   │   │   ├── web-push-sender.ts
│   │   │   └── inapp-fallback.ts  # Web Push 失败降级
│   │   ├── llm/                # U8 (Phase 1 占位 → 真实)
│   │   │   ├── deepseek.ts     # 真实 SDK
│   │   │   ├── doubao-vision.ts
│   │   │   └── cost-monitor.ts # token 计数 + 飞书告警
│   │   ├── kms/                # U10 (LocalStub → AliyunKms)
│   │   │   └── aliyun.ts
│   │   └── alerting/           # U8 内联交付
│   │       └── feishu.ts
│   ├── api/v1/
│   │   ├── candidates.ts       # GET /candidates/me (U7)
│   │   ├── checkup.ts          # POST /checkup/upload (U5)
│   │   └── feedback.ts         # POST /feedback (U6)
│   ├── workers/                # 独立 worker / Supabase Functions (U1 + U2)
│   │   ├── prior-refresh.ts
│   │   └── candidates-recompute.ts
│   ├── api/cron/               # Vercel Cron (U9)
│   │   └── morning-checkin-reminder.ts
│   ├── scripts/
│   │   └── kms-rewrap.ts       # U10 一次性 rewrap (checkpoint + resume)
│   └── db/
│       ├── migrations/         # U1-U6 + U10 schema 升级
│       │   ├── 002_fa_candidates_and_priors.sql
│       │   ├── 003_checkup_reports.sql
│       │   ├── 004_feedback.sql
│       │   └── 005_kms_version_byte.sql
│       └── policies/           # U10 RLS
│           └── rls.sql

web/
├── src/
│   ├── pages/
│   │   ├── Findings.tsx        # 修改:渐进展示 fa_candidates (U7)
│   │   ├── ProfilePdf.tsx      # 修改:接收 faCandidates + 版本印章 (U4)
│   │   ├── CheckupUpload.tsx   # 新增 (U5)
│   │   └── MealResult.tsx      # 修改:加"我没反应 / 误识别"按钮 (U6)
│   ├── services/
│   │   ├── candidates.ts
│   │   ├── checkup.ts
│   │   └── feedback.ts
│   └── components/
│       └── CandidatesCard.tsx
```

---

## High-Level Technical Design

> *本节仅说明 EB pipeline 数据流,帮助 reviewer 验证 U1 + U2 + U3 的依赖方向。代码细节 ce-work 阶段决定。*

```
[Phase 1 已 ship]                      [Phase 2 新增]                     [输出]
                                        │
onboarding 7-dim symptoms ──┐           │
                            ├─→ U1 prior.ts (z-score → K-means K=5)──→ cluster_priors 表
users.cluster_id ───────────┘           │                                    │
                                        │                                    ↓
[每用户每日 lazy-on-demand 触发]        │                              cluster_id +
                                        │                              group_prior_means
meals.recognized_items_ciphertext       │
  → envelope decrypt (U10 KMS) ─────────┤
                                        │                                    │
symptoms (Phase 1 已存) ────────────────┤                                    │
fireScore (per meal, Phase 1 已存)──┐   │                                    │
env_snapshots (Phase 1 已存)────────┼──→ U3 env-confound.ts                 │
                                    │   (每用户单独拟合系数,残差输出)──┐  │
                                    │                                     ↓  ↓
                                    └──→ U2 eb-shrinkage.ts ←──── 拼接为输入
                                          │
                                          ├─ shrinkage α = group_var /
                                          │   (group_var + individual_var/n)
                                          ├─ posterior_mean = α × group_prior +
                                          │   (1-α) × individual_mean
                                          │
                                          └──→ fa_candidates 表
                                              (per user × food, 含 cluster_id +
                                               kms_version + computed_at)
                                                  │
                                                  ├──→ U4 PDF 个体版
                                                  ├──→ U7 Findings 渐进卡
                                                  └──→ U8 recommend.fa_heavy 注入
```

---

## Implementation Units

- U1. **群体先验聚类(K-means + z-score 标准化)**

**Goal:** 基于 Phase 1 onboarding 7 维度症状频次,跑 K-means 聚类(K=5)得到群体先验 cluster + 每 cluster 的"食物 fa 计数 → 次日 7 维度症状均值"矩阵,作为 U2 EB shrinkage 的先验。

**Requirements:** P2-R2

**Dependencies:** Phase 1 ship(U4 onboarding 数据已收集)

**Files:**
- Create: `server/src/services/regression/prior.ts`
- Create: `server/src/services/regression/store.ts`
- Create: `server/src/db/migrations/002_fa_candidates_and_priors.sql`(`onboarding_clusters` + `cluster_priors` 表)
- Create: `server/src/workers/prior-refresh.ts`(每周 trigger;非 Vercel cron)
- Test: `server/tests/integration/prior.test.ts`

**Approach:**
- **z-score 标准化**:7 维度先按全体用户均值/标准差标准化,再喂 K-means(防高方差维度主导分群)
- K-means K=5,silhouette / elbow 验证;ce-work 实施时若 silhouette < 0.3 则微调到 4-7
- 群体先验 = 同 cluster 用户的「食物 fa 计数 → 次日 7 维度症状均值」均值
- 持久化在 `cluster_priors` 表,每周 worker refresh
- K 值或聚类算法变更时,所有 `fa_candidates.cluster_id` 触发 lazy 重算(下次该用户 candidates-recompute 时刷新)

**Patterns to follow:** `server/src/services/score/parts.ts`(纯函数 + 注入 store 模式)

**Test scenarios:**
- Happy path: 100 个 mock 用户 7 维度有明显 5 cluster → K-means 收敛 + cluster_priors 行数 = 5
- Edge: 7 维度中一个维度方差极高(其他维度无差) → z-score 标准化后聚类不被该维度主导(每个 cluster 在多维度有可解释差异)
- Edge: 用户数 < K → 降级为 K=用户数
- Edge: onboarding 数据为空 → cluster_priors 为空,U2 EB 走纯个体(α=0)
- Integration: prior-refresh worker 跑完后,U2 EB 调用 store.getClusterPriors() 拿到对应 cluster

**Verification:** silhouette > 0.3;**5 个 cluster 在至少 3 个维度上有可解释差异**(z-score 标准化后);每周 refresh 1 次成功执行

---

- U2. **个体 Empirical Bayes shrinkage 回归引擎**

**Goal:** 用户累计 ≥ 14 天数据后,对每个食物计算"该食物 → 次晨症状反应"的个体后验估计,shrinkage 向 U1 群体先验加权;输出候选发物清单 + 置信区间。

**Requirements:** P2-R1, P2-R2, AE5

**Dependencies:** U1, U3, Phase 1(meals + symptoms + 食物分类 envelope decryption)

**Files:**
- Create: `server/src/services/regression/eb-shrinkage.ts`
- Create: `server/src/services/regression/types.ts`
- Modify: `server/src/services/regression/store.ts`(加 `fa_candidates` 表读写)
- Modify: `server/src/db/migrations/002_fa_candidates_and_priors.sql`(`fa_candidates` 表:user_id / food_canonical_name / posterior_mean / posterior_variance / sample_n / cluster_id / kms_version / confidence_flag / computed_at)
- Create: `server/src/workers/candidates-recompute.ts`(独立 worker;lazy on user 上线)
- Test: `server/tests/integration/eb-shrinkage.test.ts`

**Approach:**
- **运行环境:独立 worker / Supabase Edge Functions(不是 Vercel cron)** — 90k 解密超 Vercel 10s 限制;具体平台 ce-work 起步 1 周 spike 决定
- 步骤 0:调 U3 `env-confound.residuals(fireScore, env, userId)` 拿环境扣除残差(P2-R3 数据流)
- 步骤 1:解密用户 30 天 meals.recognized_items_ciphertext → 食物名 list;**解密失败分类处理**:
  - GCM auth fail / corrupted → skip + audit log
  - KMS transient / 5xx → abort 整个 recompute,1 小时后重试
  - KMS revoked DEK → 标记该 user `not_eligible` 并记录日志
- 步骤 2:join 用户 30 天 symptoms(用 U3 残差)→ 计算每食物的"吃过当晚 / 吃过次晨症状"原始均值
- 步骤 3:shrinkage 因子 α = group_var / (group_var + individual_var/n);n 越大越偏个体
- 步骤 4:输出 posterior_mean / posterior_variance + `confidence_flag`(adversarial F1 防御):
  - `confidence_flag = low` 当 用户症状方差 < 阈值(总报 0 / 总报 7,可能数据不可信)
  - `confidence_flag = ok` 否则
- 候选清单 = posterior_mean > 阈值 且 posterior_variance < 阈值 且 confidence_flag=ok 的 top-N
- N 渐进:Day 14 ≤ 3、Day 21 ≤ 5、Day 30 ≤ 7

**Execution note:** 数值稳定性是这个 unit 的最大风险 — 写测试时优先 fixture 里造稀疏 / 极端 / 对抗样本(n=1, n=0, all 发, all 平, 单调高/低症状),验证 shrinkage 因子边界与 confidence_flag 行为。

**Patterns to follow:** `server/src/services/score/aggregator.ts`(纯函数 + 极端 case 测试覆盖)

**Test scenarios:**
- Happy: 用户 30 天吃过 5 次海鲜每次次晨鼻塞均值 4 → posterior_mean ≈ 4 减一点 shrinkage,候选清单 top1 = 海鲜
- Edge: n=1 食物 → α 接近 1,后验 ≈ 群体先验
- Edge: 全部食物都"无反应" → 候选清单为空 + confidence_flag low
- Edge: 用户 < 14 天 → 直接返回 not_eligible
- Edge: 群体先验缺失(cluster_priors 为空)→ α=0,纯个体均值
- Edge: 用户单调高症状(7 dim 均 6-7)→ confidence_flag=low + 候选清单为空
- Edge: 用户单调低症状(7 dim 均 0)→ confidence_flag=low
- Error: GCM auth fail → skip 该 meal + audit
- Error: KMS 5xx → abort + 1h retry
- Error: KMS revoked → mark not_eligible
- Integration: U4 PDF 读 fa_candidates;U7 Findings card 读 fa_candidates

**Verification:** 累计 ≥ 14 天用户中 ≥ 60% 有 ≥ 3 项候选;Day 30 用户中 ≥ 80% 满足 AE5;**人工 spot check 5-10 个 sample 用户的 top-3 候选与主观印象吻合 ≥ 70%**(adversarial F14 落地)

---

- U3. **环境混杂扣除 — 用户级混合效应**

**Goal:** 在 EB 喂入数据前,从用户 fireScore 中扣除 PM2.5 / 花粉 / 季节因素;输出"扣除环境后的纯食物影响"作为 U2 EB 输入。

**Requirements:** P2-R3

**Dependencies:** Phase 1(U9 env_snapshots)

**Files:**
- Create: `server/src/services/regression/env-confound.ts`
- Test: `server/tests/integration/env-confound.test.ts`

**Approach:**
- **用户级单独拟合**(不上 pooled 全用户回归 — adversarial F12 落地):每用户单独拟合 `fireScore ~ pm25 + pollenLevel(one-hot)+ season(one-hot)`,残差 = fireScore − 拟合值
- 用户数据不足(< 30 个观测)→ fallback 到群体平均系数(预先用所有满足数据量用户拟合一次)
- env_snapshots 表 join 用户 city_code + ate_at 当日数据;无环境数据时 fallback fireScore 原值,U2 标记 `confound_adjusted=false`
- 系数每用户每周一次随 prior-refresh worker 重训练 + 持久化

**Patterns to follow:** `server/src/services/score/parts.ts`(env score 已经加权,这里是反向扣除)

**Test scenarios:**
- Happy: 高 PM2.5 日 fireScore 偏高 → 用户系数扣除 PM2.5 影响,残差 ≈ 食物纯影响
- Edge: 用户 < 30 观测 → 用群体平均系数
- Edge: env_snapshots 缺失 → fallback fireScore 原值,confound_adjusted=false
- Integration: U2 EB 用残差作为输入时 posterior_mean 与不扣除时差异 > 5%

**Verification:** 全量用户中 ≥ 70% 有合格用户级模型(≥ 30 观测);用户级 R² 中位数 > 0.15

---

- U4. **Day 30 PDF 个体版替换 v0.5(客户端 print 模式)**

**Goal:** 升级 Phase 1 已 ship 的客户端 PDF 路由,把群体先验替换为个体 Bayesian:个体候选发物 top-N + 置信区间 + 体检对照(若上传)+ 30 天 Yan-Score 趋势 + 版本印章。**保持客户端 `window.print()` 渲染**,不切服务端 puppeteer。

**Requirements:** P2-R4, R26, AE6

**Dependencies:** U2(必需);U5(可选 — 体检对照仅当用户已上传时显示)

**Files:**
- Modify: `server/src/services/profile/types.ts`(加 `faCandidates: { name, posteriorMean, posteriorVariance, confidence }[]`、`checkupSummary` 实数据、`version: "v0.5" | "v1.0"`、`generatedAt`)
- Modify: `server/src/services/profile/builder.ts`(eligible 时优先读 fa_candidates,空则回退 commonFaFoods 兼容;v1.0 = 有候选,v0.5 = 退回群体先验)
- Modify: `web/src/pages/ProfilePdf.tsx`(渲染个体字段;有 checkupSummary 时显示对照;**页脚加版本印章 + generatedAt**)
- Modify: `web/src/services/profile.ts`(类型升级)
- Test: 修改 `server/tests/integration/profile.test.ts` + `web/src/__tests__/profile-flow.test.tsx`

**Approach:**
- 路由 `/api/v1/profile/v05` 不改名(避免前端断裂),返回 shape 升级
- `data.commonFaFoods` 字段保留(向后兼容);新增 `data.faCandidates` 字段,前端优先渲染后者
- **PDF 页脚版本印章**(adversarial F5 落地):嵌入 "Yanyan 30 天体质档案 · v1.0 · 生成于 YYYY-MM-DD"。如果用户既往生成过 v0.5,在 Findings 页加 banner "你的 v0.5 档案已升级到个体版,点击重新生成"
- 命名占位 `<<体质档案命名占位>>` → 默认 "30 天体质档案"(去掉 v0.5)

**Patterns to follow:** `server/src/services/profile/builder.ts`(Phase 1 v0.5 builder)

**Test scenarios:**
- Happy: 用户 30 天 + 候选清单 5 项 → PDF 个体字段 5 项 + posterior 区间渲染 + 版本印章 v1.0
- Edge: 候选清单为空(EB 所有候选 < 阈值 / confidence low)→ 退回群体先验展示 + 提示"个体规律仍在累积"+ 版本印章 v0.5
- Edge: 用户上传过体检 → checkupSummary 渲染对照表 + "OCR 抽取(已确认)"角标
- Edge: 用户没上传体检 → checkupSummary section 不渲染
- Integration: Phase 1 v0.5 用户在 Phase 2 上线后访问 /profile-pdf → 字段自动升级,无 client crash

**Verification:** 30 天用户 PDF 含个体候选 + 置信区间 + 版本印章;v0.5 → v1.0 切换无 client 断裂;5-10 个 sample 用户主观满意度 ≥ 70%

---

- U5. **体检报告 OCR 上传 + 字段抽取 + 双重人工确认**

**Goal:** 用户在「我的 → 上传体检报告」上传 PDF/JPG,服务端调阿里云通用文字识别 + 自研字段抽取,提取空腹血糖 / 尿酸 / 总胆固醇 / 鼻炎相关字段;**用户必经"原文 + 抽取数值 + 单位"三栏对照页人工确认**才入库,U4 PDF 对照消费。

**Requirements:** P2-R5, F5

**Dependencies:** Phase 1(U3 同意拦截 — `medical_report` scope 已在 consent_scopes 内)

**Files:**
- Create: `server/src/services/ocr/aliyun-client.ts`
- Create: `server/src/services/ocr/checkup-extract.ts`(关键字 + 单位 + 数值正则)
- Create: `server/src/services/ocr/index.ts`
- Create: `server/src/api/v1/checkup.ts`(POST `/checkup/upload`、POST `/checkup/confirm`、GET `/checkup/latest`)
- Create: `server/src/db/migrations/003_checkup_reports.sql`(`checkup_reports` 表 + envelope encryption ciphertext 字段)
- Modify: `server/src/services/consents/store.ts`(hardDelete 加 checkup_reports 级联)
- Create: `web/src/pages/CheckupUpload.tsx`、`web/src/services/checkup.ts`
- Modify: `web/src/pages/Me.tsx`(替换 alert 为真实跳转 /checkup-upload)
- Test: `server/tests/integration/checkup.test.ts`、`web/src/__tests__/checkup-flow.test.tsx`

**Approach:**
- 上传走 Supabase Storage `checkup-reports` bucket → 服务端拿 OSS URL 调 OCR
- OCR 返回原始 raw text → checkup-extract.ts 用关键字 + 数值正则提取(含单位:mmol/L / μmol/L / mg/L)
- **双重确认 UX**(adversarial F6 落地):用户必看一次"原文截图 + 抽取数值 + 单位"三栏对照页;每个数值都是 input field 默认填充抽取值,用户可改;数值未确认无法提交
- 用户确认后,raw_text 加密存(envelope)+ 抽取字段密文存(envelope)+ 用户确认后字段明文存(无个人识别力的数值)
- 同意 scope `medical_report` 必须已 granted
- 通用医疗免责文案在 CheckupUpload 页底部 + PDF 体检对照区底部双重显示

**Patterns to follow:** `server/src/services/meals/aggregator.ts`(envelope encryption pattern);`web/src/pages/Camera.tsx`(文件上传 UI pattern)

**Test scenarios:**
- Happy: 上传含"空腹血糖 6.2 mmol/L"的体检报告 → 抽取字段空腹血糖 = 6.2 + 单位 mmol/L → 用户确认页可见 → 确认后入库
- Happy: 上传后用户在确认页修正错误数值 → 修正后入库 + flag user_corrected=true
- Edge: OCR 抽取小数点错误(6.2 → 62)→ 用户确认页强制看到原文截图 + 抽取数值,可改;未改 / 改成 6.2 / 不确认 三种路径都覆盖
- Edge: OCR 失败 → 用户友好降级"识别失败,请手动输入主要指标"(纯输入路径)
- Edge: 用户未同意 medical_report scope → 403 + 引导回到同意流程
- Edge: 字段缺失(只识别出尿酸,没识别出血糖)→ 用户可只确认抽取到的部分
- Error: 文件 > 10MB → 400 + "请压缩到 10MB 内"
- Integration: 上传 + 确认成功 → U4 PDF 对照页消费

**Verification:** 50 份真实体检 spot check 抽取字段呈现率 ≥ 80%(数值正确性由用户确认 page 兜底);**用户人工确认率 = 100%(所有入库数据都经过用户 confirm)**;0 起小数点误读到生产数据库

---

- U6. **反例反馈通道(我没反应 / 误识别)+ 速率限制**

**Goal:** 在 Phase 1 ship 的 MealResult 页加"我没反应 / 误识别"按钮,反馈写入 feedback 表 + 事件入队列,U2 EB 计算时把"用户标记无反应"作为反向证据降权。**加 24h rate limit 防对抗操作**。

**Requirements:** P2-R6, origin R23

**Dependencies:** Phase 1(MealResult、symptoms);U2(消费反馈数据)

**Files:**
- Create: `server/src/services/feedback/store.ts`
- Create: `server/src/services/feedback/index.ts`
- Create: `server/src/api/v1/feedback.ts`(POST `/feedback`)
- Modify: `server/src/services/regression/eb-shrinkage.ts`(读 feedback,标记 misrecognized 食物从样本剔除,标记 no_reaction 食物降权)
- Create: `server/src/db/migrations/004_feedback.sql`(独立 feedback 表)
- Modify: `web/src/pages/MealResult.tsx`(加"我没反应 / 误识别"按钮)
- Create: `web/src/services/feedback.ts`
- Test: `server/tests/integration/feedback.test.ts`、修改 `web/src/__tests__/meals-flow.test.tsx`

**Approach:**
- feedback 表 schema:user_id / meal_id / item_name / kind('no_reaction' | 'misrecognized') / created_at
- POST /feedback 鉴权 + zod 校验
- **速率限制**(adversarial F7 落地):同一用户 24h 内 misrecognized 反馈 > 5 条 → 触发 review queue + flag suspicious + 当次 reject;同一 (user, meal_id, item_name) 重复反馈 = upsert(不累计降权)
- U2 EB 在跑 candidates-recompute 时 LEFT JOIN feedback,no_reaction 在 individual_var 上 ×0.5(降权),misrecognized 标记 `excluded_from_eb=true` 但仍在数据库内(供 Phase 3 顾问审核)
- UI 在 MealResult 列出识别条目旁边,每条加双按钮

**Patterns to follow:** Phase 1 `meals.feedback` JSONB 字段;U6 MealResult 渲染 pattern;Phase 1 tracker.ts 速率限制思路

**Test scenarios:**
- Happy: 用户在 MealResult 标记"虾 — 我没反应" → POST /feedback → DB 写入
- Happy: U2 EB 计算时虾 no_reaction 样本被降权,virtual posterior_mean 下降
- Edge: 用户对同一 meal-item 重复标记 → upsert,不重复降权
- Edge: 24h 内 misrecognized > 5 → 第 6 条返回 429 + flag user as suspicious
- Error: meal_id 不属于该用户 → 403
- Integration: misrecognized 标记触发"已记录,待人工审核"toast(Phase 3 顾问会上线后真审核)

**Verification:** 反馈写入率 ≥ 5%(用户活跃中);no_reaction 反馈在 EB 重算后影响候选清单;suspicious flag 在 dashboard 可见

---

- U7. **R20b 周内趋势线启用 + Findings 渐进展示候选**

**Goal:** Phase 1 已埋的 R20b 阈值(累计 ≥ 21 天 canDrawTrend=true)启用 — Home / Findings 页消费 **U2 生成的** 候选发物清单 + 周内 Yan-Score 趋势线;本 unit 只做 UI gating(Day 14 起 1-3 项 → Day 30 满 7 项),**不生成清单**(生成在 U2)。

**Requirements:** P2-R7, origin R20b、R21、R21b

**Dependencies:** U2,Phase 1(progress 阈值已实装)

**Files:**
- Create: `web/src/components/CandidatesCard.tsx`
- Create: `web/src/services/candidates.ts`
- Create: `server/src/api/v1/candidates.ts`(GET `/candidates/me`)
- Modify: `web/src/pages/Findings.tsx`(累计 ≥ 14 天显示 CandidatesCard)
- Modify: `web/src/pages/Home.tsx`(火分卡片下方加 21 天后的周趋势线 mini chart)
- Test: `server/tests/integration/candidates.test.ts`、修改 `web/src/__tests__/home-flow.test.tsx`

**Approach:**
- 阈值梯度由 U2 输出 + 本 unit UI gate 共同决定:Day 14-20 显示 ≤ 3 项 + "继续记录可解锁更多"提示;Day 21-29 显示 ≤ 5 项;Day 30+ 显示 ≤ 7 项
- 周趋势线 = 过去 7 天每日 fireScore 平均(Phase 1 yan-score-daily 字段已就绪)
- /candidates/me 直接读 fa_candidates 表 top-N order by posterior_mean DESC + WHERE confidence_flag='ok'
- confidence_flag=low 用户 → 显示"个体规律仍在累积,建议保持记录"

**Patterns to follow:** `web/src/components/TodayFireCard.tsx`、`web/src/services/home.ts`

**Test scenarios:**
- Happy: Day 14 用户 → 显示 1-3 项候选 + 解锁提示
- Happy: Day 30 用户 → 显示满 7 项 + 完整置信区间
- Edge: Day 13 用户 → CandidatesCard 不渲染(Findings 显示 Phase 1 进度卡)
- Edge: U2 返回 confidence_flag=low → 显示"规律累积中"
- Integration: Home 周趋势线 21 天阈值 toggle

**Verification:** 候选清单生成率 ≥ 60%(满 14 天用户中);21 天用户 Home 趋势线可见

---

- U8. **真实 LLM 接入(DeepSeek + 豆包多模态)+ cost-monitor + 飞书告警**

**Goal:** 替换 Phase 1 stub LLM client 为真实 SDK:DeepSeek 接食物分类派生 / 推荐文案 / PDF 摘要,豆包多模态接拍照识别。**顺序 fallback(不上 hedged-router 抽象)**;cost-monitor + 飞书告警内联交付。

**Requirements:** P2-R8

**Dependencies:** Phase 1(U5 LLM 派生 + U6 拍照识别 stub 已就绪)

**Files:**
- Modify: `server/src/services/llm/deepseek.ts`(替换 stub 为真实 fetch / Anthropic 兼容 endpoint)
- Create: `server/src/services/llm/doubao-vision.ts`(+ Qwen-VL 顺序 fallback)
- Create: `server/src/services/llm/cost-monitor.ts`(token 计数 + 月度 budget + 飞书告警)
- Create: `server/src/services/alerting/feishu.ts`(替换 Phase 1 webhook 占位)
- Modify: `server/src/services/classifier/llm-deriver.ts`(替换 stub call)
- Modify: `server/src/api/v1/events.ts`(weight loss > 30% alert 真实发飞书)
- Test: `server/tests/integration/llm-real.test.ts`、`server/tests/integration/feishu-alerting.test.ts`

**Approach:**
- DeepSeek 用 Anthropic-compatible endpoint(Phase 1 .env.example 已写)
- 豆包视觉用火山引擎 API + 备用 Qwen-VL **顺序** fallback(失败 → 调备用)
- cost-monitor 每次调用累计 token,日 / 月预算超 80% → 飞书告警 + 服务降级到"识别失败,请重拍"
- 飞书告警:weight loss > 30% / LLM 月度成本超 80% / push 失败率超 30% / EB candidates 生成率 < 50%

**Patterns to follow:** `server/src/services/recognition/index.ts`(Phase 1 stub interface);`server/src/services/analytics/store.ts`(查询 pattern)

**Test scenarios:**
- Happy: DeepSeek 返回成功 → classifier 拿到分类
- Happy: DeepSeek 失败 → 调豆包成功 → 用豆包结果(顺序 fallback)
- Edge: 都失败 → 返回 unrecognized + 进 backfill 队列
- Edge: 月度 budget 超限 → 降级 + 飞书告警
- Error: rate limit 429 → 指数退避重试 3 次
- Integration: U5 classifier 真实跑通,典籍引用字段非空率 ≥ 95%
- Integration: weight loss > 30% 触发 → 飞书机器人收到消息(staging webhook)

**Verification:** Beta 期 LLM 调用 P99 < 4s(顺序 fallback 比 hedged 慢一点,可接受);识别准确率 ≥ 85%(spot check 50 张);成本日均 < $50;飞书告警阈值触发后 < 1 分钟到机器人

---

- U9. **真实 Web Push 发送 + Vercel Cron + in-app 通知降级**

**Goal:** 接入 web-push library 真实发送 + Vercel Cron 每日早晨触发次晨打卡推送。**Web Push 失败/不可用降级到 in-app 通知**(用户下次打开应用时显示打卡提醒);服务号备份通道延后到 Phase 3。

**Requirements:** P2-R9

**Dependencies:** Phase 1(U11 push_subscriptions + StubPushSender 已就绪)

**Files:**
- Create: `server/src/services/push/web-push-sender.ts`(npm:web-push lib)
- Create: `server/src/services/push/inapp-fallback.ts`(失败 / 未授权用户写 in-app 提醒队列)
- Modify: `server/src/services/push/index.ts`(默认 sender 切到 WebPushSender + fallback)
- Create: `server/api/cron/morning-checkin-reminder.ts`(Vercel Cron 入口)
- Modify: `vercel.json`(补 cron schedule + maxDuration 升到 60s)
- Modify: `web/src/pages/Home.tsx`(显示 in-app 提醒 banner 当队列里有未读)
- Create: `server/src/db/migrations/006_inapp_reminders.sql`(`inapp_reminders` 表)
- Test: `server/tests/integration/push-sender.test.ts`、修改 `web/src/__tests__/home-flow.test.tsx`

**Approach:**
- WebPushSender 用 web-push lib + VAPID 密钥(.env.example 已占位)
- Vercel Cron route `/api/cron/morning-checkin-reminder` 每日 23:00 UTC(北京 07:00)— **vercel.json maxDuration 升到 60s**
- 找出昨日有餐食 + 今日未打卡 + push 已订阅的用户 → **并发 send(Promise.all 限并发 20)**;100 用户 ~ 5s 完成
- 410 Gone / 404 → store.removeByEndpoint 清理失效订阅
- 失败 / 未订阅 / iOS 不支持 → 写 inapp_reminders 队列;用户下次进 / 时显示 banner "今天的次晨打卡还没做哦"

**Patterns to follow:** Phase 1 `services/push/index.ts` sendToUser 函数;Phase 1 tracker.ts 离线队列模式

**Test scenarios:**
- Happy: 100 个订阅用户 batch send → 成功率 ≥ 95%
- Edge: 410 Gone → 自动 removeByEndpoint
- Edge: 用户已打卡今日 → 跳过不发
- Edge: 用户未授权 push → 写 inapp_reminders → 下次进首页可见 banner
- Edge: iOS Safari < 16.4 用户 → 走 inapp_reminders 路径
- Error: web-push 库抛 5xx → 重试 1 次后写 inapp_reminders
- Integration: cron 真实在 Vercel staging 触发

**Verification:** Beta 期推送 + in-app 总触达率 ≥ 80%(Web Push ≥ 60% + in-app 兜底剩余);Vercel Cron 7 天稳定无漏跑

---

- U10. **真实 KMS 阿里云迁移 + Supabase RLS 启用 + 切 Supabase JS client**

**Goal:** Phase 1 envelope encryption 用 LocalKmsStub,Beta 上线前迁阿里云 KMS;Supabase 当前用 `X-User-Id` DevHeader(测试桩),Phase 2 启用 RLS + **全量切到 Supabase JS client**(让 RLS 的 `auth.uid()` 工作)。

**Requirements:** P2-R10

**Dependencies:** Phase 1(envelope.ts + auth/middleware.ts 已就绪)

**Files:**
- Create: `server/src/services/kms/aliyun.ts`(`@alicloud/kms20160120` SDK)
- Modify: `server/src/crypto/envelope.ts`(KMS 模式从 local → aliyun;**envelope payload 加 1 byte `kms_version` prefix**;reader 按版本选 KMS 路径)
- Modify: `server/src/db/migrations/005_kms_version_byte.sql`(无 schema 变更,文档化 envelope 格式)
- Modify: `server/.env.example`(KMS_KEY_ID 必填、KMS_LOCAL_MASTER_KEY 标 deprecated)
- Create: `server/src/scripts/kms-rewrap.ts`(一次性 rewrap;**checkpoint + resume + dry-run** + `WHERE deleted_at IS NULL` 过滤)
- Create: `server/src/db/policies/rls.sql`(全表 RLS:users / meals / symptoms / push_subscriptions / checkup_reports / fa_candidates / feedback / inapp_reminders)
- Create: `server/src/db/migrations/007_enable_rls.sql`
- **大改:全量切 Supabase JS client**(替换 raw `pg`):
  - Modify: `server/src/db/client.ts`(导出 Supabase client + service-role client)
  - Modify: `server/src/services/*/store.ts`(查询从 `pg.query` 切到 `supabase.from(...).select()`)
  - Modify: `server/src/auth/dev-header.ts`(NODE_ENV=test 才启用)
  - Modify: `server/src/auth/index.ts`(JWT-only path,移除 production DevHeader fallback)
  - Modify: `server/tests/integration/*.ts`(从 X-User-Id header 切到 Supabase test client + service-role token 注入)
- Test: `server/tests/integration/rls.test.ts`(用 Supabase test client 验证跨用户读写被拒)、`server/tests/integration/kms-rewrap.test.ts`

**Approach:**
- 阿里云 KMS:GenerateDataKey 拿 plain DEK + envelope cipher;Decrypt envelope cipher 拿回 DEK;LRU cache 保留
- **envelope 版本字节策略**(替代 dual-write):envelope payload 第一字节 = `kms_version`(0x00 LocalKms / 0x01 AliyunKms);reader 按 byte 选 KMS;新写入直接走 0x01;rewrap 脚本扫所有 0x00 → 解密 → 0x01 重加密 → 更新 row
- rewrap 脚本:checkpoint table + resume + dry-run;每 1000 行 commit;`WHERE deleted_at IS NULL` 防与硬删 sweep 竞态;`SELECT FOR UPDATE` 单行锁
- RLS:`policy users_select USING (id = auth.uid())`、`policy meals_all USING (user_id = auth.uid())` 等;service-role 通过 supabase 内置角色 bypass 用于 worker
- DevHeader 仅 NODE_ENV=test 启用,production 启动时拒绝并记日志
- 切 Supabase JS client 工作量大:Phase 1 全部 store 都要改,但是是 mechanical refactor;tests 用 service-role + 注入 user_id 模拟 auth.uid()

**Execution note:** 切 Supabase client 是 Phase 2 单 unit 最大代码改动,建议 ce-work 起步先做 1 个 store 的 spike,验证测试套件能通过后再批量重构。

**Patterns to follow:** Phase 1 envelope.ts AAD 绑定 user_id 的设计;Supabase 官方 RLS docs

**Test scenarios:**
- Happy: 阿里云 KMS encrypt → decrypt 圆环
- Happy: rewrap 脚本 dry-run 跑通 + apply 跑通 + 全部 0x00 转 0x01;reader 都能解
- Happy: rewrap 中途 ctrl-C → checkpoint 保留 → resume 接续不重做
- Edge: envelope payload 第一字节 0x00 → reader 走 LocalKms;0x01 → 走 AliyunKms
- Edge: rewrap 期间用户硬删 sweep 跑 → rewrap 看到 deleted_at IS NULL 跳过 → 删除 job 之后再扫一次
- Edge: KMS 调用失败 → LRU cache 兜底,缓存 miss 报 503
- Edge: RLS 启用后 cross-user query 返回 0 行
- Error: dev header 在 production 启动 → 启动失败 + log
- Integration: Phase 1 全部 187 个测试在 RLS + Supabase client 切换后仍通过(setup helper 注入 service-role + auth context)

**Verification:** Beta 上线前 100% RLS coverage;KMS 调用 P99 < 200ms;rewrap 脚本 dry-run + apply 双跑成功;Phase 1 全测试通过率 100%

---

## System-Wide Impact

- **Interaction graph**:U2 EB 引擎 ↔ Phase 1 已 ship 的 meals / symptoms / classifier(读)+ U6 feedback(降权);U4 PDF 个体版 ↔ U2 + U5(可选);U7 Findings ↔ U2 输出;U9 Web Push ↔ in-app 兜底队列;U10 RLS 启用全表
- **Error propagation**:OCR 失败 → 用户人工修正(R32);LLM 失败 → 顺序 fallback + 限流降级;EB 数值不稳定 → 候选清单为空时 confidence_flag=low + UI 兜底"个体规律仍在累积";Vercel Cron 漏跑 → 进 in-app 兜底队列;阿里云 KMS 调用失败 → LRU cache 兜底 + 503 降级;KMS rewrap 中断 → checkpoint resume
- **State lifecycle risks**:KMS rewrap 与 30 天硬删 sweep 的竞态(已在 U10 approach 处理);RLS 启用后 Phase 1 测试 fixture 必须注入 auth.uid();PDF v0.5 → v1.0 切换期间 client / server 字段兼容性 + 用户已分享老 PDF 的版本印章策略;K-means K 值变更触发 fa_candidates lazy 重算
- **API surface parity**:`/profile/v05` 不改名(向后兼容)— shape 升级新增 `faCandidates` + `version` + `generatedAt`;`/recommend/today` 不改 — Phase 2 EB 输出可选注入,提升 `fa_heavy` 模式精度但 API 层面不变
- **Integration coverage**:U2 EB 涉及解密 / 聚合 / 数学计算 / 持久化四层,集成测试需要端到端跑(meal → decrypt → aggregate → posterior → store);U5 OCR 涉及 Supabase Storage → 阿里云 OCR → envelope encryption → 用户确认 → 入库五层;U10 RLS 切换全栈影响,集成测试覆盖率必须 ≥ 现状
- **Unchanged invariants**:Phase 1 食物条目数据双层 schema 不改;Yan-Score 4 Part 公式 + 重分配规则不改;同意 5 scope 不改;envelope encryption AAD 绑定 user_id 设计不改;客户端 PDF print 模式不改

---

## Risks & Dependencies

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| EB 对噪声/对抗用户失效(总报 0/总报 7),候选退化为最频繁食物 | 高 | 高 | confidence_flag=low gate;Beta 启动前 5-10 sample 用户 spot check;对比群体先验 baseline 做 A/B(adversarial F1 + F14) |
| 食物分类 spot-check 修订导致历史 fireScore 与当前标签不一致 | 高 | 中 | Phase 2 接受 silent drift + 加审计 log;Phase 3 顾问会上线引入正式版本号(adversarial F2) |
| K-means 聚类被高方差维度主导,5 cluster 退化为 1 维分群 | 中 | 中 | z-score 标准化(K key technical decision)+ verification 加"5 cluster 在 ≥ 3 维度有可解释差异" |
| 用户已分享 v0.5 PDF 与新版个体 PDF 矛盾 | 中 | 中 | PDF 页脚版本印章 + Findings banner "档案已升级"(adversarial F5) |
| 切 Supabase JS client 改动过大破坏 Phase 1 测试 | 中 | 中 | ce-work U10 起步先做 1 store 的 spike;批量重构按 store 分批 commit |
| KMS rewrap 中途失败导致部分行无法解密 | 中 | 高 | checkpoint + resume + dry-run + version byte 路径选 + 回滚脚本(envelope.ts 可降级回 0x00 LocalKms 解 if AliyunKms revoked) |
| OCR 小数点误读到生产数据 | 中 | 高 | 双重确认 UX:用户必看原文截图 + 抽取数值 + 单位 三栏对照页;无确认无法入库(adversarial F6) |
| EB 数据 pipeline 选型(Supabase Edge Functions vs Vercel container)不当导致 Beta 期吞吐不足 | 中 | 中 | U2 起步前 1 周 spike 验证 |
| Vercel Cron 漏跑导致打卡推送中断 | 低 | 中 | in-app 兜底队列(U9 内建);dashboard 监控 Cron 健康 |
| LLM 成本失控 | 低 | 高 | U8 cost-monitor + 月度 budget 硬卡 + 飞书告警(月度 budget 80% 触发) |
| 顺序 fallback 比 hedged 慢导致用户感知 | 低 | 低 | Beta 数据观察后 Phase 3 评估是否引入 hedged |
| 用户大量 misrecognized 反馈污染数据 | 低 | 中 | U6 24h rate limit + suspicious flag(adversarial F7) |

---

## Phased Delivery

### Phase 2 — 12 周(Phase 1 Beta 启动后即开)

- 第 1-2 周:U10 KMS 阿里云迁移 + RLS 启用 + Supabase JS client 切换(代码侧)— 这是最大改动,先做避免阻塞
- 第 3-4 周:U8 真实 LLM 接入 + cost-monitor + 飞书告警;U9 真实 Web Push + Vercel Cron + in-app 兜底
- 第 5-6 周:U1 群体先验聚类(z-score)+ U3 环境扣除回归(用户级);U2 worker 平台 spike(1 周)
- 第 7-9 周:U2 EB shrinkage 引擎(含 confidence_flag);U5 体检 OCR(并行)
- 第 10 周:U4 PDF 个体版替换 v0.5(版本印章)
- 第 11 周:U6 反例反馈通道 + 速率限制;U7 R20b 趋势线启用
- 第 12 周:Beta 启动前 sample 用户 spot check + spam validation;Beta 全量上线

### Phase 3 — 12 周+(Phase 2 上线后启动)

- 中医顾问委员会 BD + 接入流程
- 食物分类引擎 v2(流派标注多分类输出 + 历史标签版本号 + 全量回填)
- 反向定位投放素材自动审查机制
- Native app 评估 / 海外华人 / 英文版评估
- **ICP 备案 + 阿里云 ECS 域名迁移 + PIA 法务报告**(从 Phase 2 推迟)
- **微信服务号备份推送通道**(根据 Phase 2 收集的 Web Push 真实失败率决定)
- **PostgreSQL 物化视图 / ClickHouse 迁移**(根据 Beta 期 dashboard 实际 P99 决定)
- **服务端 puppeteer PDF + OSS 签名 URL**(根据 PDF 分享需求决定)
- **U8 hedged-router**(顺序 fallback 不够时再上)

---

## Beta 上线 Checklist(原 U13 降格)

Beta 公开发布前必须完成的非代码 + 跨部门交付物。本 plan 的 ce-work 不直接交付这些,但纳入 release gate:

- [ ] U10 全部测试通过 + Phase 1 测试 100% 兼容
- [ ] KMS rewrap 全量完成 + 0x00 envelope 数清零
- [ ] 5-10 个 sample 用户 EB candidates 主观满意度 ≥ 70%(adversarial F14)
- [ ] OCR spot check 50 份真实报告 + 用户人工确认率 100%
- [ ] 飞书告警链路 staging 跑通(LLM cost / push 失败 / EB 候选生成率)
- [ ] Vercel Cron 7 天稳定无漏跑
- [ ] dashboard P99 < 500ms
- [ ] 隐私政策对齐 PIA 报告产出(Phase 3 同步,Phase 2 内继续 Phase 1 隐私政策)
- [ ] 私人 beta 邀请制 limit ≤ 1k 用户(无 ICP 备案前不公开发布)

---

## Documentation / Operational Notes

- **Beta 上线 checklist** 见上节;Phase 2 ce-work 完成后专项 review
- **Phase 1 → Phase 2 数据迁移**:envelope encryption KMS 迁移是 Phase 2 上线前必须完成的一次性脚本(U10),有 rollback 路径(version byte 0x00 path 保留)
- **运维监控**:Vercel Cron 健康 / KMS 调用 P99 / LLM 月度成本 / Web Push 触达率 / EB 候选生成率 / EB confidence_flag=low 用户占比 六项进飞书机器人日报
- **隐私政策修订**:U5 OCR 启用时,在 PrivacyPolicy.tsx 中明确"体检报告 OCR 处理 + 用户人工确认 + envelope 加密存储 + 30 天硬删"四点;PIA 报告完整修订留 Phase 3 同步

---

## Sources & References

- **Origin document:** [docs/brainstorms/2026-05-04-yanyan-tcm-inflammation-system-requirements.md](../brainstorms/2026-05-04-yanyan-tcm-inflammation-system-requirements.md)
- **Phase 1 plan:** [docs/plans/2026-05-04-001-feat-yanyan-h5-mvp-plan.md](2026-05-04-001-feat-yanyan-h5-mvp-plan.md)(已 ship 14/14 unit)
- **STRATEGY.md:** [STRATEGY.md](../../STRATEGY.md)
- **EB shrinkage 文献**:Efron & Morris (1975) Stein's Paradox;Casella (1985) An Introduction to Empirical Bayes
- **阿里云 KMS / OCR / 通用文字识别**:阿里云开放平台官方文档
- **web-push library**:[https://github.com/web-push-libs/web-push](https://github.com/web-push-libs/web-push)
- **Supabase RLS**:[https://supabase.com/docs/guides/auth/row-level-security](https://supabase.com/docs/guides/auth/row-level-security)
- **ce-doc-review v1 反馈记录**:本 plan 经一轮 4-reviewer 头条评审(coherence / feasibility / scope-guardian / adversarial),35 finding 中 Tier 1 全部吸纳到 Key Technical Decisions,Tier 2 修正到对应 unit,Tier 3 部分吸纳到 Risks + Open Questions(deepened: 2026-05-04)
