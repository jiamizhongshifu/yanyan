/**
 * Phase 2 U10 — kms_version byte + EnvelopeKmsClient cross-version 测试
 */

import {
  EnvelopeKmsClient,
  KMS_VERSION_LOCAL_ENV,
  KMS_VERSION_VAULT,
  LocalEnvMasterSource,
  type MasterKeySource
} from '../../server/crypto/kms';
import { randomBytes } from 'crypto';

class FakeMasterSource implements MasterKeySource {
  constructor(public readonly version: number, private key: Buffer) {}
  async getMasterKey(): Promise<Buffer> {
    return this.key;
  }
}

describe('U10 kms version byte', () => {
  const masterA = randomBytes(32);
  const masterB = randomBytes(32);
  const sourceA = new FakeMasterSource(KMS_VERSION_LOCAL_ENV, masterA);
  const sourceB = new FakeMasterSource(KMS_VERSION_VAULT, masterB);

  test('write 时 ciphertext 第一字节 = writeSource.version', async () => {
    const sources = new Map<number, MasterKeySource>();
    sources.set(KMS_VERSION_VAULT, sourceB);
    sources.set(KMS_VERSION_LOCAL_ENV, sourceA);
    const kms = new EnvelopeKmsClient(sourceB, sources);

    const dk = await kms.generateDataKey('u1');
    expect(dk.ciphertext[0]).toBe(KMS_VERSION_VAULT);
  });

  test('writeSource = vault,readSources 含 local + vault → 两版本都能读', async () => {
    const sources = new Map<number, MasterKeySource>();
    sources.set(KMS_VERSION_LOCAL_ENV, sourceA);
    sources.set(KMS_VERSION_VAULT, sourceB);
    const kms = new EnvelopeKmsClient(sourceB, sources);

    // 用 sourceA(0x00)生成一个旧版本 ciphertext(模拟 Phase 1 数据)
    const oldKms = new EnvelopeKmsClient(sourceA, sources);
    const oldDk = await oldKms.generateDataKey('u1');
    expect(oldDk.ciphertext[0]).toBe(KMS_VERSION_LOCAL_ENV);

    // 用新 client(writer=vault)解旧 ciphertext
    const decrypted = await kms.decryptDataKey('u1', oldDk.ciphertext);
    expect(decrypted.equals(oldDk.plaintext)).toBe(true);
  });

  test('未知版本 0xFF → throw unknown_kms_version', async () => {
    const sources = new Map<number, MasterKeySource>();
    sources.set(KMS_VERSION_LOCAL_ENV, sourceA);
    const kms = new EnvelopeKmsClient(sourceA, sources);

    const fakeCiphertext = Buffer.concat([Buffer.from([0xff]), randomBytes(60)]);
    await expect(kms.decryptDataKey('u1', fakeCiphertext)).rejects.toThrow(/unknown_kms_version/);
  });

  test('AAD 仍绑 userId(跨用户解密失败)', async () => {
    const sources = new Map<number, MasterKeySource>();
    sources.set(KMS_VERSION_LOCAL_ENV, sourceA);
    const kms = new EnvelopeKmsClient(sourceA, sources);

    const dkA = await kms.generateDataKey('userA');
    await expect(kms.decryptDataKey('userB', dkA.ciphertext)).rejects.toThrow();
  });

  test('scheduleKeyDeletion 后 decrypt 拒绝', async () => {
    const sources = new Map<number, MasterKeySource>();
    sources.set(KMS_VERSION_LOCAL_ENV, sourceA);
    const kms = new EnvelopeKmsClient(sourceA, sources);

    const dk = await kms.generateDataKey('u1');
    await kms.scheduleKeyDeletion('u1');
    await expect(kms.decryptDataKey('u1', dk.ciphertext)).rejects.toThrow(/revoked/);
  });

  test('writeSource 未在 readSources 中 → 自动加入(防忘记声明)', async () => {
    const sources = new Map<number, MasterKeySource>();
    // 故意只放 sourceA;writeSource 是 sourceB
    sources.set(KMS_VERSION_LOCAL_ENV, sourceA);
    const kms = new EnvelopeKmsClient(sourceB, sources);
    const dk = await kms.generateDataKey('u1');
    // 应能解 — 因为构造器自动把 writeSource 加进 readSources
    const decrypted = await kms.decryptDataKey('u1', dk.ciphertext);
    expect(decrypted.equals(dk.plaintext)).toBe(true);
  });
});

describe('U10 LocalEnvMasterSource', () => {
  test('LocalEnvMasterSource version=0x00 + 缺 env throws', async () => {
    const orig = process.env.KMS_LOCAL_MASTER_KEY;
    delete process.env.KMS_LOCAL_MASTER_KEY;
    // 重置 config cache 让重读
    const { resetConfigForTesting } = await import('../../server/config');
    resetConfigForTesting();
    // 设最低必填 env 让 config 不在其他校验上失败
    process.env.DATABASE_URL = 'postgres://localhost/x?sslmode=require';
    process.env.KMS_MODE = 'local';
    const src = new LocalEnvMasterSource();
    expect(src.version).toBe(KMS_VERSION_LOCAL_ENV);
    await expect(src.getMasterKey()).rejects.toThrow();
    if (orig) process.env.KMS_LOCAL_MASTER_KEY = orig;
    resetConfigForTesting();
  });
});
