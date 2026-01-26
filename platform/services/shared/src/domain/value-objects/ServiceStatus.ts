/**
 * Service Status Enum
 * Defines possible states for a managed service process
 */
export enum ServiceStatusEnum {
  ONLINE = 'online',
  STOPPING = 'stopping',
  STOPPED = 'stopped',
  ERRORED = 'errored',
  ONE_LAUNCH_STATUS = 'one-launch-status',
}

/**
 * ServiceStatus Value Object
 * Represents a validated service status
 */
export class ServiceStatus {
  private static readonly VALID_STATUSES = new Set(Object.values(ServiceStatusEnum));

  private constructor(private readonly _value: ServiceStatusEnum) {
    Object.freeze(this);
  }

  get value(): ServiceStatusEnum {
    return this._value;
  }

  /**
   * Create a ServiceStatus from a string value
   */
  static create(value: string): ServiceStatus {
    const normalized = value.trim().toLowerCase() as ServiceStatusEnum;

    if (!ServiceStatus.VALID_STATUSES.has(normalized)) {
      const validStatuses = Array.from(ServiceStatus.VALID_STATUSES).join(', ');
      throw new Error(
        `Invalid service status: ${value}. Valid statuses are: ${validStatuses}`
      );
    }

    return new ServiceStatus(normalized);
  }

  /**
   * Create an online status
   */
  static online(): ServiceStatus {
    return new ServiceStatus(ServiceStatusEnum.ONLINE);
  }

  /**
   * Create a stopped status
   */
  static stopped(): ServiceStatus {
    return new ServiceStatus(ServiceStatusEnum.STOPPED);
  }

  /**
   * Create a stopping status
   */
  static stopping(): ServiceStatus {
    return new ServiceStatus(ServiceStatusEnum.STOPPING);
  }

  /**
   * Create an errored status
   */
  static errored(): ServiceStatus {
    return new ServiceStatus(ServiceStatusEnum.ERRORED);
  }

  /**
   * Check if service is online
   */
  get isOnline(): boolean {
    return this._value === ServiceStatusEnum.ONLINE;
  }

  /**
   * Check if service is stopped
   */
  get isStopped(): boolean {
    return this._value === ServiceStatusEnum.STOPPED;
  }

  /**
   * Check if service is stopping
   */
  get isStopping(): boolean {
    return this._value === ServiceStatusEnum.STOPPING;
  }

  /**
   * Check if service has errored
   */
  get isErrored(): boolean {
    return this._value === ServiceStatusEnum.ERRORED;
  }

  /**
   * Check if service is running (online or stopping)
   */
  get isRunning(): boolean {
    return this._value === ServiceStatusEnum.ONLINE || this._value === ServiceStatusEnum.STOPPING;
  }

  equals(other: ServiceStatus): boolean {
    return this._value === other._value;
  }

  toString(): string {
    return this._value;
  }
}
