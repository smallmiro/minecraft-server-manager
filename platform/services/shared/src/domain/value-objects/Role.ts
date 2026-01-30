/**
 * Role Enum
 * Defines available user roles in the system
 */
export enum RoleEnum {
  ADMIN = 'admin',
  VIEWER = 'viewer',
}

/**
 * Role Value Object
 * Represents a validated user role
 */
export class Role {
  private static readonly VALID_ROLES = new Set(Object.values(RoleEnum));

  private constructor(private readonly _value: RoleEnum) {
    Object.freeze(this);
  }

  get value(): RoleEnum {
    return this._value;
  }

  /**
   * Create a Role from a string value
   */
  static create(value: string): Role {
    const normalized = value.trim().toLowerCase() as RoleEnum;

    if (!Role.VALID_ROLES.has(normalized)) {
      const validRoles = Array.from(Role.VALID_ROLES).join(', ');
      throw new Error(
        `Invalid role: ${value}. Valid roles are: ${validRoles}`
      );
    }

    return new Role(normalized);
  }

  /**
   * Create an admin role
   */
  static admin(): Role {
    return new Role(RoleEnum.ADMIN);
  }

  /**
   * Create a viewer role
   */
  static viewer(): Role {
    return new Role(RoleEnum.VIEWER);
  }

  /**
   * Check if this role is admin
   */
  get isAdmin(): boolean {
    return this._value === RoleEnum.ADMIN;
  }

  /**
   * Check if this role is viewer
   */
  get isViewer(): boolean {
    return this._value === RoleEnum.VIEWER;
  }

  equals(other: Role): boolean {
    return this._value === other._value;
  }

  toString(): string {
    return this._value;
  }
}
