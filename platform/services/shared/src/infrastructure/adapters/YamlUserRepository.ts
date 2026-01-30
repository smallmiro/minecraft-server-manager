import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { existsSync } from 'node:fs';
import * as yaml from 'js-yaml';
import * as bcrypt from 'bcryptjs';
import type { IUserRepository } from '../../application/ports/outbound/IUserRepository.js';
import { User } from '../../domain/entities/User.js';
import { UserId } from '../../domain/value-objects/UserId.js';
import { Username } from '../../domain/value-objects/Username.js';

/**
 * YAML file structure for users storage
 */
interface YamlUserData {
  id: string;
  username: string;
  passwordHash: string;
  role: string;
  createdAt: string;
  updatedAt: string;
}

interface YamlUsersFile {
  users: YamlUserData[];
}

/**
 * YamlUserRepository
 * Implements IUserRepository using YAML file storage
 */
export class YamlUserRepository implements IUserRepository {
  private static readonly SALT_ROUNDS = 10;
  private readonly filePath: string;

  /**
   * Create a new YamlUserRepository
   * @param filePath - Path to the YAML file for user storage
   */
  constructor(filePath: string) {
    this.filePath = filePath;
  }

  /**
   * Find a user by their unique ID
   */
  async findById(id: UserId): Promise<User | null> {
    const users = await this.loadUsers();
    const userData = users.find((u) => u.id === id.value);

    if (!userData) {
      return null;
    }

    return this.toUser(userData);
  }

  /**
   * Find a user by their username
   */
  async findByUsername(username: Username): Promise<User | null> {
    const users = await this.loadUsers();
    // Case-insensitive username comparison
    const userData = users.find(
      (u) => u.username.toLowerCase() === username.value.toLowerCase()
    );

    if (!userData) {
      return null;
    }

    return this.toUser(userData);
  }

  /**
   * Get all users in the system
   */
  async findAll(): Promise<User[]> {
    const users = await this.loadUsers();
    return users.map((u) => this.toUser(u));
  }

  /**
   * Save a user (create or update)
   */
  async save(user: User): Promise<void> {
    const users = await this.loadUsers();
    const existingIndex = users.findIndex((u) => u.id === user.id.value);

    const userData: YamlUserData = {
      id: user.id.value,
      username: user.username.value,
      passwordHash: user.passwordHash,
      role: user.role.value,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };

    if (existingIndex >= 0) {
      // Update existing user
      users[existingIndex] = userData;
    } else {
      // Add new user
      users.push(userData);
    }

    await this.saveUsers(users);
  }

  /**
   * Delete a user by their ID
   */
  async delete(id: UserId): Promise<void> {
    const users = await this.loadUsers();
    const filteredUsers = users.filter((u) => u.id !== id.value);

    if (filteredUsers.length !== users.length) {
      await this.saveUsers(filteredUsers);
    }
  }

  /**
   * Get the total count of users
   */
  async count(): Promise<number> {
    const users = await this.loadUsers();
    return users.length;
  }

  /**
   * Hash a password using bcrypt
   * @param password - Plain text password to hash
   * @returns Hashed password
   */
  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, YamlUserRepository.SALT_ROUNDS);
  }

  /**
   * Verify a password against a hash
   * @param password - Plain text password to verify
   * @param hash - Password hash to verify against
   * @returns True if password matches, false otherwise
   */
  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  /**
   * Load users from YAML file
   */
  private async loadUsers(): Promise<YamlUserData[]> {
    if (!existsSync(this.filePath)) {
      return [];
    }

    try {
      const content = await readFile(this.filePath, 'utf-8');
      const data = yaml.load(content) as YamlUsersFile | null;

      if (!data || !Array.isArray(data.users)) {
        return [];
      }

      return data.users;
    } catch {
      // If file is empty or invalid, return empty array
      return [];
    }
  }

  /**
   * Save users to YAML file
   */
  private async saveUsers(users: YamlUserData[]): Promise<void> {
    // Ensure directory exists
    const dir = dirname(this.filePath);
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }

    const data: YamlUsersFile = { users };
    const yamlContent = yaml.dump(data, {
      indent: 2,
      lineWidth: -1, // No line wrapping
      quotingType: '"',
      forceQuotes: false,
    });

    await writeFile(this.filePath, yamlContent, 'utf-8');
  }

  /**
   * Convert YAML user data to User entity
   */
  private toUser(data: YamlUserData): User {
    return User.fromRaw({
      id: data.id,
      username: data.username,
      passwordHash: data.passwordHash,
      role: data.role,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    });
  }
}
