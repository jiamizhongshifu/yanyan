# 炎炎消防队 (Yanyan)

中医发物 / 上火语言的健康追踪 H5/PWA。

- **Live:** [https://web-psi-topaz-58.vercel.app](https://web-psi-topaz-58.vercel.app)
- **Strategy:** [STRATEGY.md](STRATEGY.md)
- **Phase 1 plan:** [docs/plans/2026-05-04-001-feat-yanyan-h5-mvp-plan.md](docs/plans/2026-05-04-001-feat-yanyan-h5-mvp-plan.md)
- **Phase 2 plan:** [docs/plans/2026-05-04-002-feat-yanyan-phase-2-plan.md](docs/plans/2026-05-04-002-feat-yanyan-phase-2-plan.md)

## 架构

单 Vercel 项目,前端 + 后端同 origin:

```
web/
├── src/             # 前端 Vite + React + Tailwind PWA
├── server/          # 后端业务代码(Fastify routes / services / db)
├── api/             # Vercel Serverless Functions
│   ├── [...slug].ts # Fastify catch-all → /api/v1/*
│   └── cron/        # Vercel Cron(每日次晨打卡推送)
├── tests/           # 后端 Jest 测试
├── scripts/         # 一次性 seed / 维护脚本
├── data/            # food-seed 等静态数据
└── public/          # 前端静态资产
```

后端通过 Supabase Postgres / Auth / Storage / Vault;真实接入 DeepSeek(文本)+ Qwen3.6-plus(视觉)。

## 本地开发

```bash
cd web
npm install
npm run dev          # 前端 :5173 + 自动代理 /api/* 到 :3000
npm run test         # 前端 vitest
npm run test:server  # 后端 jest
npm run build
```

部署 push 到 `main` 即触发 Vercel 自动部署。
