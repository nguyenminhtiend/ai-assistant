import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { v4 as uuidv4 } from 'uuid';
import { SessionService } from '../session/session.service';
import { AiService } from '../ai/ai.service';
import { SSEConnectionManagerService } from './sse-connection-manager.service';
import { Message } from '../common/interfaces/session.interface';

@Injectable()
export class ChatEventHandlerService {
  constructor(
    private readonly sessionService: SessionService,
    private readonly aiService: AiService,
    private readonly sseConnectionManager: SSEConnectionManagerService,
  ) {}

  @OnEvent('message.added')
  async handleMessageAdded(payload: {
    sessionId: string;
    message: Message;
  }): Promise<void> {
    const { sessionId, message } = payload;

    // Only generate AI response for user messages
    if (message.role === 'user') {
      await this.generateAndPushAIResponse(sessionId);
    }
  }

  private async generateAndPushAIResponse(sessionId: string): Promise<void> {
    try {
      const session = this.sessionService.getSession(sessionId);
      if (!session) return;

      // Create assistant message placeholder
      const assistantMessage: Message = {
        id: uuidv4(),
        role: 'assistant',
        content: '',
        timestamp: new Date(),
      };

      // Generate AI response stream
      const streamGenerator = this.aiService.generateStreamResponse(
        session.messages,
        session.questionsAnswered,
      );

      let fullContent = '';

      // Stream chunks to existing SSE connections
      for await (const chunk of streamGenerator) {
        fullContent += chunk;
        this.sseConnectionManager.pushToSession(sessionId, {
          type: 'chunk',
          content: chunk,
          messageId: assistantMessage.id,
          sessionId,
        });
      }

      // Save the complete message
      assistantMessage.content = fullContent;
      const updatedSession = this.sessionService.addMessage(
        sessionId,
        assistantMessage,
      );

      // Send completion event
      this.sseConnectionManager.pushToSession(sessionId, {
        type: 'complete',
        messageId: assistantMessage.id,
        sessionId,
        isSessionComplete: updatedSession?.isComplete || false,
        questionsAnswered: updatedSession?.questionsAnswered || 0,
      });
    } catch (error) {
      console.error('Error generating AI response:', error);
      this.sseConnectionManager.pushToSession(sessionId, {
        type: 'error',
        error: 'Failed to generate response',
        sessionId,
      });
    }
  }
}
