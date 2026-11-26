import {
  BranchSummary,
  LoginPayload,
  PermissionItem,
  RoleItem,
  UserAccountItem,
  UserProfile,
} from '../types/auth';
import { apiFetch } from './api';

export interface AuthSessionResponse {
  accessToken: string;
  user: UserProfile;
}

export interface PaginatedUsersResponse {
  items: UserAccountItem[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export const AuthApi = {
  login: (payload: LoginPayload) =>
    apiFetch<AuthSessionResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  refresh: () =>
    apiFetch<AuthSessionResponse>('/api/auth/refresh', {
      method: 'POST',
    }, false),

  logout: () =>
    apiFetch<null>('/api/auth/logout', {
      method: 'POST',
    }),

  me: () => apiFetch<{ user: UserProfile }>('/api/auth/me'),

  forgotPassword: (email: string) =>
    apiFetch<{ email: string }>('/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),
};

export const UsersApi = {
  list: (params: Record<string, string | number | undefined>) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== '') qs.set(k, String(v));
    });
    const query = qs.toString();
    return apiFetch<PaginatedUsersResponse>(`/api/users${query ? `?${query}` : ''}`);
  },

  create: (payload: {
    username: string;
    email: string;
    fullName: string;
    phone: string;
    password?: string;
    branchId: string | null;
    roleId: string;
    sendEmail?: boolean;
  }) =>
    apiFetch<{ user: UserAccountItem; temporaryPassword?: string }>('/api/users', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  update: (
    id: string,
    payload: {
      fullName?: string;
      phone?: string;
      email?: string;
      branchId?: string | null;
      roleId?: string;
    }
  ) =>
    apiFetch<{ user: UserAccountItem }>(`/api/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  updateStatus: (id: string, status: 'ACTIVE' | 'SUSPENDED' | 'INACTIVE') =>
    apiFetch<{ user: { id: string; status: string } }>(`/api/users/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
};

export const RbacApi = {
  listPermissions: () => apiFetch<{ permissions: PermissionItem[] }>('/api/permissions'),
  listRoles: () => apiFetch<{ roles: RoleItem[] }>('/api/roles'),
  createRole: (payload: { roleCode: string; roleName: string; description?: string }) =>
    apiFetch<{ role: RoleItem }>('/api/roles', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  cloneRole: (
    sourceId: string,
    payload: { roleCode: string; roleName: string; description?: string }
  ) =>
    apiFetch<{ role: RoleItem }>(`/api/roles/${sourceId}/clone`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateRolePermissions: (roleId: string, permissionCodes: string[]) =>
    apiFetch<{ roleId: string; permissions: string[]; affectedUsersCount: number }>(
      `/api/roles/${roleId}/permissions`,
      {
        method: 'PUT',
        body: JSON.stringify({ permissionCodes, otpVerified: true }),
      }
    ),
  resetRoleDefault: (roleId: string) =>
    apiFetch<{ roleId: string; permissions: string[] }>(`/api/roles/${roleId}/reset-default`, {
      method: 'POST',
    }),
};

export const BranchesApi = {
  list: () => apiFetch<{ branches: BranchSummary[] }>('/api/branches'),
};
