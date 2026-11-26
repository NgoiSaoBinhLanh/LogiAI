import assert from 'assert';
import http from 'http';
import { createApp } from '../src/app';
import { prisma } from '../src/config/database';
import { setCachedRbacProfile, CachedRbacProfile } from '../src/config/redis';
import { signAccessToken } from '../src/utils/jwt';

interface JsonEnvelope {
  success: boolean;
  data?: unknown;
  error?: { code: string; message: string };
}

async function requestJson(
  baseUrl: string,
  path: string,
  options: RequestInit = {}
): Promise<{ status: number; body: JsonEnvelope }> {
  const res = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const body = (await res.json()) as JsonEnvelope;
  return { status: res.status, body };
}

async function main(): Promise<void> {
  const app = createApp();
  const server = http.createServer(app);

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });

  const addr = server.address();
  assert(addr && typeof addr !== 'string', 'Failed to bind ephemeral port');
  const baseUrl = `http://127.0.0.1:${addr.port}`;

  try {
    console.log(`[E2E] Testing Express API on ${baseUrl}...`);

    // 1. Health check endpoint
    const health = await requestJson(baseUrl, '/api/health');
    assert.strictEqual(health.status, 200, 'Health check must return 200');
    assert.strictEqual(health.body.success, true, 'Health check success must be true');
    console.log('✓ 1. GET /api/health passed');

    // 2. Unauthenticated rejection across protected endpoints (401)
    const protectedEndpoints = [
      '/api/users',
      '/api/roles',
      '/api/permissions',
      '/api/branches',
      '/api/products',
      '/api/inventory/stocks',
      '/api/stock-checks',
      '/api/transfers',
      '/api/orders',
      '/api/orders/board',
      '/api/alerts',
      '/api/analytics/kpis',
      '/api/ai/transfer-suggestions',
      '/api/audit-logs',
    ];
    for (const ep of protectedEndpoints) {
      const r = await requestJson(baseUrl, ep);
      assert.strictEqual(r.status, 401, `${ep} must reject unauthenticated with 401`);
    }
    console.log(`✓ 2. All ${protectedEndpoints.length} protected endpoints enforce 401 Unauthorized`);

    // 3. Zod validation checks (400)
    const badLogin = await requestJson(baseUrl, '/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier: '', password: '' }),
    });
    assert.strictEqual(badLogin.status, 400, 'Empty login payload must return 400');
    assert.strictEqual(badLogin.body.error?.code, 'VALIDATION_ERROR');
    console.log('✓ 3. Zod validation rejects malformed input with 400 VALIDATION_ERROR');

    // 4. 404 Not Found check
    const notFound = await requestJson(baseUrl, '/api/non-existent-route');
    assert.strictEqual(notFound.status, 404, 'Unknown route must return 404');
    console.log('✓ 4. Unknown routes return standardized 404 NOT_FOUND');

    // 5. Dynamic RBAC enforcement (403 Forbidden vs Allowed) using live prisma stub
    const originalFindUnique = prisma.user.findUnique.bind(prisma.user);
    const staffProfile: CachedRbacProfile = {
      userId: '999',
      username: 'e2e_staff',
      email: 'staff@e2e.local',
      fullName: 'E2E Warehouse Staff',
      branchId: '1',
      branchName: 'HCM Hub',
      roleId: '3',
      roleCode: 'WAREHOUSE_STAFF',
      roles: ['WAREHOUSE_STAFF'],
      permissions: ['BRANCH_READ', 'PRODUCT_READ', 'STOCK_READ', 'TICKET_CREATE'],
      permissionVersion: 1,
      status: 'ACTIVE',
    };

    // Stub user.findUnique for RBAC verification without requiring live Docker Postgres
    (prisma.user as unknown as { findUnique: () => Promise<unknown> }).findUnique = async () => ({
      id: BigInt(999),
      username: staffProfile.username,
      email: staffProfile.email,
      fullName: staffProfile.fullName,
      branchId: BigInt(1),
      roleId: BigInt(3),
      permissionVersion: 1,
      status: 'ACTIVE',
      branch: { id: BigInt(1), name: 'HCM Hub' },
      role: {
        roleCode: 'WAREHOUSE_STAFF',
        rolePermissions: staffProfile.permissions.map((code) => ({ permission: { code } })),
      },
      userRoles: [],
    });

    await setCachedRbacProfile(staffProfile);
    const staffToken = signAccessToken({
      sub: '999',
      username: 'e2e_staff',
      roleCode: 'WAREHOUSE_STAFF',
      permissionVersion: 1,
    });

    const rbacForbiddenCases = [
      { method: 'GET', path: '/api/roles' },
      { method: 'POST', path: '/api/users' },
      { method: 'GET', path: '/api/audit-logs' },
      { method: 'POST', path: '/api/stock-checks/1/approve' },
      { method: 'POST', path: '/api/transfers/1/approve' },
    ];
    for (const c of rbacForbiddenCases) {
      const r = await requestJson(baseUrl, c.path, {
        method: c.method,
        headers: { Authorization: `Bearer ${staffToken}` },
      });
      assert.strictEqual(r.status, 403, `${c.method} ${c.path} must return 403 for WAREHOUSE_STAFF`);
    }
    console.log('✓ 5. Dynamic RBAC strictly enforces 403 Forbidden for unauthorized actions');

    // 6. Invalid BigInt ID handling (400 instead of 500)
    const badIdRes = await requestJson(baseUrl, '/api/orders/not-a-number/stage', {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${staffToken}` },
      body: JSON.stringify({ status: 'PACKING' }),
    });
    assert.strictEqual(badIdRes.status, 400, 'Invalid BigInt :id must return 400');
    console.log('✓ 6. Invalid BigInt :id parameter returns clean 400 BAD_REQUEST');

    // Restore original prisma method
    (prisma.user as unknown as { findUnique: typeof originalFindUnique }).findUnique =
      originalFindUnique;

    console.log('\nALL E2E VERIFICATION CHECKS PASSED SUCCESSFULLY!');
  } finally {
    server.close();
  }
}

main().catch((err) => {
  console.error('E2E Verification failed:', err);
  process.exit(1);
});
