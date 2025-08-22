import { Injectable } from '@nestjs/common';
import { Subscriber } from 'rxjs';

@Injectable()
export class SSEConnectionManagerService {
  private connections: Map<string, Set<Subscriber<any>>> = new Map();

  addConnection(sessionId: string, subscriber: Subscriber<any>): void {
    if (!this.connections.has(sessionId)) {
      this.connections.set(sessionId, new Set());
    }
    this.connections.get(sessionId)!.add(subscriber);
  }

  removeConnection(sessionId: string, subscriber: Subscriber<any>): void {
    const sessionConnections = this.connections.get(sessionId);
    if (sessionConnections) {
      sessionConnections.delete(subscriber);
      if (sessionConnections.size === 0) {
        this.connections.delete(sessionId);
      }
    }
  }

  pushToSession(sessionId: string, data: any): void {
    const sessionConnections = this.connections.get(sessionId);
    if (sessionConnections) {
      sessionConnections.forEach((subscriber) => {
        try {
          subscriber.next({
            data: JSON.stringify(data),
          });
        } catch (error) {
          console.error('Error pushing to SSE subscriber:', error);
          // Remove broken connection
          this.removeConnection(sessionId, subscriber);
        }
      });
    }
  }

  getActiveConnections(sessionId: string): number {
    return this.connections.get(sessionId)?.size || 0;
  }

  getAllActiveSessions(): string[] {
    return Array.from(this.connections.keys());
  }

  cleanupSession(sessionId: string): void {
    this.connections.delete(sessionId);
  }

  closeAllConnections(): void {
    this.connections.clear();
  }
}
