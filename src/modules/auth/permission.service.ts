import { supabase } from '@/lib/supabaseClient';

export interface Role {
  id: string;
  name: string;
  permissions: string[];
}

class PermissionService {
  private roleCache: Map<string, Role> = new Map(); // userId -> Role

  /**
   * Check if a user has a specific permission.
   * Caches permissions for the session to reduce DB load.
   */
  async hasPermission(userId: string, permissionCode: string): Promise<boolean> {
    const role = await this.getUserRole(userId);
    if (!role) return false;

    // Admin/Founder usually has all
    if (role.name === 'Founder' || role.name === 'Admin') return true;

    return role.permissions.includes(permissionCode);
  }

  /**
   * Get user's role and associated permissions from the DB.
   * Using the new RBAC tables: firm_users -> role_id -> role_permissions -> permission_code
   */
  async getUserRole(userId: string): Promise<Role | null> {
    // 1. Check Cache
    if (this.roleCache.has(userId)) return this.roleCache.get(userId)!;

    // 2. Fetch from DB
    // First, get the user's role_id from firm_users (assuming current active firm context or pass firmId)
    // For simplicity, assuming user is linked to ONE active firm role or we check active firm context
    // This query is simplified; in a real multi-firm context, we need firm_id.
    // Let's assume we pass firmId or fetch the user's active firm role.
    
    // Fetch user's role_id
    const { data: userRoleData, error: userError } = await supabase
      .from('firm_users')
      .select('role_id, roles(name)')
      .eq('user_id', userId)
      .eq('is_active', true)
      .single();

    if (userError || !userRoleData?.role_id) {
      // Fallback: Check profiles.role (legacy string)
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', userId).single();
      if (profile) {
        // Map legacy string roles to permissions manually if needed
        return this.mapLegacyRole(profile.role);
      }
      return null;
    }

    const roleId = userRoleData.role_id;
    const roleName = userRoleData.roles?.name || 'Unknown';

    // Fetch permissions for this role
    const { data: permsData, error: permError } = await supabase
      .from('role_permissions')
      .select('permissions(code)')
      .eq('role_id', roleId);

    if (permError) {
      console.error('Permission fetch error', permError);
      return null;
    }

    const permissions = permsData.map((p: any) => p.permissions.code);
    
    const role: Role = {
      id: roleId,
      name: roleName,
      permissions
    };

    // Cache
    this.roleCache.set(userId, role);
    return role;
  }

  private mapLegacyRole(roleName: string): Role {
    // Temporary mapping for legacy profiles.role column
    const permissions: string[] = [];
    if (roleName === 'Founder' || roleName === 'Partner') {
      permissions.push('pv.create', 'pv.approve', 'pv.view', 'einvoice.submit', 'audit.view');
    } else if (roleName === 'Senior Lawyer') {
      permissions.push('pv.create', 'pv.view', 'case.edit');
    } else if (roleName === 'Clerk') {
      permissions.push('pv.create', 'pv.view', 'case.create');
    }

    return {
      id: 'legacy',
      name: roleName,
      permissions
    };
  }

  clearCache(userId: string) {
    this.roleCache.delete(userId);
  }
}

export const permissionService = new PermissionService();
