const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

export interface Session {
  id: string;
  createdAt: string;
  updatedAt?: string;
  messageCount?: number;
  isComplete: boolean;
  questionsAnswered: number;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface SessionDetail extends Session {
  messages: Message[];
}

export class ChatAPI {
  static async createSession(): Promise<Session> {
    const response = await fetch(`${API_BASE_URL}/chat/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({})
    });

    if (!response.ok) {
      throw new Error('Failed to create session');
    }

    return response.json();
  }

  static async getAllSessions(): Promise<Session[]> {
    const response = await fetch(`${API_BASE_URL}/chat/sessions`);

    if (!response.ok) {
      throw new Error('Failed to fetch sessions');
    }

    return response.json();
  }

  static async getSession(sessionId: string): Promise<SessionDetail> {
    const response = await fetch(`${API_BASE_URL}/chat/sessions/${sessionId}`);

    if (!response.ok) {
      throw new Error('Failed to fetch session');
    }

    return response.json();
  }

  static async deleteSession(sessionId: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/chat/sessions/${sessionId}`, {
      method: 'DELETE'
    });

    if (!response.ok) {
      throw new Error('Failed to delete session');
    }
  }

  static async sendMessage(sessionId: string, message: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/chat/sessions/${sessionId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ message })
    });

    if (!response.ok) {
      throw new Error('Failed to send message');
    }
  }

  static async startConversation(sessionId: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/chat/sessions/${sessionId}/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error('Failed to start conversation');
    }
  }

  static createEventSource(sessionId: string): EventSource {
    return new EventSource(`${API_BASE_URL}/chat/sessions/${sessionId}/stream`);
  }
}
