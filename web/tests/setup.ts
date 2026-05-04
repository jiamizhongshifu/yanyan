/**
 * Jest 测试环境配置
 *
 * 注入测试用 ENV;允许各 test 自行覆盖。LocalKmsStub 用一个固定 master key,跨测试可重现。
 */

process.env.NODE_ENV = 'test';
process.env.PORT = '0'; // 测试时不绑定端口
process.env.HOST = '127.0.0.1';
process.env.DATABASE_URL = process.env.DATABASE_URL ?? 'postgres://yanyan_test:test@localhost:5432/yanyan_test';
process.env.KMS_MODE = 'local';
process.env.KMS_LOCAL_MASTER_KEY = process.env.KMS_LOCAL_MASTER_KEY ?? '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
