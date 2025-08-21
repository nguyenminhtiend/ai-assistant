import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Delete,
  Sse,
  MessageEvent,
  NotFoundException,
  Res,
  Headers,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import type { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { SessionService } from '../session/session.service';
import { AiService } from '../ai/ai.service';
import type { SendMessageDto } from '../common/interfaces/session.interface';
import { Message } from '../common/interfaces/session.interface';

@Controller('api/chat')
export class ChatController {
  constructor(
    private readonly sessionService: SessionService,
    private readonly aiService: AiService,
  ) {}

  @Post('sessions')
  createSession() {
    const session = this.sessionService.createSession();
    return {
      id: session.id,
      createdAt: session.createdAt,
      isComplete: session.isComplete,
      questionsAnswered: session.questionsAnswered,
    };
  }

  @Get('sessions')
  getAllSessions() {
    const sessions = this.sessionService.getAllSessions();
    return sessions.map((session) => ({
      id: session.id,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      messageCount: session.messages.length,
      isComplete: session.isComplete,
      questionsAnswered: session.questionsAnswered,
    }));
  }

  @Get('sessions/:sessionId')
  getSession(@Param('sessionId') sessionId: string) {
    const session = this.sessionService.getSession(sessionId);
    if (!session) {
      throw new NotFoundException('Session not found');
    }
    return session;
  }

  @Delete('sessions/:sessionId')
  deleteSession(@Param('sessionId') sessionId: string) {
    const deleted = this.sessionService.deleteSession(sessionId);
    if (!deleted) {
      throw new NotFoundException('Session not found');
    }
    return { message: 'Session deleted successfully' };
  }

  @Post('sessions/:sessionId/messages')
  sendMessage(
    @Param('sessionId') sessionId: string,
    @Body() sendMessageDto: SendMessageDto,
    @Res() res: Response,
  ) {
    const session = this.sessionService.getSession(sessionId);
    if (!session) {
      throw new NotFoundException('Session not found');
    }

    // Add user message
    const userMessage: Message = {
      id: uuidv4(),
      role: 'user',
      content: sendMessageDto.message,
      timestamp: new Date(),
    };
    this.sessionService.addMessage(sessionId, userMessage);

    // Return success response
    res.status(200).json({
      message: 'Message received',
      sessionId,
      messageId: userMessage.id,
    });
  }

  @Sse('sessions/:sessionId/stream')
  async streamResponse(
    @Param('sessionId') sessionId: string,
    @Headers('last-event-id') lastEventId?: string,
  ): Promise<Observable<MessageEvent>> {
    const session = this.sessionService.getSession(sessionId);
    if (!session) {
      throw new NotFoundException('Session not found');
    }

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
    const messageStream = new Observable<MessageEvent>((subscriber) => {
      (async () => {
        try {
          for await (const chunk of streamGenerator) {
            fullContent += chunk;
            subscriber.next({
              data: JSON.stringify({
                type: 'chunk',
                content: chunk,
                messageId: assistantMessage.id,
                sessionId,
              }),
            });
          }

          // Save the complete message
          assistantMessage.content = fullContent;
          const updatedSession = this.sessionService.addMessage(
            sessionId,
            assistantMessage,
          );

          // Send completion event
          subscriber.next({
            data: JSON.stringify({
              type: 'complete',
              messageId: assistantMessage.id,
              sessionId,
              isSessionComplete: updatedSession?.isComplete || false,
              questionsAnswered: updatedSession?.questionsAnswered || 0,
            }),
          });

          subscriber.complete();
        } catch (error) {
          subscriber.next({
            data: JSON.stringify({
              type: 'error',
              error: 'Failed to generate response',
            }),
          });
          subscriber.complete();
        }
      })();
    });

    return messageStream;
  }

  @Post('sessions/:sessionId/start')
  startConversation(
    @Param('sessionId') sessionId: string,
    @Res() res: Response,
  ) {
    const session = this.sessionService.getSession(sessionId);
    if (!session) {
      throw new NotFoundException('Session not found');
    }

    // If session already has messages, don't start again
    if (session.messages.length > 0) {
      return res.status(200).json({
        message: 'Conversation already started',
        sessionId,
      });
    }

    // Trigger the initial greeting
    res.status(200).json({
      message: 'Conversation started',
      sessionId,
    });
  }
}
