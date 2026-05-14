export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?:
    | string
    | {
        code: string;
        message: string;
      };
  /** Some backend endpoints flatten the error as top-level fields. */
  message?: string;
  errorCode?: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: {
    items: T[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
