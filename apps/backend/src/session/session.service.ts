import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Session, Message } from '../common/interfaces/session.interface';

@Injectable()
export class SessionService {
  constructor(private readonly eventEmitter: EventEmitter2) {}

  private sessions: Map<string, Session> = new Map();

  createSession(): Session {
    const session: Session = {
      id: uuidv4(),
      messages: [],
      questionsAnswered: 0,
      isComplete: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.sessions.set(session.id, session);
    return session;
  }

  getSession(sessionId: string): Session | undefined {
    return this.sessions.get(sessionId);
  }

  getAllSessions(): Session[] {
    return Array.from(this.sessions.values());
  }

  addMessage(sessionId: string, message: Message): Session | undefined {
    const session = this.sessions.get(sessionId);
    if (!session) return undefined;

    session.messages.push(message);
    session.updatedAt = new Date();

    // Check if this is an answer to a question
    if (message.role === 'user') {
      const lastAssistantMessage = this.getLastAssistantMessage(session);
      if (
        lastAssistantMessage &&
        this.isQuestionMessage(lastAssistantMessage.content)
      ) {
        session.questionsAnswered++;

        // Mark session as complete if 5 questions have been answered
        if (session.questionsAnswered >= 5) {
          session.isComplete = true;
        }
      }
    }

    this.sessions.set(sessionId, session);

    // Emit event for message added
    this.eventEmitter.emit('message.added', { sessionId, message });

    return session;
  }

  private getLastAssistantMessage(session: Session): Message | undefined {
    const assistantMessages = session.messages.filter(
      (m) => m.role === 'assistant',
    );
    return assistantMessages[assistantMessages.length - 1];
  }

  private isQuestionMessage(content: string): boolean {
    // Simple check - you can enhance this logic
    return content.includes('?');
  }

  deleteSession(sessionId: string): boolean {
    return this.sessions.delete(sessionId);
  }

  clearAllSessions(): void {
    this.sessions.clear();
  }
}
