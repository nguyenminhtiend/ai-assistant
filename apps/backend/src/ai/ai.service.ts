import { Injectable } from '@nestjs/common';
import {
  VertexAI,
  HarmCategory,
  HarmBlockThreshold,
} from '@google-cloud/vertexai';
import { Message } from '../common/interfaces/session.interface';

@Injectable()
export class AiService {
  private vertexAI: VertexAI;
  private model: any;

  private readonly LIFESTYLE_QUESTIONS = [
    'How many hours of sleep do you typically get each night?',
    'On a scale of 1-10, how would you rate your stress levels lately?',
    'How would you describe your current diet habits?',
    'How often do you exercise in a typical week?',
    'What are your main health or wellness goals right now?',
  ];

  constructor() {
    // Initialize Vertex AI with your project details
    this.vertexAI = new VertexAI({
      project: process.env.GCP_PROJECT_ID,
      location: process.env.GCP_LOCATION,
    });

    // Initialize Gemini Flash model
    this.model = this.vertexAI.preview.getGenerativeModel({
      model: 'gemini-2.0-flash',
      generationConfig: {
        maxOutputTokens: 8192,
        temperature: 0.7,
        topP: 0.95,
      },
      safetySettings: [
        {
          category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
          threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
          threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
          threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_HARASSMENT,
          threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        },
      ],
    });
  }

  async *generateStreamResponse(
    messages: Message[],
    questionsAnswered: number,
  ): AsyncGenerator<string> {
    const systemPrompt = this.buildSystemPrompt(questionsAnswered);
    const conversationHistory = this.formatMessages(messages);

    const prompt = `${systemPrompt}\n\nConversation History:\n${conversationHistory}`;

    try {
      const streamingResp = await this.model.generateContentStream(prompt);

      for await (const item of streamingResp.stream) {
        const text = item.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          yield text;
        }
      }
    } catch (error) {
      console.error('Error generating stream response:', error);
      yield 'I apologize, but I encountered an error. Please try again.';
    }
  }

  private buildSystemPrompt(questionsAnswered: number): string {
    const nextQuestion =
      questionsAnswered < 5
        ? this.LIFESTYLE_QUESTIONS[questionsAnswered]
        : null;

    if (questionsAnswered === 0) {
      return `You are a friendly health and wellness assistant. Start by greeting the user warmly and then ask the first lifestyle question: "${this.LIFESTYLE_QUESTIONS[0]}". Keep your greeting brief and natural.`;
    }

    if (nextQuestion) {
      return `You are a friendly health and wellness assistant conducting a lifestyle assessment.
      The user has answered ${questionsAnswered} out of 5 questions.

      Your task:
      1. Acknowledge their previous response briefly and positively
      2. Ask the next question: "${nextQuestion}"
      3. Keep your response conversational and encouraging

      Important: Only move to the next question if the user has provided a relevant answer to the current question.`;
    }

    return `You are a friendly health and wellness assistant. The user has completed all 5 lifestyle questions.
    Thank them for completing the assessment and provide a brief, encouraging summary of their responses.
    Let them know their responses have been recorded and they can continue chatting or start a new session if they'd like.`;
  }

  private formatMessages(messages: Message[]): string {
    return messages
      .map(
        (msg) =>
          `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`,
      )
      .join('\n');
  }

  getQuestionCount(): number {
    return this.LIFESTYLE_QUESTIONS.length;
  }
}
