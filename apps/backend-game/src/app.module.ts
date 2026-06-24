import { Module } from '@nestjs/common';
import { GameGateway } from './gateway/game.gateway.js';
import { RoomManagerService } from './gateway/room-manager.service.js';

@Module({
  providers: [RoomManagerService, GameGateway],
})
export class AppModule {}
