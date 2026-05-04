---
title: "feat: Yanyan H5 MVP — 中医发物 × 次晨体感系统"
type: feat
status: active
date: 2026-05-04
origin: docs/brainstorms/2026-05-04-yanyan-tcm-inflammation-system-requirements.md
---

# feat: Yanyan H5 MVP — 中医发物 × 次晨体感系统

## Summary

19-20 周 MVP 计划:微信小程序前端 + Node/Fastify 后端 + 豆包多模态食物识别 + 中医典籍 + LLM 派生的分类引擎 + 规则化 Yan-Score v0 + 两阶段次晨打卡 + 今日推荐清单 + Day 30 体质档案 PDF v0.5(群体先验版)。Day 14-30 群体先验、个体发物 Bayesian 回归、Day 30 PDF 个体版、体检 OCR 推到 Phase 2;顾问委员会与 native app 推到 Phase 3。

---

## Problem Frame

需求详见 origin 文档。本计划专注于**如何**用最少的技术风险把 v1 MVP 在 12 周内交付到用户手里——既守住中医发物的母语级共鸣,又规避境外 AI 跨境合规风险、安卓覆盖断崖、以及小样本 Bayesian 算法在 Day 14 即承诺的统计陷阱。

---

## Requirements

继承自 origin(`docs/brainstorms/2026-05-04-yanyan-tcm-inflammation-system-requirements.md`)的 R1-R34、R5b、R20b、R21b。本 plan 的 v1 MVP 实施覆盖以下子集,其余 R 推至 Phase 2/3(见 Phased Delivery):

**v1 MVP 必须满足:** R1-R10、R11、R12、R13、R14、R15、R16、R17、R18、R19、R5b、R27(v1)、R28(用户反馈通道)、R34

**v1 MVP 部分满足 / 占位:** R20、R20b、R21、R21b、R31、R32、R33

**Phase 2 满足:** R20、R20b、R21、R21b、R22、R23、R24、R25、R26、R31、R32、R33

**Phase 3 满足:** Origin 中 v2/v3 路线图(顾问委员会接入 / 流派标注 / 大学背书)

**Origin actors:** A1 中产用户;A2 中医顾问委员会(v2 起,本计划仅做接口预留);S1 食物分类引擎、S2 Yan-Score 算法、S3 发物回归引擎(本计划交付 S1 + S2,S3 入 Phase 2)

**Origin flows:** F1 Onboarding(本计划 U4)、F2 拍照即时反馈(U6)、F3 次晨两阶段打卡(U7)、F4 Day 14-30→30 发物清单(Phase 2)、F5 体检报告后置上传(Phase 2)

**Origin acceptance examples:** AE1-AE3 在 v1 验证(U7 测试范围);AE4-AE5 在 Phase 2 验证(U13/U14/U18);AE6 在 Phase 2 验证(随 R20/R20b 完成,U14/U15)

---

## Scope Boundaries

完全继承 origin 文档的 Scope Boundaries(见 origin)。本计划另增以下 plan-local 边界:

### Deferred to Follow-Up Work

- **Day 14-30 群体先验仪表 / Day 30 PDF 体质档案 / 体检报告 OCR / 反例反馈通道**:Phase 2 计划(预计 12 周后启动,见 Phased Delivery)
- **顾问委员会接入 / 流派标注 / 大学合作背书**:Phase 3 计划
- **Yan-Score 周内趋势线**:R20b 要求累计 21 天阈值,v1 MVP 上线后第 4 周自动启用,无需独立 unit 实现
- **Native app**:Phase 3+ 评估
- **海外华人 / 英文版**:Phase 3+ 评估

---

## Context & Research

### Relevant Code and Patterns

无既有代码库。本项目为 greenfield,工作目录 `/Users/zhongqingbiao/Documents/kangyan/` 当前仅含 STRATEGY.md + 上游 brainstorm 文档。所有工程基础需在 U1/U2 中从 0 搭建。

### Institutional Learnings

无既有 `docs/solutions/` 学习记录可复用。

### External References(继承自上轮 ce-ideate web research)

- **DII (Dietary Inflammatory Index)**:Shivappa 2014 学术验证,可从食物组成计算,无主流消费产品占据 — Track 1 食物分类的科学锚之一
- **AGEs 数据库 (2024)**:覆盖 334 种食物,可从烹饪方式拍照识别 — Track 1 补充信号
- **Levels / Veri / Whoop**:CGM + 单数指标产品参考;Whoop 28 天个人基线机制可借鉴(Phase 2 应用)
- **Flammy / Inflammatory Food Identifier**:已做拍照-抗炎评分但浅薄(无趋势、无个性化、无方法论披露)— 直接竞品,差异化目标
- **薄荷健康(Boohee)**:中国市场卡路里赛道领先者,慢病前期 / 亚健康人群严重未被服务
- **豆包(火山引擎多模态)/ Qwen-VL**:国内合规多模态模型,中餐识别能力可行(ce-work 阶段做准确度 A/B 测试验证)

---

## Key Technical Decisions

- **平台子形态 = 微信小程序 v1**:30-45 中产重度使用微信、分享路径最顺、原生支付与模板消息;PWA 留作 v2 评估。代价:推送受限于模板消息(7 天有效)、健康数据通道弱(只能微信运动步数)。
- **食物识别 LLM = 豆包(火山引擎多模态)主用 + Qwen-VL 备选**:国内合规、跨境数据风险归零、中餐识别强。**不使用 GPT-4o / Gemini 2.5**(跨境数据合规与训练数据使用条款风险)。
- **Yan-Score v0 = 规则化加权(饮食 50% / 体感 30% / 环境 15% / 微信运动 5%)**:v1 冷启动数据不足,无法跑 ML;权重支持 ce-plan 阶段调整 + 任意子集缺失降级。v2 切 ML。
- **后端 = Node.js (TypeScript) + Fastify + PostgreSQL + Redis + 阿里云 RDS / OSS**:国内合规、《个保法》存储要求、生态成熟。
- **前端 = 微信原生小程序 + TypeScript**(默认):跨平台需求由"微信小程序覆盖 iOS/Android" 满足,Taro 的跨平台优势不再必要;ce-work 阶段如发现 Taro 显著省工再切换。
- **食物条目数据 schema = 双层**:中医标签(发/温和/平、寒热温凉)+ 西方营养连续值(DII 派生分、AGEs 分、GI 等);v1 前端只用中医标签层,后台保留西方层为 Phase 2 算法和 Phase 3 出海路径预留。
- **隐私合规 v1 = 最低限单独同意 + 数据全部境内**:onboarding 加单独同意页(R5b);食物图片 / 体检报告 / 健康数据 全部不出境;具体加密/保留期/PIA 在 ce-work 阶段法务参与下定义。
- **数据存储区域 = 阿里云华东 region**:符合《数据安全法》境内存储要求;敏感个人信息字段 AES-256 静态加密。
- **测试策略 = 关键流程集成测试为主 + 单元测试为辅 + LLM 评估测试集独立维护**:Yan-Score 算法、中医分类引擎、Onboarding 流程、次晨打卡 必须有集成测试;LLM 食物识别准确度通过独立 200-500 张中餐照片 ground truth 集评估。

