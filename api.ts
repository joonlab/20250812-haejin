/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
/* tslint:disable */

import { GoogleGenAI, File as GenAIFile, GenerateContentResponse, Type } from '@google/genai';

const client = new GoogleGenAI({apiKey: "AIzaSyAQJvP5STofNwyL1mU0aU8VgMH7caFGZhM"});

const analysisSchema = {
  type: Type.OBJECT,
  properties: {
    totalScore: { type: Type.NUMBER, description: "응대 점수 총점 (60점 만점)" },
    summary: {
      type: Type.ARRAY,
      description: "분석 결과에 대한 3~5개 항목의 핵심 요약. 개선 필요 항목은 needsImprovement를 true로 설정합니다.",
      items: {
        type: Type.OBJECT,
        properties: {
          text: { type: Type.STRING, description: "요약 내용" },
          needsImprovement: { type: Type.BOOLEAN, description: "개선이 필요한 항목인 경우 true" }
        },
        required: ['text', 'needsImprovement']
      }
    },
    detailedReport: {
      type: Type.ARRAY,
      description: "체크리스트 항목별 상세 분석 결과",
      items: {
        type: Type.OBJECT,
        properties: {
          category: { type: Type.STRING, description: "평가 단계 (예: 맞이, 무선 컨설팅)" },
          item: { type: Type.STRING, description: "세부 평가 항목 (예: 1-1 맞이인사)" },
          maxPoints: { type: Type.NUMBER, description: "항목의 최대 배점" },
          score: { type: Type.NUMBER, description: "AI가 평가한 점수" },
          feedback: { type: Type.STRING, description: "점수에 대한 구체적인 피드백 및 영상 속 근거. 개선점은 명확히 지적합니다." },
          needsImprovement: { type: Type.BOOLEAN, description: "점수가 낮거나 중요한 지침을 위반하여 개선이 필요한 경우 true" }
        },
        required: ['category', 'item', 'maxPoints', 'score', 'feedback', 'needsImprovement'],
      }
    }
  },
  required: ['totalScore', 'summary', 'detailedReport']
};


