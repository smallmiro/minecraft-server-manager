import { Operator } from '../../../domain/entities/Operator.js';
import { OpLevel } from '../../../domain/value-objects/OpLevel.js';

/**
 * Operator Port - Outbound Port
 * Interface for managing Minecraft server operators
 */
export interface IOperatorPort {
  /**
   * List all operators for a server
   * @param serverName - The server name
   * @returns Array of all operators
   */
  listOperators(serverName: string): Promise<Operator[]>;

  /**
   * Add an operator to a server
   * @param serverName - The server name
   * @param player - Player name or UUID
   * @param level - Operator permission level
   */
  addOperator(serverName: string, player: string, level: OpLevel): Promise<void>;

  /**
   * Remove an operator from a server
   * @param serverName - The server name
   * @param player - Player name or UUID
   */
  removeOperator(serverName: string, player: string): Promise<void>;

  /**
   * Change an operator's permission level
   * @param serverName - The server name
   * @param player - Player name or UUID
   * @param level - New operator permission level
   */
  setOperatorLevel(
    serverName: string,
    player: string,
    level: OpLevel
  ): Promise<void>;
}
