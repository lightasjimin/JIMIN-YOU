
import { GoogleGenAI, Type } from "@google/genai";
import { ChatMessage, SessionSummary, QuizQuestion } from "../types";

// Initialize with named parameter 'apiKey'
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || "" });

export const explainConceptWithImage = async (
  base64Image: string,
  prompt: string
): Promise<string> => {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: {
      parts: [
        {
          inlineData: {
            mimeType: "image/png",
            data: base64Image,
          },
        },
        {
          text: prompt,
        },
      ],
    },
    config: {
      temperature: 0.5,
      systemInstruction: `당신은 효율성을 중시하는 AI 학습 도우미입니다.
핵심만 명확하게 답변하세요. 불필요한 인사말, 꾸밈말, 긴 서론과 결론을 생략합니다.

응답 규칙:
1. 표시된 영역의 개념을 단도직입적으로 정의하세요.
2. 설명은 불렛포인트로 핵심 정보만 전달합니다.
3. 중복되는 설명이나 당연한 말은 삭제하세요.
4. 답변은 최대 3~4문장 이내로 구성하세요.`
    }
  });
  return response.text || "분석 실패.";
};

export const explainConcept = async (
  contextText: string,
  pdfPageText: string,
  userSelectionPrompt: string
): Promise<string> => {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `문맥: ${contextText}\n질문: ${userSelectionPrompt}`,
    config: {
      temperature: 0.5,
      systemInstruction: "당신은 간결함을 추구하는 AI 튜터입니다. 질문에 대해 미사여구 없이 즉각적이고 짧은 답변을 제공하세요. 설명이 길어지는 것을 지양하고 핵심 지식 위주로만 전달합니다."
    }
  });
  return response.text || "답변을 생성할 수 없습니다.";
};

export const summarizeSession = async (
  pdfContent: string,
  notesText: string,
  transcript: string,
  options: { summary: boolean; points: boolean }
): Promise<SessionSummary> => {
  const response = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents: `종합 요약 요청. PDF: ${pdfContent}\n필기: ${notesText}\n음성: ${transcript}\n요청 사항: ${options.summary ? "전체 요약 포함" : ""} ${options.points ? "핵심 포인트 및 출제 포인트 포함" : ""}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          overview: { type: Type.STRING, description: options.summary ? "한 문장 핵심 요약" : "생략" },
          keyPoints: { type: Type.ARRAY, items: { type: Type.STRING }, description: options.points ? "단어 위주의 키워드 리스트" : "빈 배열" },
          examPoints: { type: Type.ARRAY, items: { type: Type.STRING }, description: options.points ? "출제 확률 높은 포인트" : "빈 배열" }
        },
        required: ["overview", "keyPoints", "examPoints"]
      }
    }
  });
  const data = JSON.parse(response.text || "{}");
  return {
    overview: options.summary ? data.overview : "",
    keyPoints: options.points ? data.keyPoints : [],
    examPoints: options.points ? data.examPoints : []
  };
};

export const generateQuiz = async (pdfContent: string, transcript: string): Promise<QuizQuestion[]> => {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `다음 학습 내용을 바탕으로 3개의 복습 퀴즈를 생성하세요: PDF내용: ${pdfContent}, 학습 대화: ${transcript}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            question: { type: Type.STRING },
            type: { type: Type.STRING, enum: ["multiple", "ox", "short"] },
            options: { type: Type.ARRAY, items: { type: Type.STRING } },
            answer: { type: Type.STRING },
            explanation: { type: Type.STRING }
          },
          required: ["question", "type", "answer", "explanation"]
        }
      }
    }
  });
  return JSON.parse(response.text || "[]");
};
