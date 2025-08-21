import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ChatModule } from './chat/chat.module';
import { SessionModule } from './session/session.module';
import { AiModule } from './ai/ai.module';

@Module({
  imports: [ChatModule, SessionModule, AiModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