async function generateContent(
  formData: { storeCode: string, storeName: string, videoDate: string, staffName: string },
  files: GenAIFile[],
): Promise<GenerateContentResponse> {
  const { storeCode, storeName, videoDate, staffName } = formData;
  
  const prompt = `
You are an expert quality assurance analyst for SK Telecom stores. Your task is to analyze video footage of a customer service interaction and evaluate the employee's performance based on the provided '25. 3Q 방문평가 체크리스트'.
Treat the uploaded videos as one continuous interaction, analyzing the employee's voice (tone, clarity) and motion (gestures, eye contact, posture).

**Analysis Target Information:**
- Store Code: ${storeCode}
- Store Name: ${storeName}
- Filming Date: ${videoDate}
- Employee Name: ${staffName}

**Evaluation Criteria & Critical Scoring Rules (Total 60 points):**
Carefully score each item based on the video evidence. Pay close attention to the following strict rules. Partial points are not awarded unless specified.

*   **1. 맞이 (Greeting) - 10 points**
    *   **1-1. 맞이인사 (5점):** Must stand up, make eye contact, and say the greeting.
        *   **CRITICAL:** The greeting *must* include the phrase "반갑습니다. (${storeName})입니다." using the provided store name. If the store name is omitted, score 0. State in the feedback whether the store name was mentioned.
    *   **1-2. 대기안내 (5점):** Conditional. If the time between the greeting (1-1) and the main consultation (e.g., 2-1) is less than 5 minutes, award full 5 points for immediate service. If 5+ minutes, the employee must provide a wait time estimate. If there's a long delay with no guidance, score 0.

*   **2. 무선 컨설팅 (Wireless Consulting) - 15 points**
    *   **2-1. 요금제 혜택안내 (10점):** Must explain at least 4 features of a recommended 5GX premium plan.
        *   **MOTION ANALYSIS:** The script requires "[스플...고객방향 제시]". You must analyze the video for a motion where the employee presents a tablet-like device (Smart Planner) towards the customer. If this action is not detected, score 0 for this item. Clearly state this failure in the feedback and set \`needsImprovement\` to \`true\`.
    *   **2-2. 요금제 재설계 안내 (5점):** Must inform the customer they can get a plan reassessment after ~6 months.
        *   **CRITICAL:** The guidance MUST be to "매장에 연락 또는 방문" (contact or visit the store). If the employee mentions "고객센터" (Customer Center) for this, score 0. The feedback must specify which guidance was given.
    *   **2-3. 실사용 기반 오퍼링 (-5점 감점 항목):** This is a penalty-only item. If, after recommending a plan, the employee promises to handle the change via "automatic change" ("자동 변경") at the store, it's a violation.
        *   **CRITICAL:** Score -5 if the "automatic change" promise is made. Score 0 if it is not. This penalty is deducted from the total score.
        *   For the JSON output on this item: set \`maxPoints\` to 0, \`score\` to -5 or 0, and \`needsImprovement\` to \`true\` if penalized. The feedback must clearly state if the promise was made.

*   **3. 유선 컨설팅 (Wired Consulting) - 10 points**
    *   **3-1. 유무선 결합 혜택 안내 (5점):** Must explain the benefits of a family bundle for internet/IPTV.
    *   **3-2. 유선 상품 특장점 안내 (5점):** Must explain at least **2** key features of the internet/IPTV products (e.g., speed, channels). If less than 2 features are explained, score 0. List the features that were mentioned in the feedback.

*   **4. 안심응대 (Safety Measures) - 5 points**
    *   **4-1. 스미싱 문의 (2점):**
        *   **CRITICAL:** For a smishing query, all three of the following actions must be performed to earn points: 1) show empathy, 2) check if the link was clicked, AND 3) advise to capture and then delete the message. If any of these are missing, score 0.
    *   **4-2. 휴대폰 점검 안내 (3점):** Must guide the customer on how to run a security check on their phone and inform them about additional measures via the customer center (114).

*   **5. 감사&안심패키지 (Gratitude & Safety Package) - 10 points**
    *   **5-1. 고객감사 패키지 안내 (5점):** Must explain the 3 benefits of the '고객감사 패키지'.
    *   **5-2. 고객안심 패키지 안내 (5점):** Must explain the benefits of the '고객안심 패키지' and provide a reassuring closing statement.

*   **6. 단골/배웅 (Regulars/Farewell) - 10 points**
    *   **6-1. 단골등록 (5점):** Must ask the customer to register as a regular and explain the benefits.
    *   **6-2. 배웅인사 (5점):** Must stand up and give a polite farewell. Score 0 if not standing.

**Output Instruction:**
Provide your final analysis in a structured JSON format that strictly adheres to the provided schema. The feedback must be detailed, constructive, and directly reference observations from the video. All text must be in Korean. For any item where a critical rule was violated or the score is low, set the \`needsImprovement\` flag to \`true\`.
  `;
  
  const fileParts = files
    .map((file) => ({
      fileData: {
        mimeType: file.mimeType,
        fileUri: file.uri,
      },
    }));

  if (fileParts.length === 0) {
    throw new Error("No video files provided for analysis.");
  }
  
  const response = await client.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [
      {
        role: 'user',
        parts: [{text: prompt}, ...fileParts],
      },
    ],
    config: {
      temperature: 0.2,
      responseMimeType: "application/json",
      responseSchema: analysisSchema,
    },
  });

  return response;
}

async function uploadFile(file: File): Promise<GenAIFile> {
  const blob = new Blob([file], {type: file.type});

  console.log(`Uploading ${file.name}...`);
  const uploadedFile = await client.files.upload({
    file: blob,
    config: {
      displayName: file.name,
    },
  });
  console.log(`Uploaded ${file.name}. Waiting for processing...`);

  let getFile = await client.files.get({
    name: uploadedFile.name,
  });

  while (getFile.state === 'PROCESSING') {
    // Wait 5 seconds before checking again.
    await new Promise((resolve) => setTimeout(resolve, 5000));
    try {
        getFile = await client.files.get({
            name: uploadedFile.name,
        });
        console.log(`File ${file.name} status: ${getFile.state}`);
    } catch (e) {
        console.error(`Error getting file status for ${file.name}:`, e);
        throw new Error(`Could not get processing status for file ${file.name}.`);
    }
  }

  if (getFile.state === 'FAILED') {
    throw new Error(`File processing failed for ${file.name}.`);
  }
  
  console.log(`File ${file.name} is ready.`);
  return getFile;
}

export {generateContent, uploadFile};
