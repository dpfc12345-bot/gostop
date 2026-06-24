import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { AppModule } from './app.module.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.useWebSocketAdapter(new IoAdapter(app));
  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port);
  console.log(`[backend-game] listening on :${port} (Socket.IO ${process.env.SOCKET_NAMESPACE ?? '/game'})`);
}

bootstrap().catch((err: unknown) => {
  console.error('[backend-game] fatal', err);
  process.exit(1);
});
