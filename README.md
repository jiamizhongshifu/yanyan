# 炎炎消防队 (Yanyan)

中医发物 × 次晨体感:用现代数据闭环重写中医的「食物→次日体感」系统。

详见:
- [STRATEGY.md](STRATEGY.md) — 战略与定位
- [需求文档](docs/brainstorms/2026-05-04-yanyan-tcm-inflammation-system-requirements.md) — 详细 R/F/AE
- [实施计划](docs/plans/2026-05-04-001-feat-yanyan-h5-mvp-plan.md) — 14 单元 19-20 周 MVP

## 仓库结构

```
mp/                              # 微信小程序前端 (本次 U1 已搭建脚手架)
  app.ts / app.json / app.wxss   # 小程序入口
  pages/                         # 页面
  components/                    # 通用组件 (待 U4-U10 填充)
  services/                      # API 层
  utils/                         # 通用工具
  tests/                         # Jest 单测
server/                          # Node.js + Fastify 后端 (待 U2)
docs/                            # 战略 / 需求 / 计划 / ideation 文档
```

## 微信小程序开发(mp/)

```bash
cd mp
npm install                # 安装依赖
npm run typecheck          # TypeScript 校验
npm run lint               # ESLint
npm test                   # Jest smoke 测试
```

### 开发者工具导入
1. 微信开发者工具 → 导入项目 → 选择 `mp/` 目录
2. AppID:首次接入需在 `mp/project.config.json` 替换 `TODO_REPLACE_WITH_REAL_APPID`
3. 后端 API:在 `mp/app.ts` 的 `apiBaseUrl` 替换 `TODO_REPLACE_WITH_REAL_API`

## 当前进度

- [x] U1 微信小程序基础工程脚手架(本提交)
- [ ] U2 后端服务基础脚手架 + 数据 schema
- [ ] U3-U13b 见 [实施计划](docs/plans/2026-05-04-001-feat-yanyan-h5-mvp-plan.md)