---

## Open Questions

### Resolved During Planning

- **平台子形态**:微信小程序(已锁,见 Key Decisions)
- **食物识别 LLM 选型**:豆包 + Qwen-VL 备选(已锁;ce-work 阶段做准确度 A/B 测试)
- **Yan-Score 加权公式**:规则化加权 v0(已锁;权重在 ce-work 阶段微调)
- **Bayesian prior 来源 / shrinkage 形式**:Empirical Bayes shrinkage,群体先验来自 onboarding 收集的 7 维度症状频次聚类(已锁;具体实现 Phase 2)
- **OCR 引擎选型**:阿里云通用文字识别(已锁;模板适配在 Phase 2)
- **PDF 生成路径**:服务端 puppeteer(已锁;Phase 2)
- **境外 vs 境内 LLM**:全部境内(已锁;合规优先)
- **数据存储区域**:阿里云华东(已锁)
- **测试策略**:集成测试 + 单元测试 + LLM 评估集(已锁)

### Deferred to Implementation

- 豆包 vs Qwen-VL 在中餐 200 张样本上的 top-1 准确度对比(ce-work 阶段执行)
- 微信原生 vs Taro 的 v1 切换决策(ce-work 阶段如有显著效率差再决定)
- 中医典籍语料的具体引入清单和版权清理路径(R27 deferred,法务参与)
- 7 维度滑块每档具体定义(尤其大便 / 起痘 / 精神 / 浮肿,需中医顾问输入;ce-work 阶段用 4 档默认值落地,后续替换)
- 反向定位筛选屏 5 个具体选项措辞(ce-work 阶段先用占位,上线前用户访谈替换)
- 「<<体质档案命名占位>>」最终命名(Phase 2 上线前命名研究)
- iOS HealthKit / 华为健康 单独通道是否在 v1.5 加入(留观察)
- 推荐饮食模块的来源逻辑(顾问委员会 / LLM 派生 / 体质映射 / 不做)— Phase 2 决策
- 隐私合规细节套件(数据加密、保留期、PIA、PDF redact)— ce-work 阶段法务参与
- 模板消息触达率 < X% 时是否启用服务通知或公众号推送备选 — 上线后观测决定

---

## High-Level Technical Design

> *以下是 v1 MVP 的整体形态参考,直接面向评审,不是实现规范。实现 agent 应当作为方向上下文,不要逐字复制。*

### 系统架构(粗粒度)

```
┌──────────────────────────────────────────────────────────────────┐
│                      微信小程序 (v1 前端)                         │
│  Onboarding | 拍照 | 主屏 | 次晨打卡 | 设置 | 分享(发物档案)      │
└─────────────────────────┬────────────────────────────────────────┘
                          │ HTTPS (微信小程序 wx.request)
                          ▼
┌──────────────────────────────────────────────────────────────────┐
│             Node.js + Fastify API (阿里云 ECS, 华东 region)       │
│  ┌────────────┐  ┌────────────┐  ┌──────────────────┐            │
│  │ Onboarding │  │ 拍照流水   │  │ Yan-Score v0     │            │
│  │ + 隐私同意 │  │ 食物分类   │  │ 算法引擎         │            │
│  └────────────┘  └────┬───────┘  └────────┬─────────┘            │
│                       │                    │                      │
│  ┌────────────┐       ▼                    ▼                      │
│  │ 次晨打卡   │  ┌──────────┐      ┌──────────────┐              │
│  │ 两阶段     │  │ 食物分类 │      │ 环境数据接入 │              │
│  └────────────┘  │ 引擎 v1  │      │ PM2.5/花粉   │              │
│                  └────┬─────┘      └──────────────┘              │
│                       │                                            │
│                       ▼                                            │
│              ┌──────────────────┐                                 │
│              │ 豆包多模态 SDK   │                                 │
│              │ (Qwen-VL 备选)   │                                 │
│              └──────────────────┘                                 │
└──────────────┬───────────────────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────────────────────┐
│  阿里云 RDS PostgreSQL  +  Redis  +  OSS (照片/PDF, 加密)         │
│  schema: 用户/餐食(双层标签)/体感打卡/Yan-Score 历史/隐私同意    │
└──────────────────────────────────────────────────────────────────┘
```

### Yan-Score 算法 v0(规则化加权)

```
TodayYanScore = clip(
  0   + 50% × FoodPart        // 食物-中医分类映射后求和(发=高分,平=低分)
      + 30% × SymptomPart     // 7 维度次晨打卡 × 严重度滑块加权
      + 15% × EnvPart         // PM2.5 / 花粉 / 季节
      +  5% × ActivityPart,   // 微信运动步数与近 7 日个人基线偏差
  range = [0, 100]
)
LevelOfFire = bin(TodayYanScore, breakpoints = [25, 50, 75]) → {平, 微火, 中火, 大火}
Breakdown   = {饮食: FoodPart×50%, 环境: EnvPart×15%, 作息: ActivityPart×5% + ...}
```

降级:任何输入子集缺失,该子集权重在 [0, 1] 内重分配到剩余可用输入,不影响展示。

---

## Implementation Units

**Phase 1 MVP 详细单元(U1-U12 + U13a + U13b,共 14 单元 / 19-20 周)** 见下;Phase 2/3 单元概述见 Phased Delivery 一节。

**Round 2 review 后追加的 2 个单元(回应"Phase 1 无承诺兑现 + 无 next-step"crisis):**
- **U13a:今日推荐清单(actionable next-step)** — 拍照 / 打卡后给出"今日避开 X、Y、Z + 推荐三餐"
- **U13b:Day 30 体质档案 PDF v0.5(群体先验版)** — 把 Phase 2 PDF 提前到 Phase 1 末尾,使用群体先验生成,非个体 Bayesian;Phase 2 真个体版替换

---

- U1. **微信小程序基础工程脚手架**

