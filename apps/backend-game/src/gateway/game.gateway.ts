import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import {
  actionEnvelopeSchema,
  joinRoomSchema,
  resumeRequestSchema,
  type ActionEnvelopeInput,
} from '@gostop/shared';
import { SOCKET_NAMESPACE } from '../config/constants.js';
import { SocketIoBroadcaster } from './socket-io.broadcaster.js';
import { RoomManagerService } from './room-manager.service.js';

/**
 * GameGateway — network layer ONLY.
 *
 * Validates wire payloads, authenticates (stub), delegates to RoomActor via
 * RoomManager. Contains zero game rules.
 */
@WebSocketGateway({ namespace: SOCKET_NAMESPACE, cors: { origin: '*' } })
export class GameGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  constructor(private readonly rooms: RoomManagerService) {}

  afterInit(): void {
    this.rooms.broadcasterHolder.bind(new SocketIoBroadcaster(this.server));
  }

  handleConnection(client: Socket): void {
    const userId = String(client.handshake.query.userId ?? client.id);
    const nickname = String(client.handshake.query.nickname ?? `player-${userId.slice(0, 6)}`);
    client.data.userId = userId;
    client.data.nickname = nickname;
    client.data.sessionId = client.id;
    client.data.isSpectator = false;
  }

  handleDisconnect(client: Socket): void {
    const room = this.rooms.manager.findBySocket(client.id);
    room?.leave(client.id);
    this.rooms.manager.unbindSocket(client.id);
  }

  @SubscribeMessage('room:join')
  async onJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: unknown,
  ): Promise<import('@gostop/shared').RoomJoinResult> {
    const payload = joinRoomSchema.parse(body);
    const solo = payload.solo === true || payload.roomId.startsWith('solo-');
    const room = this.rooms.manager.getOrCreate(payload.roomId);
    const result = await room.join({
      userId: client.data.userId as string,
      socketId: client.id,
      nickname: client.data.nickname as string,
      asSpectator: payload.asSpectator,
      solo,
    });
    if (result.status === 'OK') {
      await client.join(payload.roomId);
      this.rooms.manager.bindSocket(payload.roomId, client.id);
      if (result.sync) {
        client.emit('game:sync', result.sync);
      }
    }
    return result;
  }

  @SubscribeMessage('room:leave')
  async onLeave(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { roomId: string },
  ): Promise<{ ok: boolean }> {
    const room = this.rooms.manager.getOrCreate(body.roomId);
    room.leave(client.id);
    this.rooms.manager.unbindSocket(client.id);
    await client.leave(body.roomId);
    return { ok: true };
  }

  @SubscribeMessage('room:ready')
  async onReady(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { roomId: string; ready: boolean },
  ): Promise<{ ok: boolean }> {
    const room = this.rooms.manager.getOrCreate(body.roomId);
    await room.setReady(client.data.userId as string, body.ready);
    return { ok: true };
  }

  @SubscribeMessage('game:action')
  async onAction(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: unknown,
  ): Promise<import('@gostop/shared').ActionAck> {
    const envelope = actionEnvelopeSchema.parse(body) as ActionEnvelopeInput;
    const room =
      this.rooms.manager.findBySocket(client.id) ??
      this.rooms.manager.findByGameId(envelope.gameId);
    if (!room) {
      return {
        status: 'REJECTED',
        actionId: envelope.actionId,
        error: { code: 'NOT_FOUND', message: 'room not found' },
        legalActions: [],
      };
    }
    return room.handleAction(envelope, client.data.userId as string);
  }

  @SubscribeMessage('session:resume')
  onResume(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: unknown,
  ): import('@gostop/shared').ResumeResult {
    const req = resumeRequestSchema.parse(body);
    const room = this.rooms.manager.findBySocket(client.id);
    if (!room) return { status: 'NOT_FOUND' };
    return room.resume(req, client.data.userId as string);
  }

  @SubscribeMessage('heartbeat')
  onHeartbeat(): { serverTime: number } {
    return { serverTime: Date.now() };
  }
}
