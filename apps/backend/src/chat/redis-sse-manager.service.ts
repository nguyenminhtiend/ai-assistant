import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Subscriber } from 'rxjs';
import { RedisPubSubService, RedisMessage } from './redis-pubsub.service';

@Injectable()
export class RedisSSEManagerService implements OnModuleDestroy {
  private connections: Map<string, Subscriber<any>> = new Map();
  private sessionListeners: Map<string, (message: RedisMessage) => void> =
    new Map();

  constructor(private readonly redisPubSub: RedisPubSubService) {}

  async onModuleDestroy() {
    await this.closeAllConnections();
  }

  /**
   * Add SSE connection and try to acquire session lock
   */
  async addConnection(
    sessionId: string,
    subscriber: Subscriber<any>,
  ): Promise<boolean> {
    // Check if session already has a local connection
    if (this.connections.has(sessionId)) {
      return false;
    }

    // Try to acquire Redis lock for this session
    const lockAcquired = await this.redisPubSub.subscribeToSession(sessionId);
    if (!lockAcquired) {
      return false;
    }

    // Store the connection locally
    this.connections.set(sessionId, subscriber);

    // Setup Redis message listener for this session
    const messageListener = (message: RedisMessage) => {
      this.pushToLocalConnection(sessionId, message);
    };

    this.sessionListeners.set(sessionId, messageListener);
    this.redisPubSub.onSessionMessage(sessionId, messageListener);

    // Start lock refresh interval (every 15 minutes)
    this.startLockRefresh(sessionId);

    return true;
  }

  /**
   * Remove SSE connection and clean up Redis subscription
   */
  async removeConnection(
    sessionId: string,
    subscriber: Subscriber<any>,
  ): Promise<void> {
    const existingSubscriber = this.connections.get(sessionId);
    if (existingSubscriber === subscriber) {
      await this.cleanupSession(sessionId);
    }
  }

  /**
   * Push data to local SSE connection (only if this server owns the connection)
   */
  pushToSession(sessionId: string, data: any): void {
    const subscriber = this.connections.get(sessionId);
    if (subscriber) {
      this.pushToLocalConnection(sessionId, data);
    }
  }

  /**
   * Broadcast message to session via Redis (can be called from any server)
   */
  async broadcastToSession(
    sessionId: string,
    message: RedisMessage,
  ): Promise<void> {
    await this.redisPubSub.publishToSession(sessionId, message);
  }

  /**
   * Check if session has active connection on this server
   */
  isSessionConnected(sessionId: string): boolean {
    return this.connections.has(sessionId);
  }

  /**
   * Check if session is locked by any server (including this one)
   */
  async isSessionLockedAnywhere(sessionId: string): Promise<boolean> {
    return await this.redisPubSub.isSessionLocked(sessionId);
  }

  /**
   * Get which server owns the session lock
   */
  async getSessionOwner(sessionId: string): Promise<string | null> {
    return await this.redisPubSub.getSessionLockOwner(sessionId);
  }

  /**
   * Get active connection count for session (local connections only)
   */
  getActiveConnections(sessionId: string): number {
    return this.connections.has(sessionId) ? 1 : 0;
  }

  /**
   * Get all active session IDs on this server
   */
  getAllActiveSessions(): string[] {
    return Array.from(this.connections.keys());
  }

  /**
   * Clean up session completely
   */
  async cleanupSession(sessionId: string): Promise<void> {
    // Remove local connection
    this.connections.delete(sessionId);

    // Remove message listener
    const listener = this.sessionListeners.get(sessionId);
    if (listener) {
      this.redisPubSub.offSessionMessage(sessionId, listener);
      this.sessionListeners.delete(sessionId);
    }

    // Unsubscribe from Redis channel and release lock
    await this.redisPubSub.unsubscribeFromSession(sessionId);

    console.log(`Cleaned up session: ${sessionId}`);
  }

  /**
   * Close all connections and cleanup
   */
  async closeAllConnections(): Promise<void> {
    const sessionIds = Array.from(this.connections.keys());

    // Clean up all sessions in parallel
    await Promise.all(
      sessionIds.map((sessionId) => this.cleanupSession(sessionId)),
    );

    this.connections.clear();
    this.sessionListeners.clear();
  }

  /**
   * Push data to local SSE connection
   */
  private pushToLocalConnection(sessionId: string, data: any): void {
    const subscriber = this.connections.get(sessionId);
    if (subscriber) {
      try {
        subscriber.next({
          data: JSON.stringify(data),
        });
      } catch (error) {
        console.error('Error pushing to SSE subscriber:', error);
        // Clean up broken connection
        this.cleanupSession(sessionId);
      }
    }
  }

  /**
   * Start periodic lock refresh for a session
   */
  private startLockRefresh(sessionId: string): void {
    const refreshInterval = setInterval(
      async () => {
        // Check if connection still exists
        if (!this.connections.has(sessionId)) {
          clearInterval(refreshInterval);
          return;
        }

        // Try to extend the lock
        const extended = await this.redisPubSub.extendSessionLock(sessionId);
        if (!extended) {
          console.log(`Lost lock for session ${sessionId}, cleaning up`);
          clearInterval(refreshInterval);
          await this.cleanupSession(sessionId);
        }
      },
      15 * 60 * 1000,
    ); // Every 15 minutes

    // Store interval reference for cleanup (optional, for better memory management)
    // You could store this in a Map if you need to clear intervals manually
  }
}
