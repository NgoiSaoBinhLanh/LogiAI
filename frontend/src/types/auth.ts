export interface UserProfile {
  userId: string;
  username: string;
  email: string;
  fullName: string;
  branchId: string | null;
  branchName: string | null;
  roleId: string;
  roleCode: string;
  roles: string[];
  permissions: string[];
  permissionVersion: number;
  status: string;
}

export interface PermissionItem {
  id: string;
  code: string;
  name: string;
  module: string;
  description: string | null;
}

export interface RoleItem {
  id: string;
  roleCode: string;
  roleName: string;
  description: string | null;
  permissionVersion: number;
  updatedAt: string;
  userCount: number;
  permissions: string[];
}

export interface BranchSummary {
  id: string;
  code: string;
  name: string;
  branchType: 'HUB' | 'SATELLITE' | 'STORE';
  status: string;
  address: string;
}

export interface UserAccountItem {
  id: string;
  username: string;
  email: string;
  fullName: string;
  phone: string;
  branchId: string | null;
  roleId: string;
  status: 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE' | 'SUSPENDED';
  permissionVersion: number;
  createdAt: string;
  branch: { id: string; code: string; name: string } | null;
  role: { id: string; roleCode: string; roleName: string };
}

export interface LoginPayload {
  identifier: string;
  password: string;
  rememberMe?: boolean;
}
