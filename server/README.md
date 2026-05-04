# Yanyan 后端 (server/)

Node.js + Fastify + PostgreSQL,部署到阿里云华东。

## 工程

```bash
npm install
npm run typecheck     # tsc --noEmit
npm run lint          # eslint src tests
npm test              # jest

# 开发
cp .env.example .env  # 填本地 PG / KMS local key
npm run migrate       # 应用 schema.sql(idempotent)
npm run dev           # ts-node-dev hot-reload

# 生产
npm run build && npm start
docker build -t yanyan-server . && docker run --env-file .env -p 3000:3000 yanyan-server
```

## 关键设计

- **Envelope encryption**: `users.dek_ciphertext_b64` 存放 KMS 主密钥包装的 DEK;`meals.recognized_items_ciphertext` / `symptoms.blind_input_ciphertext` 等敏感字段由 DEK 做 AES-256-GCM。本地开发用 `LocalKmsStub`,生产切阿里云 KMS。详见 `src/crypto/`。
- **双层食物分类**: `food_classifications` 同时存中医标签(发/温和/平 + 寒热温凉 + 典籍引用)与西方营养连续值(DII/AGEs/GI)。v1 前端只读中医层,西方层为 Phase 2 算法 / Phase 3 出海预留。
- **Schema versioning**: `symptoms.definition_version` 标识当时的滑块档位定义版本;换版后趋势分析仅在同版本数据内绘制,避免历史数据语义漂变。
- **隐私同意 5 scope**: health_data / medical_report / photo_ai / location / subscribe_push,覆盖《个保法》第 28 条全部敏感个人信息子类。

## 目录结构

```
src/
  app.ts          # Fastify 应用工厂(可被测试 inject)
  server.ts       # 进程入口(listen + 优雅关闭)
  config.ts       # zod 校验环境变量
  db/
    schema.sql    # 全表 DDL(idempotent)
    client.ts     # pg pool 单例 + pingDb
    migrate.ts    # 启动时执行 schema.sql
  crypto/
    kms.ts        # KmsClient 接口 + LocalKmsStub + AliyunKmsClient(占位)
    envelope.ts   # 字段级 AES-256-GCM 加解密 + DEK LRU 缓存
  api/v1/
    health.ts     # /health, /health/db
    index.ts      # 路由汇总
  services/
    users/        # U3 接入
    consents/     # U3 接入
    meals/        # U6 接入
    symptoms/     # U7 接入
    score/        # U8 接入
tests/
  setup.ts                          # 测试环境注入 ENV
  integration/api.smoke.test.ts     # /health 启动测试
  db/schema.test.ts                 # SQL schema 完整性测试
  crypto/envelope.test.ts           # envelope encrypt / decrypt round-trip + 撤回吊销
```

## 待 ce-work 接入(plan U2 Deferred to Implementation)

- 阿里云 KMS SDK 接入(替换 `AliyunKmsClient` 占位)
- 阿里云 RDS PG 实例配置 + 主从读写分离
- 阿里云 OSS bucket + 私有 ACL + 短期 STS
- ICP 备案完成
- 微信小程序"健康/医疗"类目审核
- PIA 法务报告(隐私合规决策套件,见 plan Outstanding Questions)
