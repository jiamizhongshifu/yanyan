/**
 * Auth resolver 测试
 *
 * 验证三条:
 *   - SupabaseJwtAuthResolver 接受合法 JWT,拒绝过期 / 错签 / role=anon
 *   - DevHeaderAuthResolver 读 X-User-Id
 *   - CompositeAuthResolver 顺序尝试,JWT 优先于 dev header
 */

import { SignJWT } from 'jose';
import {
  SupabaseJwtAuthResolver,
  DevHeaderAuthResolver,
  CompositeAuthResolver
} from '../../server/auth';

const SECRET = '0123456789abcdef0123456789abcdef';

async function makeJwt(payload: Record<string, unknown>, expiresIn = '1h'): Promise<string> {
  const secretBuf = new TextEncoder().encode(SECRET);
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(secretBuf);
}

describe('U2 auth — SupabaseJwtAuthResolver', () => {
  test('valid JWT with role=authenticated → returns userId from sub', async () => {
    const r = new SupabaseJwtAuthResolver(SECRET);
    const jwt = await makeJwt({ sub: 'u-jwt-1', role: 'authenticated' });
    const result = await r.resolve({ authorization: `Bearer ${jwt}` });
    expect(result).toEqual({ userId: 'u-jwt-1', source: 'supabase_jwt' });
  });

  test('valid JWT with role=service_role → marked as service source', async () => {
    const r = new SupabaseJwtAuthResolver(SECRET);
    const jwt = await makeJwt({ sub: 'u-svc', role: 'service_role' });
    const result = await r.resolve({ authorization: `Bearer ${jwt}` });
    expect(result?.source).toBe('service');
  });

  test('JWT with role=anon → null (拒绝匿名 role)', async () => {
    const r = new SupabaseJwtAuthResolver(SECRET);
    const jwt = await makeJwt({ sub: 'anon-user', role: 'anon' });
    const result = await r.resolve({ authorization: `Bearer ${jwt}` });
    expect(result).toBeNull();
  });

  test('JWT signed with different secret → null', async () => {
    const r = new SupabaseJwtAuthResolver(SECRET);
    const wrongSecret = 'fedcba9876543210fedcba9876543210';
    const wrongBuf = new TextEncoder().encode(wrongSecret);
    const jwt = await new SignJWT({ sub: 'u-1', role: 'authenticated' })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('1h')
      .sign(wrongBuf);
    const result = await r.resolve({ authorization: `Bearer ${jwt}` });
    expect(result).toBeNull();
  });

  test('expired JWT → null', async () => {
    const r = new SupabaseJwtAuthResolver(SECRET);
    const jwt = await makeJwt({ sub: 'u-expired', role: 'authenticated' }, '-1s');
    const result = await r.resolve({ authorization: `Bearer ${jwt}` });
    expect(result).toBeNull();
  });

  test('missing Authorization header → null', async () => {
    const r = new SupabaseJwtAuthResolver(SECRET);
    expect(await r.resolve({})).toBeNull();
  });

  test('non-Bearer Authorization → null', async () => {
    const r = new SupabaseJwtAuthResolver(SECRET);
    expect(await r.resolve({ authorization: 'Basic abc' })).toBeNull();
  });

  test('JWT without sub → null', async () => {
    const r = new SupabaseJwtAuthResolver(SECRET);
    const jwt = await makeJwt({ role: 'authenticated' });
    const result = await r.resolve({ authorization: `Bearer ${jwt}` });
    expect(result).toBeNull();
  });

  test('constructor rejects too-short secret', () => {
    expect(() => new SupabaseJwtAuthResolver('short')).toThrow();
  });
});

describe('U2 auth — DevHeaderAuthResolver', () => {
  test('X-User-Id header → returns userId with source=dev_header', async () => {
    const r = new DevHeaderAuthResolver();
    expect(await r.resolve({ 'x-user-id': 'u-dev-1' })).toEqual({
      userId: 'u-dev-1',
      source: 'dev_header'
    });
  });

  test('missing header → null', async () => {
    const r = new DevHeaderAuthResolver();
    expect(await r.resolve({})).toBeNull();
  });
});

describe('U2 auth — CompositeAuthResolver', () => {
  test('JWT-first composite: valid JWT wins over X-User-Id header', async () => {
    const composite = new CompositeAuthResolver([
      new SupabaseJwtAuthResolver(SECRET),
      new DevHeaderAuthResolver()
    ]);
    const jwt = await makeJwt({ sub: 'u-jwt', role: 'authenticated' });
    const result = await composite.resolve({
      authorization: `Bearer ${jwt}`,
      'x-user-id': 'u-dev'
    });
    expect(result?.userId).toBe('u-jwt');
    expect(result?.source).toBe('supabase_jwt');
  });

  test('falls back to dev header when JWT absent', async () => {
    const composite = new CompositeAuthResolver([
      new SupabaseJwtAuthResolver(SECRET),
      new DevHeaderAuthResolver()
    ]);
    const result = await composite.resolve({ 'x-user-id': 'u-dev' });
    expect(result?.userId).toBe('u-dev');
    expect(result?.source).toBe('dev_header');
  });

  test('returns null when all resolvers fail', async () => {
    const composite = new CompositeAuthResolver([
      new SupabaseJwtAuthResolver(SECRET),
      new DevHeaderAuthResolver()
    ]);
    expect(await composite.resolve({})).toBeNull();
  });
});