**Goal:** 创建可上传到微信开发者平台的最小可运行小程序,定义目录结构、TypeScript 配置、状态管理、UI 基础组件库、构建/部署流程。

**Requirements:** 工程基础(支撑 R1-R34 所有前端需求)

**Dependencies:** None

**Files:**
- Create: `mp/project.config.json`、`mp/app.ts`、`mp/app.json`、`mp/app.wxss`
- Create: `mp/pages/`(目录)、`mp/components/`(目录)、`mp/utils/`(目录)、`mp/services/api.ts`
- Create: `mp/tsconfig.json`、`mp/.eslintrc.js`、`README.md`(部署说明)
- Test: `mp/tests/smoke.test.ts`(框架启动 smoke test)

**Approach:**
- 微信原生小程序 + TypeScript;状态管理用 MobX-miniprogram(轻量);UI 组件复用 vant-weapp 基础组件后改色 + 自研中医语言主题
- API 层用 axios-miniprogram 风格 wrapper,统一错误处理 / 加密传输 / 鉴权 token

**Patterns to follow:** 微信原生小程序框架 ≥ 2.30 标准目录结构

**Test scenarios:**
- Happy path: 启动 → app.ts onLaunch 触发 → 首页路由跳转
- Edge case: 网络不通时 wx.request 失败显示降级文案

**Verification:** `npm run dev` 可在微信开发者工具中正常预览;首页空白可正常加载

---

- U2. **后端服务基础脚手架 + 数据 schema**

**Goal:** 创建 Node.js + Fastify 后端基础工程,部署到阿里云华东,提供 API + DB + Redis 三件套;落地 v1 数据 schema(用户、餐食双层标签、体感打卡、Yan-Score 历史、隐私同意记录)。

**Requirements:** 工程基础(支撑 R6, R10, R14, R15-R19, R28, R31-R33 所有后端需求)

**Dependencies:** None

**Files:**
- Create: `server/src/app.ts`、`server/src/server.ts`、`server/src/config.ts`
- Create: `server/src/db/schema.sql`(全部表 DDL)、`server/src/db/migrate.ts`
- Create: `server/src/services/`(meals, symptoms, score, users, consents 子目录)
- Create: `server/src/api/v1/`(路由 + handlers)
- Create: `server/Dockerfile`、`server/.env.example`、`server/README.md`
- Test: `server/tests/integration/api.smoke.test.ts`、`server/tests/db/schema.test.ts`

**Approach:**
- Fastify + zod 做 schema 验证;Prisma ORM 简化数据访问
- 数据 schema 关键表:
  - `users` (id, wx_openid, created_at, baseline_summary jsonb, consent_version)
  - `meals` (id, user_id, photo_url, recognized_items jsonb, tcm_labels jsonb, western_nutrition jsonb, ate_at, created_at) — **双层标签**
  - `symptoms` (id, user_id, recorded_for_date, blind_input jsonb, severity jsonb, **definition_version int**, source enum['next_morning','onboarding'], created_at) — `definition_version` 标识当时的滑块档位定义版本;档位换版后趋势/分析仅在同版本数据内绘制,避免历史数据语义漂变
  - `yan_score_daily` (user_id, date, food_part, symptom_part, env_part, activity_part, total, level, breakdown jsonb)
  - `privacy_consents` (id, user_id, scope enum['health_data','medical_report','photo_ai','location','subscribe_push'], consent_version, granted_at) — 覆盖《个保法》第 28 条全部敏感个人信息子类(健康/医疗/位置/通信)
  - `food_classifications` (id, food_canonical_name, tcm_label enum['发','温和','平'], tcm_property enum['寒','凉','平','温','热'], dii_score float, ages_score float, references jsonb) — 双层数据源
- 静态加密敏感字段:`symptoms.blind_input` / `symptoms.severity` / `meals.recognized_items` 用 **envelope encryption(AES-256-GCM 数据加密 + 阿里云 KMS 主密钥保护 DEK)**;DEK 在应用进程内 LRU 缓存(TTL ≤ 1 小时);只有缓存 miss 才调 KMS,避免热路径 latency。**RDS 静态加密(TDE)同时启用作为 defense-in-depth**

**Patterns to follow:** Fastify 官方推荐项目结构;Prisma migrate 工作流

**Test scenarios:**
- Happy path: 启动 server → /health 返回 200
- Integration: 创建用户 → 写一条 meal → 读出来,双层标签字段保留
- Edge case: 密文字段写入后无密钥读取报错(降级到管理员告警)
- Error path: 数据库连接失败 → 启动健康检查报错 + 进程退出码 1

**Verification:** `npm test` 全部 smoke / schema 测试通过;Dockerfile 构建产出可用镜像

---

- U3. **隐私合规基础(R5b 单独同意)**

**Goal:** 落地 onboarding 中《个保法》单独同意节点 + 隐私政策页 + 用户撤回路径。本 unit 处理"流程 + 数据存证",具体加密/保留期/PIA 待 ce-work 阶段法务输入。

**Requirements:** R5b、Origin Privacy Compliance Suite 部分项

**Dependencies:** U1, U2

**Files:**
- Create: `mp/pages/consent/index.tsx`、`mp/pages/privacy-policy/index.tsx`
- Modify: `mp/app.ts`(启动检查同意状态)
- Create: `server/src/api/v1/consents.ts`、`server/src/services/consents/index.ts`
- Test: `server/tests/integration/consents.test.ts`、`mp/tests/consent-flow.test.ts`

**Approach:**
- onboarding R4 baseline 完成后插入"敏感个人信息单独同意"页;告知文案预留待法务输入
- 单独同意页强制勾选才能继续;同意版本号记入 `privacy_consents` 表;用户每次小程序更新需重新勾选(consent_version 升版)
- **存量用户拦截:`mp/app.ts` 的 onLaunch / onShow 检查 consent_version 比对当前服务端最新版,版本不符强制跳转同意页**(避免新版本生效后存量用户绕过)
- 设置页提供"撤回同意 / 注销账号"入口;撤回触发**(a)立即吊销该用户的 KMS DEK 访问权限**(防止软删除窗口期内部解密)+(b)数据软删除 +(c)30 天后硬删除 + DEK 永久销毁

**Patterns to follow:** 微信小程序 wx.navigateTo 阻塞式弹屏 / 强制勾选模式

