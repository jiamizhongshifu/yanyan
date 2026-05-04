import '@testing-library/jest-dom/vitest';

// Vitest 在 jsdom 里跑;默认 fetch 走真实网络,我们在每个测试里 mock fetch 避免真实网络调用
