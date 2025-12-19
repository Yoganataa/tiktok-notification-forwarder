// src/services/permission.service.ts
import { AccessControlRepository } from '../repositories/access-control.repository';
import { UserRole, ROLES } from '../core/types/database.types';
import { configManager } from '../core/config/config';
import { ValidationError } from '../core/errors/validation.error';

export class PermissionService {
  constructor(private accessControlRepo: AccessControlRepository) {}

  /**
   * Get effective user role
   */
  async getUserRole(userId: string): Promise<UserRole> {
    const config = configManager.get();

    // Check if user is owner
    if (userId === config.discord.ownerId) {
      return ROLES.OWNER;
    }

    // Check database
    const dbRole = await this.accessControlRepo.getUserRole(userId);
    if (dbRole && this.isValidRole(dbRole)) {
      return dbRole;
    }

    return ROLES.USER;
  }

  /**
   * Check if user is Admin or higher
   */
  async isAdminOrHigher(userId: string): Promise<boolean> {
    const role = await this.getUserRole(userId);
    return [ROLES.OWNER, ROLES.ADMIN].includes(role);
  }

  /**
   * Check if user is Sudo or higher
   */
  async isSudoOrHigher(userId: string): Promise<boolean> {
    const role = await this.getUserRole(userId);
    return [ROLES.OWNER, ROLES.ADMIN, ROLES.SUDO].includes(role);
  }

  /**
   * Assign role to user
   */
  async assignRole(
    userId: string,
    role: UserRole,
    assignedBy: string
  ): Promise<void> {
    if (role === ROLES.OWNER) {
      throw new ValidationError('Cannot assign OWNER role');
    }

    if (!this.isValidRole(role)) {
      throw new ValidationError(`Invalid role: ${role}`);
    }

    await this.accessControlRepo.upsert(userId, role, assignedBy);
  }

  /**
   * Revoke user access
   */
  async revokeAccess(userId: string): Promise<boolean> {
    const config = configManager.get();
    
    if (userId === config.discord.ownerId) {
      throw new ValidationError('Cannot revoke owner access');
    }

    return await this.accessControlRepo.delete(userId);
  }

  /**
   * Get all staff members
   */
  async getAllStaff() {
    return await this.accessControlRepo.findAll();
  }

  private isValidRole(role: string): role is UserRole {
    return Object.values(ROLES).includes(role as UserRole);
  }
}