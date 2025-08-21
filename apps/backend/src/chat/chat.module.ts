import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller';
import { SessionModule } from '../session/session.module';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [SessionModule, AiModule],
  controllers: [ChatController],
})
export class ChatModule {}
