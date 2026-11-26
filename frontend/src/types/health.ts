export interface HealthStatus {
  status: 'ok' | 'degraded' | 'error';
  uptimeSeconds: number;
  timestamp: string;
  services: {
    server: {
      status: 'healthy';
      nodeVersion: string;
      memoryUsageMb: number;
    };
    database: {
      status: 'connected' | 'disconnected';
      latencyMs: number;
      error?: string;
    };
  };
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  timestamp: string;
}