**Test scenarios:**
- Happy path: 用户首次 onboarding 完成 baseline → 单独同意页打开 → 勾选 → 进入下一步
- Edge case: 不勾选直接关闭 → 下次进入 App 仍要求同意,无法跳过
- Integration: 同意后 `privacy_consents` 表正确写入(scope=health_data, granted_at, consent_version)
- Error path: 用户撤回同意后 → 30 天硬删除 cron 触发 → 用户数据完全清除

**Verification:** 同意未授权用户无法进入主屏 + 拍照;撤回路径完整

---

- U4. **Onboarding 流程(R1-R5)**

**Goal:** 实现 onboarding 流程(5-6 屏,合并屏后总数 ≤ 5):反向定位筛选 → 7 维度近期症状频次 → 体质 baseline 即视感(含单独同意嵌入)→ 微信运动授权 + 首次拍照引导(合并 1 屏)。注:R2 限制 ≤ 5 屏;实施时 baseline 屏与单独同意可合并(同意嵌入 baseline 底部),微信运动授权与首次拍照可合并(双 CTA 同屏)。

**Requirements:** R1, R2, R3, R4, R5, R5b

**Dependencies:** U1, U2, U3

**Files:**
- Create: `mp/pages/onboarding/`(目录)— `step1-reverse-filter.tsx`、`step2-symptoms-grid.tsx`、`step3-baseline.tsx`、`step4-wx-run-link.tsx`、`step5-first-photo-cta.tsx`
- Modify: `mp/app.ts`(首次启动判断)
- Create: `server/src/api/v1/onboarding.ts`、`server/src/services/users/baseline.ts`
- Test: `mp/tests/onboarding.flow.test.ts`、`server/tests/integration/onboarding.test.ts`

**Approach:**
- step1 反向定位筛选:5 个生活化场景题(占位文案,ce-work 阶段用户访谈替换),禁止"减肥/卡路里"字样
- step2 7 维度方块矩阵(7 行 × 3 列频次档),1 屏完成,纯打勾无文字
- step3 体质 baseline 即视感:基于 step2 给"看起来你近期偏微火/中火"提示
- step4 微信运动授权:使用 `wx.getPrivacySetting` + `wx.openSetting`;允许跳过
- step5 首次拍照引导:CTA "中午吃饭时拍一张"
- 后端记录 baseline 至 `users.baseline_summary`(jsonb)

**Test scenarios:**
- Happy path: 5 步完成 → 主屏可正常显示
- Edge case: step4 微信运动授权拒绝 → 流程继续,baseline 表 wx_run_authorized=false
- Edge case: step2 全部选"几乎没有" → step3 体质提示展示"目前看起来很平和"
- Edge case: 中途强退 → 重新进入回到上一步
- Covers AE(隐含):反向定位语言全程不出现"减肥"

**Verification:** 5 步全程无文字输入;baseline 数据正确写入;同意状态正确置位

---

- U5. **食物分类引擎 v1(典籍语料 + LLM 派生 pipeline)**

**Goal:** 建立食物分类引擎 v1:导入中医典籍语料子集(《本草纲目》《温病条辨》)→ LLM 派生形成 `food_classifications` 表种子数据 → 提供分类查询 API。**双层数据**(中医标签 + 西方营养连续值)同时填充,前端 v1 只读中医层。

**Requirements:** R7, R27

**Dependencies:** U2

**Files:**
- Create: `server/src/services/classifier/`(seed-from-canon.ts、derive-with-llm.ts、query.ts)
- Create: `server/scripts/seed-foods.ts`(一次性导入 800-1500 个高频中餐食物)
- Create: `server/data/canon-excerpts/`(典籍节选语料 markdown,法务清理后)
- Create: `server/data/western-nutrition/`(DII 派生表 + AGEs 表;只引用公开数据集)
- Test: `server/tests/integration/classifier.test.ts`

**Approach:**
- v1 食物库种子目标:覆盖 80% 高频中餐食物(参照"薄荷食物库 top 1500"作 reference)
- 流程:典籍节选 → LLM (Qwen-VL/豆包文本端) 给每个食物输出 `{tcm_label, tcm_property, citation}` → 人工 spot check 100-200 个 → 入库
- 西方营养数据来自 USDA + DII 论文派生 + AGEs 数据库(已确定可商用的部分)
- 提供 `GET /api/v1/foods/{name}/classification` API,返回完整双层数据;前端 v1 仅渲染中医层

**Patterns to follow:** 阿里云 KMS 管理 LLM API key;Bull/BullMQ 异步任务队列管理种子导入

**Test scenarios:**
- Happy path: 种子 1000 个食物入库,查询"清蒸鲈鱼"返回 `{tcm_label:'平', tcm_property:'平', citation:'《本草纲目》...', dii_score:-0.3, ages_score:5}`
- Edge case: 查询不存在的食物 → 返回 404 + 异步触发 LLM 回填
- Integration: 种子导入完成后,`food_classifications` 表行数 ≥ 800

**Verification:** v1 高频中餐食物覆盖率 ≥ 80%;典籍引用字段非空率 ≥ 95%;**100 个高频食物的 DII / AGEs 数值与 USDA / 公开数据集 spot check 对比 误差率 ≤ 10%**(防止 Phase 2 算法上线时大规模回填)

---

- U6. **拍照即时反馈链路(F2)**

**Goal:** 实现"拍照 → 上传 → LLM 食物识别 → 中医分类 → 红/黄/绿结果页"完整闭环,含用户标记误识别能力。

**Requirements:** R6, R7, R8, R9, F2 全部 steps

**Dependencies:** U1, U2, U5

**Files:**
- Create: `mp/pages/camera/index.tsx`、`mp/pages/meal-result/index.tsx`、`mp/components/food-item-card.tsx`
- Create: `server/src/api/v1/meals.ts`、`server/src/services/recognition/`(doubao-client.ts、qwen-vl-client.ts、fallback-router.ts)
- Modify: `server/src/services/classifier/query.ts`(批量查询接口)
- Test: `server/tests/integration/meal-recognition.test.ts`、`server/tests/llm-eval/`(LLM 评估测试集占位)

