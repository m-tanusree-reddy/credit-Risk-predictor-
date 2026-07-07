import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Lazy-initialized Gemini client to prevent app startup crashes when key is missing
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not defined. Add it to frontend/.env.local to enable document extraction.");
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

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Increase payload limit for base64 file uploads (PDF/Images)
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // API Route: Document auto-extraction using Gemini OCR and structured output
  app.post("/api/extract", async (req, res) => {
    try {
      const { fileBase64, mimeType, fileName } = req.body;
      if (!fileBase64 || !mimeType) {
        return res.status(400).json({ error: "Missing required fields: fileBase64 and mimeType" });
      }

      // Strip potential base64 prefix if the frontend sent it
      const cleanBase64 = fileBase64.replace(/^data:[^;]+;base64,/, "");

      // Get the lazy-initialized Gemini client
      const ai = getGeminiClient();

      // System instruction for credit risk variables extraction
      const systemInstruction = `You are an expert loan underwriter and OCR parser. Your job is to extract financial data from the uploaded document (Bank Statement, Salary Slip, Credit Report, or Loan Application). 
Perform OCR on the text, locate relevant variables, and output them strictly according to the requested JSON schema.
If a value is not explicitly stated in the document, make a reasonable, realistic credit underwriting estimate based on standard industry guidelines, and never leave fields empty. 
Ensure names match the document exactly, and estimated monthly debtRatio is between 0.0 and 1.5.`;

      const promptText = `Analyze this uploaded credit assessment document (${fileName || "document"}). Extract the applicant details and financial metrics into the requested JSON schema.`;

      // Define standard schema structure
      const responseSchema = {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING, description: "The full name of the applicant. If not found, use a realistic sample name." },
          age: { type: Type.INTEGER, description: "The age of the applicant. Estimate or use a realistic number between 18 and 80 if not found." },
          income: { type: Type.NUMBER, description: "Monthly income in dollars. If annual is found, divide by 12. Use a realistic estimate if not found." },
          dependents: { type: Type.INTEGER, description: "Number of dependents. Default to 0 if not specified." },
          debtRatio: { type: Type.NUMBER, description: "Debt-to-income ratio (between 0.0 and 1.5). Estimate based on monthly debts / monthly income if not directly stated. Default to 0.35 if not found." },
          openCreditLines: { type: Type.INTEGER, description: "Number of open credit lines/accounts. Default to 8 if not found." },
          realEstateLoans: { type: Type.INTEGER, description: "Number of real estate loans or mortgage lines. Default to 1 if not found." },
          creditUtilization: { type: Type.NUMBER, description: "Credit utilization percentage (between 0.0 and 100.0). E.g. 35.5. Default to 30.0 if not found." },
          late3059: { type: Type.INTEGER, description: "Number of times 30-59 days past due. Default to 0." },
          late6089: { type: Type.INTEGER, description: "Number of times 60-89 days past due. Default to 0." },
          late90Plus: { type: Type.INTEGER, description: "Number of times 90+ days past due. Default to 0." },
          documentType: { type: Type.STRING, description: "Identified document type (e.g., 'Bank Statement', 'Salary Slip', 'Credit Report', 'Loan Application')." }
        },
        required: [
          "name", "age", "income", "dependents", "debtRatio", 
          "openCreditLines", "realEstateLoans", "creditUtilization", "late3059", 
          "late6089", "late90Plus", "documentType"
        ]
      };

      const documentPart = {
        inlineData: {
          data: cleanBase64,
          mimeType: mimeType
        }
      };

      const textPart = {
        text: promptText
      };

      // Call Gemini 3.5 Flash for multimodal processing
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: { parts: [documentPart, textPart] },
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema
        }
      });

      const jsonText = response.text?.trim() || "{}";
      const parsedData = JSON.parse(jsonText);

      return res.json({ success: true, data: parsedData });
    } catch (error: any) {
      console.error("Gemini Extraction Error:", error);
      return res.status(500).json({ 
        success: false, 
        error: error?.message || "Internal server error during document parsing",
        details: "Ensure your GEMINI_API_KEY is configured in Settings > Secrets."
      });
    }
  });

  // Serve static assets or mount Vite dev server
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Server] Credit Risk Predictor full-stack backend running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start full-stack server:", err);
  process.exit(1);
});
