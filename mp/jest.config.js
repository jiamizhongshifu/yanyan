/** Jest 配置
 * 微信小程序原生环境的 wx / App / Page / getApp 等全局对象在测试环境需要 mock。
 * 本 U1 阶段只验证脚手架 + 测试框架可启动 — 后续 unit 增加更细的 wx mock。
 */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['<rootDir>/tests/**/*.test.ts'],
  setupFiles: ['<rootDir>/tests/setup.ts'],
  collectCoverageFrom: [
    '**/*.ts',
    '!**/*.d.ts',
    '!tests/**',
    '!dist/**',
    '!node_modules/**',
    '!jest.config.js'
  ],
  moduleFileExtensions: ['ts', 'js', 'json']
};
