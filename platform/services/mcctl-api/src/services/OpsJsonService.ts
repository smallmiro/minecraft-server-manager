import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { Operator, OpLevel } from '@minecraft-docker/shared';

/**
 * Service for reading/writing ops.json with level support
 */
export class OpsJsonService {
  private readonly platformPath: string;

  constructor(platformPath: string) {
    this.platformPath = platformPath;
  }

  private getOpsJsonPath(serverName: string): string {
    return join(this.platformPath, 'servers', serverName, 'data', 'ops.json');
  }

  /**
   * Read ops.json and return Operator entities
   */
  readOps(serverName: string): Operator[] {
    const opsPath = this.getOpsJsonPath(serverName);

    if (!existsSync(opsPath)) {
      return [];
    }

    try {
      const content = readFileSync(opsPath, 'utf-8');
      const json = JSON.parse(content);

      if (!Array.isArray(json)) {
        return [];
      }

      return json.map((entry) => Operator.fromMinecraftOpsJson(entry));
    } catch {
      return [];
    }
  }

  /**
   * Write Operator entities to ops.json
   */
  writeOps(serverName: string, operators: Operator[]): void {
    const opsPath = this.getOpsJsonPath(serverName);
    const json = operators.map((op) => op.toMinecraftOpsJson());
    writeFileSync(opsPath, JSON.stringify(json, null, 2), 'utf-8');
  }

  /**
   * Add a new operator (or update if exists)
   */
  addOperator(serverName: string, playerName: string, uuid: string, level: OpLevel): Operator {
    const operators = this.readOps(serverName);

    // Check if operator already exists
    const existingIndex = operators.findIndex(
      (op) => op.name.toLowerCase() === playerName.toLowerCase()
    );

    if (existingIndex >= 0) {
      // Update existing operator
      const existing = operators[existingIndex];
      if (!existing) {
        throw new Error(`Operator at index ${existingIndex} not found`);
      }
      existing.updateLevel(level);
      this.writeOps(serverName, operators);
      return existing;
    }

    // Add new operator
    const newOperator = Operator.create({
      uuid,
      name: playerName,
      level,
      bypassesPlayerLimit: false,
    });

    operators.push(newOperator);
    this.writeOps(serverName, operators);

    return newOperator;
  }

  /**
   * Update operator level
   */
  updateOperatorLevel(serverName: string, playerName: string, level: OpLevel): Operator | null {
    const operators = this.readOps(serverName);

    const operator = operators.find(
      (op) => op.name.toLowerCase() === playerName.toLowerCase()
    );

    if (!operator) {
      return null;
    }

    operator.updateLevel(level);
    this.writeOps(serverName, operators);

    return operator;
  }

  /**
   * Remove an operator
   */
  removeOperator(serverName: string, playerName: string): boolean {
    const operators = this.readOps(serverName);
    const filtered = operators.filter(
      (op) => op.name.toLowerCase() !== playerName.toLowerCase()
    );

    if (filtered.length === operators.length) {
      return false; // Not found
    }

    this.writeOps(serverName, filtered);
    return true;
  }
}

export function createOpsJsonService(platformPath: string): OpsJsonService {
  return new OpsJsonService(platformPath);
}
