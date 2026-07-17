import { GoogleGenAI, Type } from "@google/genai";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import dotenv from "dotenv";

dotenv.config();

let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not defined. Add it to environment variables.");
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const { fileBase64, mimeType, fileName } = req.body;
    if (!fileBase64 || !mimeType) {
      return res.status(400).json({ error: "Missing required fields: fileBase64 and mimeType" });
    }

    const cleanBase64 = fileBase64.replace(/^data:[^;]+;base64,/, "");
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not defined. Add it to environment variables to enable document extraction.");
    }

    const systemInstruction = `You are an expert loan underwriter and OCR parser. Your job is to extract financial data from the uploaded document (Bank Statement, Salary Slip, Credit Report, or Loan Application). 
Perform OCR on the text, locate relevant variables, and output them strictly according to the requested JSON schema.
If a value is not explicitly stated in the document, make a reasonable, realistic credit underwriting estimate based on standard industry guidelines, and never leave fields empty. 
Ensure names match the document exactly, and estimated monthly debtRatio is between 0.0 and 1.5.`;

    const promptText = `Analyze this uploaded credit assessment document (${fileName || "document"}). Extract the applicant details and financial metrics into the requested JSON schema.`;

    let parsedData;

    if (apiKey.startsWith("sk-or-")) {
      const responseSchemaText = `{
        "type": "object",
        "properties": {
          "name": { "type": "string", "description": "The full name of the applicant. If not found, use a realistic sample name." },
          "age": { "type": "integer", "description": "The age of the applicant. Estimate or use a realistic number between 18 and 80 if not found." },
          "income": { "type": "number", "description": "Monthly income in dollars. If annual is found, divide by 12. Use a realistic estimate if not found." },
          "dependents": { "type": "integer", "description": "Number of dependents. Default to 0 if not specified." },
          "debtRatio": { "type": "number", "description": "Debt-to-income ratio (between 0.0 and 1.5). Estimate based on monthly debts / monthly income if not directly stated. Default to 0.35 if not found." },
          "openCreditLines": { "type": "integer", "description": "Number of open credit lines/accounts. Default to 8 if not found." },
          "realEstateLoans": { "type": "integer", "description": "Number of real estate loans or mortgage lines. Default to 1 if not found." },
          "creditUtilization": { "type": "number", "description": "Credit utilization percentage (between 0.0 and 100.0). E.g. 35.5. Default to 30.0 if not found." },
          "late3059": { "type": "integer", "description": "Number of times 30-59 days past due. Default to 0." },
          "late6089": { "type": "integer", "description": "Number of times 60-89 days past due. Default to 0." },
          "late90Plus": { "type": "integer", "description": "Number of times 90+ days past due. Default to 0." },
          "documentType": { "type": "string", "description": "Identified document type (e.g., 'Bank Statement', 'Salary Slip', 'Credit Report', 'Loan Application')." }
        },
        "required": [
          "name", "age", "income", "dependents", "debtRatio", 
          "openCreditLines", "realEstateLoans", "creditUtilization", "late3059", 
          "late6089", "late90Plus", "documentType"
        ]
      }`;

      const openRouterResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
          "HTTP-Referer": "https://github.com/m-tanusree-reddy/credit-Risk-predictor-",
          "X-Title": "Credinity AI"
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: systemInstruction },
            { 
              role: "user", 
              content: [
                { type: "text", text: promptText },
                {
                  type: "image_url",
                  image_url: {
                    url: `data:${mimeType};base64,${cleanBase64}`
                  }
                }
              ]
            }
          ],
          response_format: { type: "json_object" }
        })
      });

      if (!openRouterResponse.ok) {
        const errText = await openRouterResponse.text();
        throw new Error(`OpenRouter API failed: ${errText}`);
      }

      const openRouterData = await openRouterResponse.json();
      const rawText = openRouterData.choices?.[0]?.message?.content;
      if (!rawText) throw new Error("Empty response from OpenRouter");
      parsedData = JSON.parse(rawText);
    } else {
      const client = getGeminiClient();
      const response = await client.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
          promptText,
          {
            inlineData: {
              mimeType: mimeType,
              data: cleanBase64
            }
          }
        ],
        config: {
          systemInstruction: systemInstruction,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING, description: "Applicant's name" },
              age: { type: Type.INTEGER, description: "Age" },
              income: { type: Type.NUMBER, description: "Monthly income" },
              dependents: { type: Type.INTEGER, description: "Number of dependents" },
              debtRatio: { type: Type.NUMBER, description: "Debt-to-income ratio (0.0 to 1.5)" },
              openCreditLines: { type: Type.INTEGER, description: "Number of open credit lines" },
              realEstateLoans: { type: Type.INTEGER, description: "Number of mortgage loans" },
              creditUtilization: { type: Type.NUMBER, description: "Credit utilization (0.0 to 100.0)" },
              late3059: { type: Type.INTEGER, description: "Delinquency count 30-59 days" },
              late6089: { type: Type.INTEGER, description: "Delinquency count 60-89 days" },
              late90Plus: { type: Type.INTEGER, description: "Delinquency count 90+ days" },
              documentType: { type: Type.STRING, description: "Doc type description" }
            },
            required: [
              "name", "age", "income", "dependents", "debtRatio", 
              "openCreditLines", "realEstateLoans", "creditUtilization", 
              "late3059", "late6089", "late90Plus", "documentType"
            ]
          }
        }
      });

      const text = response.text;
      if (!text) throw new Error("Empty response from Gemini API");
      parsedData = JSON.parse(text);
    }

    return res.status(200).json({
      success: true,
      data: {
        name: parsedData.name,
        age: Number(parsedData.age),
        income: Number(parsedData.income),
        dependents: Number(parsedData.dependents),
        debtRatio: Number(parsedData.debtRatio),
        openCreditLines: Number(parsedData.openCreditLines),
        realEstateLoans: Number(parsedData.realEstateLoans),
        creditUtilization: Number(parsedData.creditUtilization),
        late3059: Number(parsedData.late3059),
        late6089: Number(parsedData.late6089),
        late90Plus: Number(parsedData.late90Plus),
        documentType: parsedData.documentType
      }
    });
  } catch (error: any) {
    console.error("Vercel api/extract error:", error);
    return res.status(500).json({
      success: false,
      error: "AI document extraction failed: " + error.message
    });
  }
}
