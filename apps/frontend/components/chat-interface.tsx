'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Send, Loader2, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { ChatAPI, Session, Message, SessionDetail } from '@/lib/api';
import { cn } from '@/lib/utils';

export function ChatInterface() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentSession, setCurrentSession] = useState<SessionDetail | null>(null);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState('');
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Load sessions on mount
  useEffect(() => {
    loadSessions();
  }, []);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [messages, streamingMessage]);

  const loadSessions = async () => {
    try {
      const allSessions = await ChatAPI.getAllSessions();
      setSessions(allSessions);
    } catch (error) {
      console.error('Failed to load sessions:', error);
    }
  };

  const createNewSession = async () => {
    try {
      setIsLoading(true);
      const newSession = await ChatAPI.createSession();
      await loadSessions();
      await selectSession(newSession.id);

      // Start the conversation automatically
      await ChatAPI.startConversation(newSession.id);
      connectToStream(newSession.id);
    } catch (error) {
      console.error('Failed to create session:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const selectSession = async (sessionId: string) => {
    try {
      const sessionDetail = await ChatAPI.getSession(sessionId);
      setCurrentSession(sessionDetail);
      setCurrentSessionId(sessionId);
      setMessages(sessionDetail.messages || []);
      setStreamingMessage('');

      // Disconnect previous stream
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    } catch (error) {
      console.error('Failed to load session:', error);
    }
  };

  const deleteSession = async (sessionId: string) => {
    try {
      await ChatAPI.deleteSession(sessionId);
      await loadSessions();

      if (currentSessionId === sessionId) {
        setCurrentSession(null);
        setCurrentSessionId(null);
        setMessages([]);
        setStreamingMessage('');

        if (eventSourceRef.current) {
          eventSourceRef.current.close();
          eventSourceRef.current = null;
        }
      }
    } catch (error) {
      console.error('Failed to delete session:', error);
    }
  };

  const connectToStream = (sessionId: string) => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const eventSource = ChatAPI.createEventSource(sessionId);
    eventSourceRef.current = eventSource;
    setIsStreaming(true);
    setStreamingMessage('');

    let accumulatedContent = '';

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === 'chunk') {
          accumulatedContent += data.content;
          setStreamingMessage(accumulatedContent);
        } else if (data.type === 'complete') {
          const assistantMessage: Message = {
            id: data.messageId,
            role: 'assistant',
            content: accumulatedContent,
            timestamp: new Date().toISOString()
          };

          setMessages((prev) => [...prev, assistantMessage]);
          setStreamingMessage('');
          setIsStreaming(false);
          eventSource.close();
          eventSourceRef.current = null;
          accumulatedContent = '';

          // Update session info
          loadSessions();
          if (currentSessionId) {
            selectSession(currentSessionId);
          }
        } else if (data.type === 'error') {
          console.error('Stream error:', data.error);
          setIsStreaming(false);
          setStreamingMessage('');
          eventSource.close();
          eventSourceRef.current = null;
          accumulatedContent = '';
        }
      } catch (error) {
        console.error('Failed to parse SSE data:', error);
      }
    };

    eventSource.onerror = (error) => {
      console.error('SSE connection error:', error);
      setIsStreaming(false);
      setStreamingMessage('');
      eventSource.close();
      eventSourceRef.current = null;
    };
  };

  const sendMessage = async () => {
    if (!input.trim() || !currentSessionId || isStreaming) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date().toISOString()
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');

    try {
      await ChatAPI.sendMessage(currentSessionId, userMessage.content);
      connectToStream(currentSessionId);
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <div className="w-80 border-r bg-card">
        <div className="p-4">
          <Button onClick={createNewSession} className="w-full" disabled={isLoading}>
            {isLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Plus className="mr-2 h-4 w-4" />
            )}
            New Session
          </Button>
        </div>

        <Separator />

        <ScrollArea className="h-[calc(100vh-80px)]">
          <div className="p-4 space-y-2">
            {sessions.map((session) => (
              <Card
                key={session.id}
                className={cn(
                  'cursor-pointer transition-colors hover:bg-accent',
                  currentSessionId === session.id && 'bg-accent'
                )}
                onClick={() => selectSession(session.id)}
              >
                <CardContent className="p-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="text-sm font-medium">Session {session.id.slice(0, 8)}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(session.createdAt).toLocaleString()}
                      </p>
                      <div className="flex gap-2 mt-2">
                        <Badge variant={session.isComplete ? 'default' : 'secondary'}>
                          {session.questionsAnswered}/5 Questions
                        </Badge>
                        {session.isComplete && <Badge variant="default">Complete</Badge>}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteSession(session.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {currentSession ? (
          <>
            <CardHeader className="border-b">
              <CardTitle>Chat Session: {currentSessionId?.slice(0, 8)}</CardTitle>
              <div className="flex gap-2">
                <Badge variant={currentSession.isComplete ? 'default' : 'secondary'}>
                  {currentSession.questionsAnswered}/5 Questions
                </Badge>
                {currentSession.isComplete && <Badge variant="default">Session Complete</Badge>}
              </div>
            </CardHeader>

            <ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
              <div className="space-y-4 max-w-3xl mx-auto">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={cn(
                      'flex',
                      message.role === 'user' ? 'justify-end' : 'justify-start'
                    )}
                  >
                    <Card
                      className={cn(
                        'max-w-[80%]',
                        message.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'
                      )}
                    >
                      <CardContent className="p-3">
                        <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                      </CardContent>
                    </Card>
                  </div>
                ))}

                {streamingMessage && (
                  <div className="flex justify-start">
                    <Card className="max-w-[80%] bg-muted">
                      <CardContent className="p-3">
                        <p className="text-sm whitespace-pre-wrap">{streamingMessage}</p>
                        <Loader2 className="h-3 w-3 animate-spin mt-2" />
                      </CardContent>
                    </Card>
                  </div>
                )}
              </div>
            </ScrollArea>

            <CardFooter className="border-t p-4">
              <div className="flex w-full max-w-3xl mx-auto gap-2">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Type your message..."
                  disabled={isStreaming || currentSession.isComplete}
                />
                <Button
                  onClick={sendMessage}
                  disabled={!input.trim() || isStreaming || currentSession.isComplete}
                >
                  {isStreaming ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </CardFooter>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <Card className="max-w-md">
              <CardContent className="p-6 text-center">
                <h2 className="text-2xl font-bold mb-4">Welcome to AI Health Assistant</h2>
                <p className="text-muted-foreground mb-6">
                  Start a new session to begin your lifestyle assessment. I'll ask you 5 questions
                  about your sleep, stress, diet, and exercise habits.
                </p>
                <Button onClick={createNewSession} size="lg" disabled={isLoading}>
                  {isLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="mr-2 h-4 w-4" />
                  )}
                  Start New Session
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
