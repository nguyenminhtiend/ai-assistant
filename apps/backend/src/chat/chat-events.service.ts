import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class ChatEventsService {
  constructor(private readonly eventEmitter: EventEmitter2) {}

  emitMessageAdded(sessionId: string, message: unknown): void {
    this.eventEmitter.emit('message.added', { sessionId, message });
  }
}
