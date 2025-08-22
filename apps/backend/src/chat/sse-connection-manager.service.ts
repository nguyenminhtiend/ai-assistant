import { Injectable } from '@nestjs/common';
import { Subscriber } from 'rxjs';

@Injectable()
export class SSEConnectionManagerService {
  private connections: Map<string, Subscriber<any>> = new Map();

  addConnection(sessionId: string, subscriber: Subscriber<any>): boolean {
    // Check if session already has a connection
    if (this.connections.has(sessionId)) {
      return false; // Session already has a subscriber
    }

    this.connections.set(sessionId, subscriber);
    return true; // Successfully added
  }

  removeConnection(sessionId: string, subscriber: Subscriber<any>): void {
    const existingSubscriber = this.connections.get(sessionId);
    if (existingSubscriber === subscriber) {
      this.connections.delete(sessionId);
    }
  }

  pushToSession(sessionId: string, data: any): void {
    const subscriber = this.connections.get(sessionId);
    if (subscriber) {
      try {
        subscriber.next({
          data: JSON.stringify(data),
        });
      } catch (error) {
        console.error('Error pushing to SSE subscriber:', error);
        // Remove broken connection
        this.connections.delete(sessionId);
      }
    }
  }

  getActiveConnections(sessionId: string): number {
    return this.connections.has(sessionId) ? 1 : 0;
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

  isSessionConnected(sessionId: string): boolean {
    return this.connections.has(sessionId);
  }
}
