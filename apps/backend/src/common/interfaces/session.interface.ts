export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface Session {
  id: string;
  messages: Message[];
  questionsAnswered: number;
  isComplete: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateSessionDto {
  id?: string;
}

export interface SendMessageDto {
  message: string;
}
