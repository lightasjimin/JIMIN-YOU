
export enum ToolType {
  PEN = 'PEN',
  HIGHLIGHTER = 'HIGHLIGHTER',
  ERASER = 'ERASER',
  AI_PEN = 'AI_PEN'
}

export interface Point {
  x: number;
  y: number;
}

export interface Stroke {
  points: Point[];
  type: ToolType;
  color: string;
  width: number;
  page: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

export interface QuizQuestion {
  question: string;
  type: 'multiple' | 'ox' | 'short';
  options?: string[];
  answer: string;
  explanation: string;
}

export interface SessionSummary {
  overview: string;
  keyPoints: string[];
  examPoints: string[];
}
