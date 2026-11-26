import { checkDatabaseConnection } from '../../config/database';

export interface HealthCheckResult {
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

export class HealthService {
  async getHealthStatus(): Promise<HealthCheckResult> {
    const memory = process.memoryUsage();
    const dbCheck = await checkDatabaseConnection();

    const overallStatus: HealthCheckResult['status'] = dbCheck.connected ? 'ok' : 'degraded';

    return {
      status: overallStatus,
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      services: {
        server: {
          status: 'healthy',
          nodeVersion: process.version,
          memoryUsageMb: Math.round((memory.heapUsed / 1024 / 1024) * 100) / 100,
        },
        database: {
          status: dbCheck.connected ? 'connected' : 'disconnected',
          latencyMs: dbCheck.latencyMs,
          ...(dbCheck.error ? { error: dbCheck.error } : {}),
        },
      },
    };
  }
}

export const healthService = new HealthService();
