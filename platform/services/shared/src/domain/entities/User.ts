import { UserId } from '../value-objects/UserId.js';
import { Username } from '../value-objects/Username.js';
import { Role, RoleEnum } from '../value-objects/Role.js';

/**
 * User entity data for creation
 */
export interface UserData {
  id?: UserId;
  username: Username;
  passwordHash: string;
  role: Role;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * User entity
 * Represents an authenticated user in the system
 */
export class User {
  private readonly _id: UserId;
  private readonly _username: Username;
  private _passwordHash: string;
  private _role: Role;
  private readonly _createdAt: Date;
  private _updatedAt: Date;

  private constructor(data: UserData) {
    this._id = data.id ?? UserId.generate();
    this._username = data.username;
    this._passwordHash = data.passwordHash;
    this._role = data.role;
    this._createdAt = data.createdAt ?? new Date();
    this._updatedAt = data.updatedAt ?? new Date();
  }

  // Getters
  get id(): UserId {
    return this._id;
  }

  get username(): Username {
    return this._username;
  }

  get passwordHash(): string {
    return this._passwordHash;
  }

  get role(): Role {
    return this._role;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  // Role checks
  get isAdmin(): boolean {
    return this._role.isAdmin;
  }

  get isViewer(): boolean {
    return this._role.isViewer;
  }

  /**
   * Update the user's password hash
   */
  updatePasswordHash(newPasswordHash: string): void {
    if (!newPasswordHash || newPasswordHash.trim().length === 0) {
      throw new Error('Password hash cannot be empty');
    }
    this._passwordHash = newPasswordHash;
    this._updatedAt = new Date();
  }

  /**
   * Update the user's role
   */
  updateRole(newRole: Role): void {
    this._role = newRole;
    this._updatedAt = new Date();
  }

  /**
   * Create a new User entity
   */
  static create(data: UserData): User {
    if (!data.passwordHash || data.passwordHash.trim().length === 0) {
      throw new Error('Password hash is required');
    }
    return new User(data);
  }

  /**
   * Create a User from raw data (e.g., from database)
   */
  static fromRaw(raw: {
    id: string;
    username: string;
    passwordHash: string;
    role: string;
    createdAt: Date | string;
    updatedAt: Date | string;
  }): User {
    return new User({
      id: UserId.create(raw.id),
      username: Username.create(raw.username),
      passwordHash: raw.passwordHash,
      role: Role.create(raw.role),
      createdAt: new Date(raw.createdAt),
      updatedAt: new Date(raw.updatedAt),
    });
  }

  /**
   * Create an admin user
   */
  static createAdmin(username: Username, passwordHash: string): User {
    return User.create({
      username,
      passwordHash,
      role: Role.admin(),
    });
  }

  /**
   * Create a viewer user
   */
  static createViewer(username: Username, passwordHash: string): User {
    return User.create({
      username,
      passwordHash,
      role: Role.viewer(),
    });
  }

  /**
   * Convert to plain object for serialization
   */
  toJSON(): {
    id: string;
    username: string;
    role: RoleEnum;
    createdAt: string;
    updatedAt: string;
  } {
    return {
      id: this._id.value,
      username: this._username.value,
      role: this._role.value,
      createdAt: this._createdAt.toISOString(),
      updatedAt: this._updatedAt.toISOString(),
    };
  }
}
