/**
 * Envelope encryption round-trip + 撤回吊销路径
 *
 * 对应 plan U2 测试场景:
 *   - Integration: 创建用户 → 写一条 meal → 读出来,双层标签字段保留(此处验证加解密 round-trip)
 *   - Edge case: 密文字段写入后无密钥读取报错(此处用撤回吊销模拟)
 */

import { getKms, resetKmsForTesting } from '../../src/crypto/kms';
import { encryptField, decryptField, clearDekCacheForTesting, evictDekFromCache } from '../../src/crypto/envelope';

describe('U2 envelope encryption', () => {
  beforeEach(() => {
    resetKmsForTesting();
    clearDekCacheForTesting();
  });

  test('round-trip: encrypt then decrypt returns original payload', async () => {
    const kms = getKms();
    const userId = 'user-1';
    const dataKey = await kms.generateDataKey(userId);
    const dekCiphertextB64 = dataKey.ciphertext.toString('base64');

    const payload = { foods: ['清蒸鲈鱼', '西兰花'], severity: { 鼻塞: 2, 口干: 1 } };
    const ciphertext = await encryptField(userId, dekCiphertextB64, payload);
    expect(ciphertext).not.toContain('清蒸鲈鱼');

    const decrypted = await decryptField(userId, dekCiphertextB64, ciphertext);
    expect(decrypted).toEqual(payload);
  });

  test('AAD binds DEK to userId — different user cannot decrypt', async () => {
    const kms = getKms();
    const userA = 'user-A';
    const userB = 'user-B';
    const dekA = await kms.generateDataKey(userA);

    // 把 A 的 DEK 密文交给 B 解,KMS AAD 应该校验失败
    await expect(kms.decryptDataKey(userB, dekA.ciphertext)).rejects.toThrow();
  });

  test('revocation: scheduleKeyDeletion makes future decryptDataKey fail', async () => {
    const kms = getKms();
    const userId = 'user-revoke';
    const dataKey = await kms.generateDataKey(userId);
    const dekCiphertextB64 = dataKey.ciphertext.toString('base64');

    const ciphertext = await encryptField(userId, dekCiphertextB64, { foo: 'bar' });

    // 撤回:KMS 吊销 + 缓存 evict(plan U3 撤回流程)
    await kms.scheduleKeyDeletion(userId);
    evictDekFromCache(userId);

    await expect(decryptField(userId, dekCiphertextB64, ciphertext)).rejects.toThrow(/revoked/);
  });

  test('cache hit: second decrypt does not re-call KMS', async () => {
    const kms = getKms();
    const userId = 'user-cache';
    const dataKey = await kms.generateDataKey(userId);
    const dekCiphertextB64 = dataKey.ciphertext.toString('base64');

    const ct1 = await encryptField(userId, dekCiphertextB64, { a: 1 });
    const ct2 = await encryptField(userId, dekCiphertextB64, { b: 2 });

    const spy = jest.spyOn(kms, 'decryptDataKey');
    await decryptField(userId, dekCiphertextB64, ct1);
    await decryptField(userId, dekCiphertextB64, ct2);
    // 第一次 encryptField 已 populate cache;后续 decrypt 应全部命中缓存
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
