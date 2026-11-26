import http from 'http';
import https from 'https';
import fs from 'fs';
import { createApp } from './app';
import { env } from './config/env';
import { logger } from './config/logger';
import { setupWebSocket } from './sockets/socket.server';
import { scheduler } from './jobs/scheduler';
import { checkDatabaseConnection, prisma } from './config/database';
import { getRedisClient } from './config/redis';

async function bootstrap() {
  const app = createApp();
  let server: http.Server | https.Server;

  // Hỗ trợ HTTPS nếu được cấu hình (local dev qua self-signed cert)
  if (env.HTTPS_ENABLED && env.SSL_KEY_PATH && env.SSL_CERT_PATH) {
    try {
      const key = fs.readFileSync(env.SSL_KEY_PATH);
      const cert = fs.readFileSync(env.SSL_CERT_PATH);
      server = https.createServer({ key, cert }, app);
      logger.info('HTTPS enabled using local certificate files');
    } catch (err: unknown) {
      logger.warn('Failed to load HTTPS certificates, falling back to HTTP', {
        error: err instanceof Error ? err.message : String(err),
      });
      server = http.createServer(app);
    }
  } else {
    server = http.createServer(app);
  }

  // Khởi tạo WebSocket (Socket.IO)
  setupWebSocket(server);

  // Khởi tạo Background Scheduler
  scheduler.start();

  // Khởi tạo kết nối Redis sớm để các request đầu tiên (login/RBAC) dùng cache ngay
  getRedisClient();

  // Lắng nghe dual-stack (omitting host) để chấp nhận cả IPv6 (::1) và IPv4 (127.0.0.1) trên localhost Windows
  server.listen(env.PORT, () => {
    logger.info(`Server is running at http://localhost:${env.PORT}`);
    logger.info(`Health check API: http://localhost:${env.PORT}/api/health`);
  });

  // Kiểm tra kết nối Database ngầm khi khởi động
  checkDatabaseConnection().then((dbStatus) => {
    if (dbStatus.connected) {
      logger.info(`Database connected successfully (latency: ${dbStatus.latencyMs}ms)`);
    } else {
      logger.warn('Database connection initial check: disconnected. Make sure PostgreSQL is running via docker compose.');
    }
  });

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}. Shutting down gracefully...`);
    scheduler.stop();
    server.close(async () => {
      await prisma.$disconnect();
      logger.info('Closed out remaining connections.');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

bootstrap().catch((err: unknown) => {
  logger.error('Failed to start application:', {
    error: err instanceof Error ? err.message : String(err),
  });
  process.exit(1);
});
