import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller';
import { SessionModule } from '../session/session.module';
import { AiModule } from '../ai/ai.module';
import { RedisPubSubService } from './redis-pubsub.service';
import { RedisSSEManagerService } from './redis-sse-manager.service';
import { ChatEventsService } from './chat-events.service';
import { ChatEventHandlerService } from './chat-event-handler.service';

@Module({
  imports: [SessionModule, AiModule],
  controllers: [ChatController],
  providers: [
    RedisPubSubService,
    RedisSSEManagerService,
    ChatEventsService,
    ChatEventHandlerService,
  ],
})
export class ChatModule {}
