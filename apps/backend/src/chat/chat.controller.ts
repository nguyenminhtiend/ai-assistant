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
  OnModuleDestroy,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import type { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { SessionService } from '../session/session.service';
import { SSEConnectionManagerService } from './sse-connection-manager.service';
import type {
  SendMessageDto,
  Message,
} from '../common/interfaces/session.interface';

@Controller('api/chat')
export class ChatController implements OnModuleDestroy {
  constructor(
    private readonly sessionService: SessionService,
    private readonly sseConnectionManager: SSEConnectionManagerService,
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

    // Return success response immediately
    res.status(200).json({
      message: 'Message received',
      sessionId,
      messageId: userMessage.id,
    });
  }

  @Sse('sessions/:sessionId/stream')
  streamResponse(
    @Param('sessionId') sessionId: string,
  ): Observable<MessageEvent> {
    const session = this.sessionService.getSession(sessionId);
    if (!session) {
      throw new NotFoundException('Session not found');
    }

    // Check if session already has an active connection
    if (this.sseConnectionManager.isSessionConnected(sessionId)) {
      throw new NotFoundException('Session already has an active connection');
    }

    return new Observable<MessageEvent>((subscriber) => {
      // Add connection to manager
      this.sseConnectionManager.addConnection(sessionId, subscriber);

      // Send initial connection confirmation
      subscriber.next({
        data: JSON.stringify({
          type: 'connected',
          sessionId,
          message: 'SSE connection established',
        }),
      });

      // Handle client disconnect
      subscriber.add(() => {
        this.sseConnectionManager.removeConnection(sessionId, subscriber);
      });
    });
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

    // Trigger the initial greeting by emitting a message.added event
    // This will cause the AI to generate the first greeting
    const initialMessage: Message = {
      id: uuidv4(),
      role: 'assistant',
      content: 'init',
      timestamp: new Date(),
    };

    // Add the initial message to trigger AI response
    this.sessionService.addMessage(sessionId, initialMessage);

    res.status(200).json({
      message: 'Conversation started',
      sessionId,
    });
  }

  @Post('sessions/:sessionId/greet')
  triggerGreeting(@Param('sessionId') sessionId: string, @Res() res: Response) {
    const session = this.sessionService.getSession(sessionId);
    if (!session) {
      throw new NotFoundException('Session not found');
    }

    // If session already has messages, don't trigger greeting
    if (session.messages.length > 0) {
      return res.status(200).json({
        message: 'Session already has messages',
        sessionId,
      });
    }

    // Trigger the initial greeting
    const initialMessage: Message = {
      id: uuidv4(),
      role: 'assistant',
      content: 'init',
      timestamp: new Date(),
    };

    this.sessionService.addMessage(sessionId, initialMessage);

    res.status(200).json({
      message: 'Greeting triggered',
      sessionId,
    });
  }

  onModuleDestroy() {
    this.sseConnectionManager.closeAllConnections();
  }
}
