/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { EventEmitter } from 'events';

// Using require to avoid TypeScript module resolution issues with ioredis
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Redis = require('ioredis');

interface RedisOptions {
  host?: string;
  port?: number;
  maxRetriesPerRequest?: number;
}

export interface RedisMessage {
  type: 'thinking' | 'chunk' | 'complete' | 'error' | 'connected';
  sessionId: string;
  content?: string;
  messageId?: string;
  error?: string;
  isSessionComplete?: boolean;
  questionsAnswered?: number;
  serverId?: string;
}

@Injectable()
export class RedisPubSubService implements OnModuleInit, OnModuleDestroy {
  private publisher: any;
  private subscriber: any;
  private eventEmitter = new EventEmitter();
  private serverId: string;
  private subscribedChannels = new Set<string>();

  constructor() {
    this.serverId = `server-${process.pid}-${Date.now()}`;

    // Redis connection options
    const redisOptions: RedisOptions = {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      maxRetriesPerRequest: 3,
    };

    this.publisher = new Redis(redisOptions);
    this.subscriber = new Redis(redisOptions);
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async onModuleInit() {
    // With lazyConnect: true, no need to explicitly connect
    // The connection will be established automatically on first operation

    // Listen for messages
    this.subscriber.on('message', (channel: string, message: string) => {
      try {
        const data: RedisMessage = JSON.parse(message) as RedisMessage;
        this.eventEmitter.emit(channel, data);
      } catch (error) {
        console.error('Error parsing Redis message:', error);
      }
    });

    console.log(
      `Redis PubSub service initialized with server ID: ${this.serverId}`,
    );
  }

  async onModuleDestroy() {
    // Cleanup all subscriptions
    for (const channel of this.subscribedChannels) {
      await this.unsubscribe(channel);
    }

    await this.publisher.quit();
    await this.subscriber.quit();
  }

  /**
   * Subscribe to a session channel. Only one server should subscribe to each session.
   * Uses Redis SET with NX to ensure atomic locking.
   */
  async subscribeToSession(sessionId: string): Promise<boolean> {
    const channelName = `session:${sessionId}`;
    const lockKey = `lock:${channelName}`;

    // Try to acquire lock with 30 minute expiration
    const lockAcquired = await this.publisher.set(
      lockKey,
      this.serverId,
      'PX', // milliseconds
      30 * 60 * 1000, // 30 minutes
      'NX', // only set if not exists
    );

    if (lockAcquired === 'OK') {
      await this.subscriber.subscribe(channelName);
      this.subscribedChannels.add(channelName);
      console.log(
        `Server ${this.serverId} subscribed to channel: ${channelName}`,
      );
      return true;
    }

    console.log(`Channel ${channelName} already locked by another server`);
    return false;
  }

  /**
   * Unsubscribe from session channel and release lock
   */
  async unsubscribeFromSession(sessionId: string): Promise<void> {
    const channelName = `session:${sessionId}`;
    const lockKey = `lock:${channelName}`;

    // Check if we own the lock
    const lockOwner = await this.publisher.get(lockKey);
    if (lockOwner === this.serverId) {
      await this.publisher.del(lockKey);
    }

    await this.subscriber.unsubscribe(channelName);
    this.subscribedChannels.delete(channelName);
    console.log(
      `Server ${this.serverId} unsubscribed from channel: ${channelName}`,
    );
  }

  /**
   * Publish message to session channel
   */
  async publishToSession(
    sessionId: string,
    message: RedisMessage,
  ): Promise<void> {
    const channelName = `session:${sessionId}`;
    const enrichedMessage = {
      ...message,
      serverId: this.serverId,
      timestamp: new Date().toISOString(),
    };

    await this.publisher.publish(channelName, JSON.stringify(enrichedMessage));
  }

  /**
   * Listen for messages on a session channel
   */
  onSessionMessage(
    sessionId: string,
    callback: (message: RedisMessage) => void,
  ): void {
    const channelName = `session:${sessionId}`;
    this.eventEmitter.on(channelName, callback);
  }

  /**
   * Remove listener for session messages
   */
  offSessionMessage(
    sessionId: string,
    callback: (message: RedisMessage) => void,
  ): void {
    const channelName = `session:${sessionId}`;
    this.eventEmitter.off(channelName, callback);
  }

  /**
   * Check if a session channel is locked (has active subscriber)
   */
  async isSessionLocked(sessionId: string): Promise<boolean> {
    const lockKey = `lock:session:${sessionId}`;
    const lockExists = await this.publisher.exists(lockKey);
    return lockExists === 1;
  }

  /**
   * Get the server ID that owns a session lock
   */
  async getSessionLockOwner(sessionId: string): Promise<string | null> {
    const lockKey = `lock:session:${sessionId}`;
    return await this.publisher.get(lockKey);
  }

  /**
   * Extend lock for a session (refresh TTL)
   */
  async extendSessionLock(sessionId: string): Promise<boolean> {
    const lockKey = `lock:session:${sessionId}`;
    const lockOwner = await this.publisher.get(lockKey);

    if (lockOwner === this.serverId) {
      await this.publisher.pexpire(lockKey, 30 * 60 * 1000); // 30 minutes
      return true;
    }

    return false;
  }

  private async unsubscribe(channelName: string): Promise<void> {
    await this.subscriber.unsubscribe(channelName);
    this.subscribedChannels.delete(channelName);
  }

  getServerId(): string {
    return this.serverId;
  }
}