**Approach:**
- 微信小程序 `wx.chooseMedia` 拍照 / 选图 → 压缩到 1024px → 上传到阿里云 OSS(私有 bucket,**PUT presigned URL 由后端签发,绑定 `users/{user_id}/{meal_id}/` 前缀防止任意上传**;`meals.photo_url` 字段仅存 OSS 内部 key,运行时按需生成短期 GET 签名 URL)
- 后端调豆包多模态 API → 解析返回的 N 个食物条目 → 批量查 `food_classifications` → 计算整餐火分(各食物的发/温和/平 加权)
- 整餐结果页:
  - 主体:整餐火分 + 火分等级
  - 食物条目列表(3-7 项)展开:每项分类标签 + 典籍引用
  - 多菜肴聚合规则 v1:**直接复用 U8 FoodPart 公式**(发=5、温和=2、平=0 加权后 / N → 标准化到 [0,100]);整餐火分 = U8 FoodPart 标准化值 × 100,与 Yan-Score 内部口径一致。**不另设 max 公式**(避免火锅类 4+ 发物场景被天花板钉死、避免 LLM 识别抖动跨等级跳变)
  - 误识别按钮:每个条目独立标记;反馈写入 `meals.feedback` jsonb
- LLM 调用策略:**hedged request — 豆包 + Qwen-VL 并行调用,谁先返回用谁**(避免 5 秒串行 fallback 让 P95 破 8 秒);双失败给用户提示"识别忙,稍后再试"。低置信度阈值由后端定义(置信度 < 0.6 视为低置信,提示用户补拍)

**Test scenarios:**
- Happy path: 上传清蒸鲈鱼 + 西兰花 + 米饭 → 火分 22(平和)、3 个食物条目展示
- Edge case: 火锅照片(10+ 食材)→ 整餐火分按聚合规则计算,前 5 个食材展开,其他折叠
- Edge case: 模糊照片 → LLM 返回低置信 → 提示"看不清,要不要补一张"
- Edge case: 用户选了非食物图片 → LLM 返回 0 食材 → 提示"似乎不是食物"
- Error path: 豆包超时 5 秒 → fallback 到 Qwen-VL → 总响应 ≤ 8 秒
- Error path: 双 LLM 全失败 → 返回 503 + 用户友好提示
- Integration: 标记误识别 → `meals.feedback` 写入 → 队列任务接收(Phase 2 实施反馈处理)
- Covers AE(隐含 R7, R8):无 AI 人格化主播文案;每食物条目附典籍引用

**Verification:** 中餐 200 张评估集 top-1 准确度 ≥ 70%;整餐火分计算稳定可重现

---

- U7. **次晨两阶段打卡流程(F3)**

**Goal:** 实现 Step 1 盲打卡 7 维度(打勾 + 维度专属严重度滑块)+ Step 2 对照展示昨日 + Yan-Score 揭晓 + 归因 breakdown。

**Requirements:** R10, R11, R12, R13, R14, R18, F3 全部 steps;Covers AE1, AE2, AE3

**Dependencies:** U1, U2, U8(Yan-Score 引擎)

**Files:**
- Create: `mp/pages/morning-check-in/`(目录)— `step1-blind.tsx`、`step2-compare.tsx`、`step3-reveal.tsx`
- Create: `mp/components/symptom-slider.tsx`(维度专属滑块通用组件 + 7 维度配置)
- Modify: `mp/app.ts`(7:30 推送处理)
- Create: `server/src/api/v1/symptoms.ts`、`server/src/services/symptoms/`
- Test: `mp/tests/morning-checkin.flow.test.ts`、`server/tests/integration/symptoms.test.ts`

**Approach:**
- 7 维度配置(占位档位,ce-work 阶段中医顾问输入替换):
  - 鼻塞:4 档(轻度 / 一鼻塞 / 双鼻塞 / 完全堵)
  - 起痘:4 档(零星 / 几颗 / 多颗 / 大面积)
  - 口干:4 档(微干 / 想喝水 / 嘴唇干裂 / 舌苔厚)
  - 大便:5 档(正常 / 偏稀 / 偏硬 / 黏腻 / 腹泻)
  - 精神:4 档(良好 / 一般 / 困倦 / 极度疲惫)
  - 浮肿:4 档(无 / 眼袋 / 面部 / 全身)
  - 喉咙痒:4 档(无 / 偶尔 / 持续 / 痛)
- Step 1 全部默认"无";勾选后滑块出现,**滑块无默认值 — 用户必须主动滑动至少 1 次才视为有效**(避免 default-effect 锚定到最轻档,污染数据集 + 影响 Phase 2 Bayesian 先验);未滑动的勾选项视为"无反应"反向置位
- Step 1 严格不展示昨日打卡;Step 1 完成 → 提交盲数据 → 进入 Step 2
- Step 2 对照展示:仅展示("昨天你勾过 X、Y;今早:X→轻度,Y→无");无输入
- Step 3 揭晓 Yan-Score:上火等级 + 火分 + 点击展开 breakdown
- 中途退出:Step 1 部分完成时不保存;Step 2 / Step 3 展示态可随时返回

**Patterns to follow:** 微信小程序模板消息触达;wx.requestSubscribeMessage 用户订阅授权

**Test scenarios:**
- Happy path: AE1 — onboarding 勾过鼻塞/口干 → Step 1 全 7 项默认无、不显示昨日、用户勾鼻塞→轻度、不勾口干 → 提交
- Happy path: AE2 — Step 2 展示对照 + Step 3 揭晓"微火 38" + breakdown "饮食 22 / 环境 10 / 作息 6"
- Edge case: Day 1 用户(尚无次晨打卡)— Step 2 展示"今天是第一次,无昨日对照"
- Edge case: 7:30 推送被忽略,下午 3 点打开 → 打卡界面仍可用,标注"昨天饮食对应"
- Edge case: 中途退出 Step 1 → 重进 → Step 1 重新开始(不保存中间态)
- Error path: 已经打过今天的卡再打 → 提示"今天已打卡"+ 直接展示 Step 3 结果
- Covers AE3: 用户 Day 1 拍 3 餐照、未做次晨打卡 → 主屏显示"明早打卡后揭晓你的首份火分"

**Verification:** Step 1 严格盲、Step 2 仅展示;Yan-Score 在 Step 3 揭晓且不前置

---

- U8. **Yan-Score 算法 v0(规则化加权)**

**Goal:** 实现 Yan-Score v0 规则化加权算法,综合 4 类输入(饮食 50% / 体感 30% / 环境 15% / 微信运动 5%),支持任意子集缺失降级,产出 0-100 火分 + 4 档上火等级 + 归因 breakdown。

**Requirements:** R15, R16, R17, R18, R19

**Dependencies:** U2, U5, U9(环境数据接入)

**Files:**
- Create: `server/src/services/score/`(food-part.ts、symptom-part.ts、env-part.ts、activity-part.ts、aggregator.ts)
- Create: `server/src/services/score/breakdown.ts`(归因 breakdown 生成)
- Test: `server/tests/integration/yan-score.test.ts`、`server/tests/unit/score-parts.test.ts`

