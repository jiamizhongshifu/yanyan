# Yanyan Web (web/)

H5/PWA 前端,部署到 **Vercel**,数据走 **Supabase**。

## 工程

```bash
npm install
npm run dev          # vite dev server @ localhost:5173,API 代理到 :3000
npm test             # vitest 跑 smoke 测试
npm run typecheck    # tsc --noEmit
npm run lint         # eslint
npm run build        # 生产构建到 dist/
npm run preview      # 预览构建产物
```

## 环境变量

`.env.local`(开发)/ Vercel 项目设置(生产):

```
VITE_API_BASE=/api/v1
VITE_SUPABASE_URL=https://<project>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>
```

## 关键决策

- **平台**:H5/PWA (Vite + React 18 + TS + Tailwind);**不是微信小程序**(2026-05-04 pivot)
- **PWA**:`vite-plugin-pwa` autoUpdate;运行时缓存 `/api/v1` 走 NetworkFirst (5s 超时降级)
- **状态**:zustand 轻量;无大型状态管理框架
- **路由**:wouter(2KB,够用)
- **Auth**:Supabase Auth(短信 OTP / 微信 OAuth Web),后续 U3 接入
- **拍照**:`<input type="file" accept="image/*" capture="environment">` + `getUserMedia` API
- **合规警告**:Supabase 境外存储健康数据,v1 仅私人 beta 邀请制;PMF 后迁阿里云华东(plan 已记入)

## 当前进度

- [x] U1-redo 工程脚手架(本提交,3 个 commits 后):Vite + React + Tailwind + PWA + smoke 测试
- [ ] U2 后端(server/)迁移 Vercel Functions + Supabase Postgres(下一 unit)
- [ ] U3-U13b 前端见 [实施计划](../docs/plans/2026-05-04-001-feat-yanyan-h5-mvp-plan.md)

## 部署到 Vercel

```bash
# 首次
vercel link
vercel env add VITE_SUPABASE_URL
vercel env add VITE_SUPABASE_ANON_KEY

# 部署
vercel --prod
```

## 微信内打开兼容性

- iOS 微信内置浏览器:WKWebView,不支持 PWA "加到主屏幕" → 引导用户用 Safari 打开
- Android 微信:X5 内核,部分 PWA API 受限 → 降级为普通 H5 体验
- 都不影响核心功能(拍照、登录、打卡)
