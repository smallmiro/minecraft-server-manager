import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { Operator, OpLevel } from '@minecraft-docker/shared';
import type { MinecraftOpsJson } from '@minecraft-docker/shared';

/**
 * Adapter for reading and writing Minecraft ops.json files
 */
export class OpsJsonAdapter {
  constructor(private readonly filePath: string) {}

  /**
   * Read operators from ops.json file
   * Returns empty array if file doesn't exist or is invalid
   */
  async read(): Promise<Operator[]> {
    if (!existsSync(this.filePath)) {
      return [];
    }

    try {
      const content = readFileSync(this.filePath, 'utf-8');
      const opsData: MinecraftOpsJson[] = JSON.parse(content);

      return opsData.map((op) => Operator.fromMinecraftOpsJson(op));
    } catch {
      // Return empty array on any error (invalid JSON, parse error, etc.)
      return [];
    }
  }

  /**
   * Write operators to ops.json file
   * Creates parent directory if it doesn't exist
   */
  async write(operators: Operator[]): Promise<void> {
    const opsData = operators.map((op) => op.toMinecraftOpsJson());

    // Ensure directory exists
    const dir = dirname(this.filePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    writeFileSync(this.filePath, JSON.stringify(opsData, null, 2), 'utf-8');
  }

  /**
   * Find operator by name (case insensitive)
   * Returns null if not found
   */
  async find(playerName: string): Promise<Operator | null> {
    const operators = await this.read();
    const found = operators.find(
      (op) => op.name.toLowerCase() === playerName.toLowerCase()
    );
    return found ?? null;
  }

  /**
   * Add operator (does not add if already exists)
   */
  async add(operator: Operator): Promise<void> {
    const operators = await this.read();

    // Check if already exists
    const exists = operators.some(
      (op) => op.uuid === operator.uuid || op.name.toLowerCase() === operator.name.toLowerCase()
    );

    if (!exists) {
      operators.push(operator);
      await this.write(operators);
    }
  }

  /**
   * Remove operator by name (case insensitive)
   */
  async remove(playerName: string): Promise<void> {
    const operators = await this.read();
    const filtered = operators.filter(
      (op) => op.name.toLowerCase() !== playerName.toLowerCase()
    );
    await this.write(filtered);
  }

  /**
   * Update operator level
   * Throws error if operator not found
   */
  async updateLevel(playerName: string, newLevel: OpLevel): Promise<void> {
    const operators = await this.read();
    const operator = operators.find(
      (op) => op.name.toLowerCase() === playerName.toLowerCase()
    );

    if (!operator) {
      throw new Error(`Operator ${playerName} not found`);
    }

    operator.updateLevel(newLevel);
    await this.write(operators);
  }
}