**Approach:**
- 各 Part 输出 [0, 100] 标准化分数;aggregator 按权重加权后 clip 到 [0, 100]
- FoodPart:当日所有 meals 的食物条目 → 按发/温和/平 加权(发=5、温和=2、平=0)/ N(N=条目数)→ 标准化
- SymptomPart:7 维度的严重度 × 维度权重(初始等权重)→ 标准化
- EnvPart:PM2.5 区间映射(优 0 / 良 30 / 轻度 60 / 中度 80 / 重度 100)+ 花粉(若数据可获)+ 季节修正(春秋发物高发期 +5)
- ActivityPart:微信运动今日步数 vs 用户近 7 日中位数偏差;偏差 > -50% 加 20 分
- 任意 Part 数据缺失 → 该 Part 权重在剩余 Part 间按比例重分配。**单一 Part 重分配上限 = 原权重 × 2**(防止 Day 1 仅 SymptomPart 被放大到 100% → 微小症状跨等级);**当可用 Part < 2 时返回 null + UI 文案"数据还不够,先不评分"**(避免单点输入支配火分)
- 上火等级分档:[0,25)平、[25,50)微火、[50,75)中火、[75,100]大火

**Patterns to follow:** 纯函数风格 + 依赖注入便于测试;参数化权重便于 ce-work 调优

**Test scenarios:**
- Happy path: 4 类输入齐全,中等水平 → 火分 ~50,上火等级=中火
- Happy path: 全平和食物 + 无症状 + 优 PM2.5 + 步数正常 → 火分 < 20
- Edge case: 缺失 ActivityPart(用户拒绝授权微信运动)→ 权重重分配,其他 3 类按 50/30/15 → 53/32/15
- Edge case: 缺失 EnvPart 和 ActivityPart → 仅 FoodPart + SymptomPart,按 50/30 → 62.5/37.5
- Edge case: 全部缺失(理论上 R19 不应触发,但安全降级)→ 返回 null 而非 0
- Edge case: 火分 = 25 → 微火(边界包含)
- Integration: 当日 score 持久化到 `yan_score_daily` 表,breakdown jsonb 字段完整

**Verification:** 单元测试 100% 覆盖各 Part + aggregator + 缺失场景;集成测试覆盖完整一日数据流

---

- U9. **环境数据接入(PM2.5 + 花粉 + 季节)**

**Goal:** 接入国控 PM2.5 数据(和风天气 API)+ 花粉数据(可获城市)+ 季节(本地时间);为 Yan-Score EnvPart 提供输入。

**Requirements:** R17, R20(部分,环境部分)

**Dependencies:** U2

**Files:**
- Create: `server/src/services/env/`(pm25-fetcher.ts、pollen-fetcher.ts、season.ts、aggregator.ts)
- Create: `server/src/jobs/env-snapshot.ts`(每小时全国主要城市 PM2.5 抓取)
- Test: `server/tests/integration/env.test.ts`

**Approach:**
- PM2.5:和风天气 API(有商用许可)+ 城市级 30 分钟刷新
- 花粉:北京/上海/成都等 5-10 个有数据的城市直接 query;其他城市 v1 退化为"季节性默认"(春秋默认中等)
- 季节:基于用户城市 + 本地日期分春/夏/秋/冬;春秋默认 +5 发物季节加成
- 用户位置获取:微信小程序 `wx.getLocation`(需用户授权;拒绝则用注册时填的城市占位)

**Test scenarios:**
- Happy path: 北京用户 → PM2.5 = 65 (轻度污染), 花粉中等 → EnvPart = ~65
- Edge case: 用户拒绝 location → 退化用 IP 城市,EnvPart 不阻塞
- Edge case: 和风 API 超时 → 用近 1 小时缓存值,缓存超期则 EnvPart 缺失(U8 降级)
- Edge case: 用户在花粉无数据城市 → 该项不计入,EnvPart 仅 PM2.5 + 季节

**Verification:** 国控站 PM2.5 抓取稳定;EnvPart 在花粉缺失场景下也能合理输出

---

- U10. **主屏与日活 UX**

**Goal:** 实现主屏的"今日体质卡片 + 当日餐食历史 + 打卡入口 + 发物与发现 tab(空状态)+ 设置入口"。

**Requirements:** R10, R15, R16, R19, R21(空状态部分)

**Dependencies:** U6, U7, U8

**Files:**
- Create: `mp/pages/home/index.tsx`、`mp/components/today-fire-card.tsx`、`mp/components/meal-history-list.tsx`、`mp/pages/findings/index.tsx`(空状态)
- Modify: `mp/app.json`(tabBar 配置)
- Test: `mp/tests/home.test.ts`

**Approach:**
- 今日体质卡片:上火等级大字 + 火分小字 + 周内趋势(累计 < 21 天提示"数据累积中,先不画趋势")
- 餐食历史:今日 N 餐时间线缩略图 + 整餐火分
- 发物与发现 tab v1:展示"发物档案将在 Day 30 生成"占位 + 当前累计天数进度
- 底部导航 4 tab:首页 / 拍照(跳页) / 发物与发现 / 我的

**Test scenarios:**
- Happy path: 用户累计 5 天 → 主屏火分卡片 + 当日餐食 2 餐 + 发物 tab "Day 5/30"
- Edge case: 累计 = 0 天且未做次晨打卡 → 主屏火分位显示"明早打卡后揭晓"
- Edge case: 累计 25 天 → 周内趋势线开始绘制(R20b 阈值满足)
- Covers AE3 间接

**Verification:** 主屏在不同累计天数下展示符合预期

---

- U11. **小程序模板消息 / 服务通知推送**

**Goal:** 实现次晨打卡 7:30 推送(微信小程序模板消息),包含用户订阅、模板消息发送、退订机制。

**Requirements:** R10(推送时机)

**Dependencies:** U7

**Files:**
- Create: `mp/components/subscribe-message-prompt.tsx`(订阅引导)
- Create: `server/src/services/push/template-message.ts`、`server/src/jobs/morning-push.ts`
- Test: `server/tests/integration/morning-push.test.ts`

