import { User } from '../../../domain/entities/User.js';
import { UserId } from '../../../domain/value-objects/UserId.js';
import { Username } from '../../../domain/value-objects/Username.js';

/**
 * User Repository Port - Outbound Port
 * Interface for user data access
 */
export interface IUserRepository {
  /**
   * Find a user by their unique ID
   * @param id - The user's unique identifier
   * @returns The user if found, null otherwise
   */
  findById(id: UserId): Promise<User | null>;

  /**
   * Find a user by their username
   * @param username - The username to search for
   * @returns The user if found, null otherwise
   */
  findByUsername(username: Username): Promise<User | null>;

  /**
   * Get all users in the system
   * @returns Array of all users
   */
  findAll(): Promise<User[]>;

  /**
   * Save a user (create or update)
   * @param user - The user entity to save
   */
  save(user: User): Promise<void>;

  /**
   * Delete a user by their ID
   * @param id - The user's unique identifier
   */
  delete(id: UserId): Promise<void>;

  /**
   * Get the total count of users
   * @returns The number of users in the system
   */
  count(): Promise<number>;
}
