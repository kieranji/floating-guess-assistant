import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY
});

async function main() {
  const models = await ai.models.list();

  for await (const model of models) {
    console.log(model.name, model.supportedActions || model.supportedGenerationMethods || "");
  }
}

main().catch((error) => {
  console.error(error);
});