**Approach:**
- 用户首次完成次晨打卡后,弹出 `wx.requestSubscribeMessage` 申请打卡提醒模板;**微信小程序当前模板消息默认是"一次性订阅"(单次申请仅获 1 次发送配额)**,需在每次发送前重新申请;Step 3 揭晓后再次申请明日推送权
- 服务端 cron:每天 7:25 扫描"昨日打过卡且持有明日发送配额"的用户 → 7:30 批量发送模板消息(微信限速 600/min/appid,需排队)
- **In-app 兜底机制:用户当日未通过推送进入打卡 + 当日内打开过小程序 → 主屏弹层提醒打卡入口**;不把次晨数据采集绑死在推送上(应对单次订阅模型 + 触达率不确定)
- **服务号关注 + 推送备份通道:Phase 2 与 PDF 个体版一起加(已记入 Phased Delivery Phase 2)**;Phase 1 内仅依赖小程序模板消息 + in-app 兜底
- 用户可在设置页关闭推送(后端 unsubscribe)

**Test scenarios:**
- Happy path: 7:30 推送触达 → 用户点击 → Step 1 打卡界面打开
- Edge case: 用户订阅过期 → 推送失败 → 下次打开 App 时再次引导订阅
- Edge case: 微信 API 限流 → 队列排队,失败重试 3 次后记入失败日志
- Edge case: 用户关闭推送 → 后端 unsubscribe → 不再扫描该用户

**Verification:** 推送触达率 ≥ 60%(订阅有效用户中);限流场景不丢消息

---

- U12. **观测与运营基础**

**Goal:** 落地核心 Success Criteria 指标(WAR / 次晨打卡完成率 / 减肥目的占比反向)的埋点 + 仪表盘。

**Requirements:** Success Criteria 全部留存 / 反向定位指标

**Dependencies:** U1, U2, U4, U7

**Files:**
- Create: `mp/utils/tracker.ts`(前端埋点)
- Create: `server/src/api/v1/events.ts`、`server/src/services/analytics/`
- Create: `server/dashboard/` (Grafana / Metabase 配置占位)
- Test: `server/tests/integration/events.test.ts`

**Approach:**
- 前端埋点关键事件:onboarding_step_complete、photo_uploaded、checkin_step1_complete、checkin_step2_view、score_revealed、tab_findings_visit
- 后端事件入 ClickHouse 或 PostgreSQL JSONB(v1 选 PG 简化);批量批处理
- 仪表盘 v1 关键面板:WAR、次晨打卡完成率、新用户问卷"主要目标=减肥"占比、整体 DAU/WAU
- onboarding 反向定位 step1 结果数据按周聚合,> 30% 减肥触发 webhook 告警(Phase 2 自动文案审查在 Phase 3 才做)

**Test scenarios:**
- Happy path: 用户完成完整 onboarding + 第一餐 + 次晨打卡 → 6 个埋点事件入库
- Edge case: 客户端断网时埋点缓存 → 网络恢复批量上传
- Integration: 仪表盘读取 7 日聚合数据,WAR 计算正确

**Verification:** 仪表盘上线、4 个核心指标有数据流;告警 webhook 测试触发成功

---

---

- U13a. **今日推荐清单(actionable next-step)**

**Goal:** 在 U7 Step 3 火分揭晓后 + 主屏火分卡片下方,基于今日 / 近 3 日的发物倾向,给出"今日避开 X、Y、Z(具体食物名,2-4 个)+ 推荐 3 餐选项(平和食物,有典籍引用)"。

**Requirements:** 回应 product-lens F2(无 actionable next step)+ Origin "下一餐建议"承诺(R7 暗含)

**Dependencies:** U5(食物分类引擎)、U7、U8、U10

**Files:**
- Create: `mp/components/today-suggestion-card.tsx`、`server/src/services/recommend/`(today-list.ts、reverse-query.ts)
- Modify: `mp/pages/morning-check-in/step3-reveal.tsx`、`mp/pages/home/index.tsx`
- Test: `server/tests/integration/recommend.test.ts`

**Approach:**
- 反向查 `food_classifications` 表:今日"发"类条目的高频项 → 推荐避开;"平 + 温和"类的高频项 → 推荐采纳
- "今日避开"基于近 3 日累计的发物倾向,不是单次拍照
- "推荐 3 餐"按"早 / 午 / 晚"模板出 3 个组合,每个组合 3-4 食材,典籍引用展示
- 所有推荐只用群体维度(基于 onboarding baseline 聚类),不做个体化(那在 Phase 2)

**Test scenarios:**
- Happy path: 用户近 3 日吃了大量"发"类(海鲜+辣+油炸)→ 推荐"今日避开海鲜 / 麻辣 / 油炸,推荐清蒸鲈鱼 / 山药 / 白米粥"
- Edge case: 数据不足(累计 1 天)→ 显示通用平和食物模板
- Edge case: 用户全部食物都是"平"→ 推荐文案改为"继续保持"

**Verification:** Step 3 + 主屏卡片可显示推荐;推荐内容随近 3 日饮食变化

---

- U13b. **Day 30 体质档案 PDF v0.5(群体先验版)**

**Goal:** 把 Phase 2 PDF 提前到 Phase 1 末尾。**v0.5 PDF 不含 Bayesian 个体回归(那在 Phase 2 由 U14 替换)**,而是含:30 天 Yan-Score 趋势 + 用户的体检报告 OCR 结果(若有)+ 群体先验"和你近期症状类似的人群常见发物"+ 30 天饮食"发条目"top-N + 通用免责声明。Phase 2 个体版直接替换 v0.5。

**Requirements:** 回应 product-lens F1(承诺兑现节点)、Origin R24/R25(命名占位 PDF v0.5)

**Dependencies:** U5、U7、U8、U10、U13a

**Files:**
- Create: `server/src/services/pdf/`(generator.ts、template.html、puppeteer-runner.ts)
- Create: `mp/pages/profile-pdf/index.tsx`(下载 / 分享入口)
- Test: `server/tests/integration/pdf.test.ts`

**Approach:**
- 服务端 puppeteer 生成 PDF + 阿里云 OSS 存储 + 5 分钟签名 URL 下载
- v0.5 模板含:封面("第 30 天体质档案")+ Yan-Score 30 天趋势图 + 群体先验发物提示 + 用户近 30 天饮食"发"条目 top-5 + 体检对照(若有)+ 免责声明列出未扣除的混杂(R20)
- v0.5 名称使用占位 `<<体质档案命名占位>>`(R26)
- 微信分享:wx.shareAppMessage 直接分享 OSS 签名 URL 到聊天 / 朋友圈

**Test scenarios:**
- Happy path: 用户累计 30 天打卡 → 第 31 日推送"你的体质档案已生成" → 用户进入页面 → PDF 加载 + 下载 + 分享
- Edge case: 用户累计 < 30 天 → 页面显示"Day X / 30,还差 Y 天"
- Integration: PDF OSS 上传成功率 ≥ 99%;签名 URL 5 分钟内有效
- Covers AE: 30 天兑现节点

