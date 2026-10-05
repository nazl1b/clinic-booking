// Shared helpers for the API layer.
//
// Every function in src/api is async and either resolves with data or throws an
// ApiError with an HTTP status, exactly like the real fetch-based client will.
// While the backend does not exist, the functions read and write the in-memory
// mock database in src/api/mock instead of calling fetch('/api/...').

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return 'Something went wrong. Please try again.';
}

// Simulated network latency so loading states are visible.
export function delay(ms = 300): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Returns a copy so pages can never mutate the mock database by accident.
export function copy<T>(value: T): T {
  return structuredClone(value);
}
