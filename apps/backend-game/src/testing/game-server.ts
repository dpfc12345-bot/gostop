import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { AppModule } from '../app.module.js';

export interface GameServerHandle {
  port: number;
  close: () => Promise<void>;
}

/** Spin up the real NestJS + Socket.IO gateway for socket-level E2E. */
export async function createGameServer(port = 0): Promise<GameServerHandle> {
  const app = await NestFactory.create(AppModule, { logger: false });
  app.useWebSocketAdapter(new IoAdapter(app));
  await app.listen(port);
  const address = app.getHttpServer().address();
  const resolvedPort = typeof address === 'object' && address ? address.port : port;

  return {
    port: resolvedPort,
    close: async () => {
      await app.close();
    },
  };
}