**Verification:** Day 30 用户成功生成 + 分享 PDF;v0.5 在 Phase 2 上线时无缝替换为个体 Bayesian 版

---

## System-Wide Impact

- **Interaction graph:** 微信小程序生命周期 (onLaunch / onShow) ↔ 后端 token 鉴权 ↔ 推送订阅状态;onboarding 状态机贯穿 5 屏跳转
- **Error propagation:** LLM 调用失败 → fallback → 用户友好提示;推送限流 → 队列重试;OCR 失败(Phase 2)→ 用户人工修正
- **State lifecycle risks:** 同意撤回后的数据软/硬删除时序;模板消息订阅过期重新申请;Step 1 中退的数据丢弃策略
- **API surface parity:** 食物分类 API 服务前端 v1 + 未来 Phase 2 反例反馈 + Phase 3 顾问委员会审核接口,需保留扩展位
- **Integration coverage:** Onboarding → 拍照 → 次晨打卡 → 主屏 全链路集成测试不可省;Yan-Score 算法 v0 单元测试覆盖各输入子集缺失降级路径
- **Unchanged invariants:** 食物条目数据 schema 双层(中医标签 + 西方营养)从 v1 起就保留,Phase 2 / Phase 3 算法升级不需要重做 schema

---

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| 豆包多模态对中餐 top-1 准确度 < 70% | ce-work 阶段 200 张 ground truth 样本评估;不达标切 Qwen-VL,双不达标考虑自训 |
| 中医典籍语料商用版权 | 法务参与;v1 用《本草纲目》(已超著作权保护期)语料为主;现代中医教材引用清理或改写 |
| 微信小程序模板消息触达率低(7 天有效订阅 + 用户授权率) | 引导设计反复优化;监控触达率 < 50% 时考虑公众号关注 + 推送备份通道 |
| 微信运动数据通道弱(单维度步数,无 HR/睡眠) | Yan-Score v0 ActivityPart 仅占 5%,缺失时降级良好;v1.5 评估补充 native app |
| 隐私合规 PIA 评估延期 | ce-work 阶段法务参与;v1 上线前完成 PIA;最低限"单独同意"已在 R5b 落地 |
| Day 30 截止前用户流失,Phase 2 PDF 价值兑现不到 | v1 主屏火分 + 中医语言已是日活锚;群体先验仪表占位提前展示"Day X / 30"进度感 |
| LLM 调用成本(豆包多模态按量计费) | v1 对每张照片做单次调用 + 缓存重复食物分类查询;月预估成本上线后优化 |
| 数据库密文字段加密对查询性能影响 | 仅敏感字段(symptoms / meal recognized_items)做应用层加密;查询/聚合仅在元数据层 |

---

## Phased Delivery

### Phase 1 — v1 MVP(19-20 周,本计划详细单元 U1-U12 + U13a + U13b)

**目标:** 验证「中医语言火分」核心日活机制,采集首批用户的双闭环数据,为 Phase 2 算法训练提供原料。

**关键里程碑(每 unit 工期较初版扩 ~30%,容纳 ce-doc-review 反馈的工程量低估、人工依赖、资质准备):**
- 第 1-5 周:U1-U3 工程基础 + 隐私合规(envelope encryption + 同意版本拦截 + 撤回 KMS 吊销)+ 阿里云 ICP 备案启动
- 第 6-9 周:U4 onboarding + U5 食物分类引擎 v1(典籍清理 + LLM 派生 + 人工 spot check 关键路径)
- 第 10-12 周:U6 拍照链路 + U7 次晨打卡两阶段 + U8 Yan-Score v0
- 第 13-14 周:U9 环境数据 + U10 主屏
- 第 15-16 周:U11 推送 + U12 观测 + Beta 测试上线 + PIA 法务报告交付
- 第 17-18 周:U13a 今日推荐清单 + U13b Day 30 体质档案 PDF v0.5
- 第 19-20 周:Beta 全量上线 + Day 30 兑现验证

**与初版 12 周对比的主要扩张原因(reviewer 共识):**
- U2 envelope encryption + Docker + RDS/OSS/KMS/Redis 部署 实际 2-3 周(原 1 周)
- U5 典籍语料法务清理 + 800-1500 食物 LLM 派生 + 人工 spot check 100-200 个 实际 2.5-3 周
- 微信小程序"健康/医疗"类目审核 + ICP 备案 = 不可压缩日历时间(并行启动)

### Phase 2 — 发物清单 + Day 30 PDF + 体检 OCR(8 周,Phase 1 上线后启动)

**单元概述:**
- U13. 群体先验聚类(基于 Phase 1 onboarding 7 维度数据)
- U14. Empirical Bayes shrinkage 个体回归引擎
- U15. 后台扣环境回归算法(R20)
- U16. Day 30 「<<体质档案命名占位>>」PDF 服务端生成 + 微信分享
- U17. 体检报告 OCR(阿里云通用文字识别)+ 字段校验 + 用户人工修正
- U18. 反例反馈通道(R23 选食物 + 标记)+ 误识别队列 fine-tune
- U19. R20b 周内趋势线启用(累计 21 天后)
- U20. **服务号备份推送通道**:引导用户关注服务号 + 服务号模板消息(无 7 天限制),Day 30 PDF 推送 + 周报为主动权益。覆盖模板消息触达率不足的场景

### Phase 3 — 顾问委员会接入 / 流派标注 / 反向定位自动化(12 周+)

- 中医顾问委员会 BD + 接入流程
- 食物分类引擎 v2(流派标注多分类输出)
- 反向定位投放素材自动审查机制
- Native app 评估 / 海外华人 / 英文版 评估

---

## Sources & References

- **Origin document:** [docs/brainstorms/2026-05-04-yanyan-tcm-inflammation-system-requirements.md](../brainstorms/2026-05-04-yanyan-tcm-inflammation-system-requirements.md)
- **STRATEGY.md:** [STRATEGY.md](../../STRATEGY.md)
- **上轮 ideation:** [docs/ideation/2026-05-04-yanyan-strategy-comparison-ideation.md](../ideation/2026-05-04-yanyan-strategy-comparison-ideation.md)
- 豆包多模态 SDK:火山引擎官方文档(待 ce-work 阶段确认 endpoint)
- 阿里云 RDS / OSS / KMS:阿里云官方文档
- 和风天气 API:商用许可
- 微信小程序模板消息:微信开放平台文档
