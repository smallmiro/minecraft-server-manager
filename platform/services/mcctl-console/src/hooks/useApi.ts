import { useMutation, useQuery, useQueryClient, UseMutationOptions, UseQueryOptions } from '@tanstack/react-query';

/**
 * API Error type
 */
export interface ApiError {
  error: string;
  message: string;
}

/**
 * Custom fetch wrapper for API calls
 */
async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(endpoint, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({
      error: 'UnknownError',
      message: response.statusText,
    })) as ApiError;

    const error = new Error(errorData.message) as Error & { statusCode: number; code: string };
    error.statusCode = response.status;
    error.code = errorData.error;
    throw error;
  }

  return response.json() as Promise<T>;
}

/**
 * Generic query hook for GET requests
 */
export function useApiQuery<T>(
  key: string[],
  endpoint: string,
  options?: Omit<UseQueryOptions<T, Error>, 'queryKey' | 'queryFn'>
) {
  return useQuery<T, Error>({
    queryKey: key,
    queryFn: () => apiFetch<T>(endpoint),
    ...options,
  });
}

/**
 * Generic mutation hook for POST/PUT/DELETE requests
 */
export function useApiMutation<TData, TVariables>(
  endpoint: string | ((variables: TVariables) => string),
  method: 'POST' | 'PUT' | 'DELETE' | 'PATCH' = 'POST',
  options?: Omit<UseMutationOptions<TData, Error, TVariables>, 'mutationFn'>
) {
  const queryClient = useQueryClient();

  return useMutation<TData, Error, TVariables>({
    mutationFn: async (variables: TVariables) => {
      const url = typeof endpoint === 'function' ? endpoint(variables) : endpoint;
      const hasBody = method !== 'DELETE' && variables !== undefined;

      return apiFetch<TData>(url, {
        method,
        ...(hasBody && { body: JSON.stringify(variables) }),
      });
    },
    onSuccess: () => {
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ['servers'] });
      queryClient.invalidateQueries({ queryKey: ['worlds'] });
    },
    ...options,
  });
}

export { apiFetch };
