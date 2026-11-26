export interface RouteRbacRule {
  prefix: string;
  anyPermissions: string[];
}

export const ROUTE_RBAC_RULES: RouteRbacRule[] = [
  { prefix: '/dashboard', anyPermissions: ['STOCK_READ', 'ORDER_READ', 'BRANCH_READ'] },
  { prefix: '/users', anyPermissions: ['USER_READ', 'USER_WRITE'] },
  { prefix: '/settings/rbac', anyPermissions: ['ROLE_MANAGE'] },
  { prefix: '/branches', anyPermissions: ['BRANCH_READ', 'BRANCH_WRITE'] },
  { prefix: '/audit-logs', anyPermissions: ['AUDIT_READ'] },
  { prefix: '/products', anyPermissions: ['PRODUCT_READ', 'PRODUCT_WRITE'] },
  { prefix: '/inventory', anyPermissions: ['STOCK_READ', 'TICKET_CREATE'] },
  { prefix: '/transfers', anyPermissions: ['TRANSFER_TRACK', 'TICKET_CREATE'] },
  { prefix: '/orders', anyPermissions: ['ORDER_READ', 'ORDER_ALLOCATE'] },
  { prefix: '/approvals', anyPermissions: ['TICKET_APPROVE'] },
  { prefix: '/ai', anyPermissions: ['ALERT_MANAGE', 'TRANSFER_TRACK', 'STOCK_READ'] },
  { prefix: '/alerts', anyPermissions: ['ALERT_MANAGE', 'STOCK_READ', 'ORDER_READ', 'TRANSFER_TRACK'] },
];

export const PUBLIC_ROUTES = ['/login', '/forgot-password', '/forbidden', '/api-health'];

export function isRouteAllowed(
  pathname: string,
  roles: string[],
  permissions: string[]
): boolean {
  if (roles.includes('ADMIN')) return true;

  const matchedRule = ROUTE_RBAC_RULES.find((rule) => pathname.startsWith(rule.prefix));
  if (!matchedRule) return true;

  return matchedRule.anyPermissions.some((perm) => permissions.includes(perm));
}
