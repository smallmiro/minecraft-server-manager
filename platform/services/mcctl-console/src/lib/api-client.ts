/**
 * Client-side API wrapper for BFF proxy
 *
 * All requests go through /api/proxy which handles:
 * - Session validation
 * - Auth headers injection
 * - Request forwarding to mcctl-api
 *
 * @example
 * import { api } from '@/lib/api-client';
 *
 * // GET request
 * const servers = await api.get<Server[]>('/servers');
 *
 * // POST request
 * await api.post('/servers/myserver/start', {});
 *
 * // DELETE request
 * await api.delete('/servers/myserver');
 */

/**
 * Custom API error with response details
 */
export class ApiError extends Error {
  public readonly status: number;
  public readonly statusText: string;
  public readonly data?: unknown;

  constructor(response: Response, data?: unknown) {
    const message = `API Error: ${response.status} ${response.statusText}`;
    super(message);
    this.name = 'ApiError';
    this.status = response.status;
    this.statusText = response.statusText;
    this.data = data;
  }

  /**
   * Check if error is due to authentication failure
   */
  isUnauthorized(): boolean {
    return this.status === 401;
  }

  /**
   * Check if error is due to permission denied
   */
  isForbidden(): boolean {
    return this.status === 403;
  }

  /**
   * Check if error is due to resource not found
   */
  isNotFound(): boolean {
    return this.status === 404;
  }

  /**
   * Check if error is due to server/network issues
   */
  isServerError(): boolean {
    return this.status >= 500;
  }

  /**
   * Get user-friendly error message
   */
  getUserMessage(): string {
    if (this.isUnauthorized()) {
      return 'Please sign in to continue';
    }
    if (this.isForbidden()) {
      return 'You do not have permission to perform this action';
    }
    if (this.isNotFound()) {
      return 'The requested resource was not found';
    }
    if (this.isServerError()) {
      return 'Server error. Please try again later';
    }
    return 'An unexpected error occurred';
  }
}

/**
 * Request options for API calls
 */
interface RequestOptions {
  /**
   * Additional headers to include
   */
  headers?: Record<string, string>;

  /**
   * AbortSignal for request cancellation
   */
  signal?: AbortSignal;
}

/**
 * API Client class
 */
class ApiClient {
  private readonly baseUrl: string;

  constructor(baseUrl = '/api/proxy') {
    this.baseUrl = baseUrl;
  }

  /**
   * Make an API request
   */
  private async request<T>(
    method: string,
    path: string,
    data?: unknown,
    options?: RequestOptions
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options?.headers,
    };

    const fetchOptions: RequestInit = {
      method,
      headers,
      signal: options?.signal,
    };

    if (data !== undefined && method !== 'GET' && method !== 'HEAD') {
      fetchOptions.body = JSON.stringify(data);
    }

    const response = await fetch(url, fetchOptions);

    // Handle empty responses
    const contentType = response.headers.get('content-type');
    const hasJsonContent =
      contentType?.includes('application/json') &&
      response.headers.get('content-length') !== '0';

    let responseData: unknown;
    if (hasJsonContent) {
      responseData = await response.json();
    }

    if (!response.ok) {
      throw new ApiError(response, responseData);
    }

    return responseData as T;
  }

  /**
   * GET request
   */
  async get<T>(path: string, options?: RequestOptions): Promise<T> {
    return this.request<T>('GET', path, undefined, options);
  }

  /**
   * POST request
   */
  async post<T>(
    path: string,
    data?: unknown,
    options?: RequestOptions
  ): Promise<T> {
    return this.request<T>('POST', path, data, options);
  }

  /**
   * PUT request
   */
  async put<T>(
    path: string,
    data?: unknown,
    options?: RequestOptions
  ): Promise<T> {
    return this.request<T>('PUT', path, data, options);
  }

  /**
   * PATCH request
   */
  async patch<T>(
    path: string,
    data?: unknown,
    options?: RequestOptions
  ): Promise<T> {
    return this.request<T>('PATCH', path, data, options);
  }

  /**
   * DELETE request
   */
  async delete<T>(path: string, options?: RequestOptions): Promise<T> {
    return this.request<T>('DELETE', path, undefined, options);
  }
}

/**
 * Singleton API client instance
 */
export const api = new ApiClient();

/**
 * Create a new API client with custom base URL
 */
export function createApiClient(baseUrl: string): ApiClient {
  return new ApiClient(baseUrl);
}
