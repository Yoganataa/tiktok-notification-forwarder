// src/services/permission.ts
import { prisma } from '../lib/prisma';
import { ROLES, UserRole } from '../types';
import { config } from '../config';

export class PermissionService {
  /**
   * Get user role based on user ID
   */
  async getUserRole(userId: string): Promise<UserRole> {
    if (userId === config.ownerId) return ROLES.OWNER; 

    const access = await prisma.accessControl.findUnique({
      where: { userId }
    });

    if (access) {
      return access.role as UserRole;
    }

    return ROLES.USER;
  }

  /**
   * Check if user is Admin or higher
   */
  async isAdminOrHigher(userId: string): Promise<boolean> {
    const role = await this.getUserRole(userId);
    return role === ROLES.OWNER || role === ROLES.ADMIN;
  }

  /**
   * Check if user is Sudo or higher
   */
  async isSudoOrHigher(userId: string): Promise<boolean> {
    const role = await this.getUserRole(userId);
    return role === ROLES.OWNER || role === ROLES.ADMIN || role === ROLES.SUDO;
  }
}

export const permission = new PermissionService();