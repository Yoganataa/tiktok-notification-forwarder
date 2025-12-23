// src/services/permission.service.ts
import { AccessControlRepository } from '../repositories/access-control.repository';
import { UserRole, ROLES } from '../core/types/database.types';
import { configManager } from '../core/config/config';
import { ValidationError } from '../core/errors/validation.error';

/**
 * Service responsible for managing user roles and access control logic.
 * * Acts as a gatekeeper, verifying user permissions against both hardcoded 
 * configuration (for the Bot Owner) and dynamic database records (for Staff).
 */
export class PermissionService {
  constructor(private accessControlRepo: AccessControlRepository) {}

  /**
   * Resolves the effective role for a given user ID.
   * * **Priority Order:**
   * * 1. Hardcoded Owner ID (from Config).
   * * 2. Database Record (Admin/Sudo).
   * * 3. Default 'USER' role.
   * * @param userId - The Discord user ID to check.
   * * @returns The highest privilege level associated with the user.
   */
  async getUserRole(userId: string): Promise<UserRole> {
    const config = configManager.get();

    if (userId === config.discord.ownerId) {
      return ROLES.OWNER;
    }

    const dbRole = await this.accessControlRepo.getUserRole(userId);
    if (dbRole && this.isValidRole(dbRole)) {
      return dbRole;
    }

    return ROLES.USER;
  }

  /**
   * Checks if a user holds an Administrator-level role or higher.
   * * **Authorized Roles:** OWNER, ADMIN.
   * * @param userId - The Discord user ID to check.
   */
  async isAdminOrHigher(userId: string): Promise<boolean> {
    const role = await this.getUserRole(userId);
    return [ROLES.OWNER, ROLES.ADMIN].includes(role);
  }

  /**
   * Checks if a user holds a Sudo-level role or higher.
   * * **Authorized Roles:** OWNER, ADMIN, SUDO.
   * * @param userId - The Discord user ID to check.
   */
  async isSudoOrHigher(userId: string): Promise<boolean> {
    const role = await this.getUserRole(userId);
    return [ROLES.OWNER, ROLES.ADMIN, ROLES.SUDO].includes(role);
  }

  /**
   * Grants a specific role to a user.
   * * **Validation:** Prevents assignment of the 'OWNER' role, which is strictly configuration-bound.
   * * @param userId - The target user ID.
   * * @param role - The role to assign.
   * * @param assignedBy - The ID of the admin performing the assignment.
   * * @throws {ValidationError} If attempting to assign an invalid or restricted role.
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
   * Revokes any privileged access from a user.
   * * **Validation:** Prevents revocation of the hardcoded Owner's access.
   * * @param userId - The user ID to remove from access control.
   * * @returns `true` if access was successfully revoked.
   * * @throws {ValidationError} If attempting to revoke the Owner's access.
   */
  async revokeAccess(userId: string): Promise<boolean> {
    const config = configManager.get();
    
    if (userId === config.discord.ownerId) {
      throw new ValidationError('Cannot revoke owner access');
    }

    return await this.accessControlRepo.delete(userId);
  }

  /**
   * Retrieves a list of all users with elevated privileges (Staff).
   * * @returns An array of AccessControl records.
   */
  async getAllStaff() {
    return await this.accessControlRepo.findAll();
  }

  /**
   * Type guard to validate if a string matches a known `UserRole`.
   */
  private isValidRole(role: string): role is UserRole {
    return Object.values(ROLES).includes(role as UserRole);
  }
}