import type { ActionPlan, ThinkingStep, Asset } from "@/types";
import { downloadImage } from "@/lib/storage/b2-client";

// Lazy load GoogleGenAI to avoid blocking dev server startup
let GoogleGenAIClass: typeof import("@google/genai").GoogleGenAI | null = null;
async function getGoogleAI(): Promise<typeof import("@google/genai").GoogleGenAI> {
  if (!GoogleGenAIClass) {
    const module = await import("@google/genai");
    GoogleGenAIClass = module.GoogleGenAI;
  }
  return GoogleGenAIClass;
}

async function analyzeReferenceImages(assets: Asset[]): Promise<string> {
  if (assets.length === 0) {
    return "";
  }

  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) {
    return "Unable to analyze reference images: API key not configured";
  }

  try {
    const GoogleAI = await getGoogleAI();
    const client = new GoogleAI({ apiKey });
    const imageDataList = await Promise.all(
      assets.map(async (asset) => {
        const buffer = await downloadImage(asset.b2Key);
        return {
          inlineData: {
            data: buffer.toString("base64"),
            mimeType: asset.mime,
          },
        };
      })
    );

    const response = await client.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            {
              text: assets.length === 1
                ? "Analyze this reference image in detail. Describe the visual elements, style, composition, colors, mood, subjects, and any notable artistic or technical characteristics. Be specific and comprehensive."
                : `Analyze these ${assets.length} reference images in detail. For each image, describe the visual elements, style, composition, colors, mood, subjects, and any notable artistic or technical characteristics. Number each analysis (Image 1:, Image 2:, etc.) to clearly distinguish between them. Be specific and comprehensive.`,
            },
            ...imageDataList,
          ],
        },
      ],
    });

    const text = response.candidates?.[0]?.content?.parts?.[0]?.text || "";
    return text.trim();
  } catch (error) {
    console.error("Error analyzing reference images:", error);

    if (error instanceof Error) {
      const errorMessage = error.message;

      // Check for quota/rate limit errors
      if (errorMessage.includes("429") || errorMessage.includes("RESOURCE_EXHAUSTED") || errorMessage.includes("quota")) {
        return "Unable to analyze reference images due to API quota limits. The images will still be available, but automated analysis is temporarily unavailable.";
      }

      // Check for authentication errors
      if (errorMessage.includes("401") || errorMessage.includes("API key")) {
        return "Unable to analyze reference images: API authentication failed.";
      }

      return `Unable to analyze reference images: ${errorMessage.substring(0, 150)}`;
    }

    return "Unable to analyze reference images due to an unexpected error.";
  }
}

export async function generateActionPlan(
  userRequest: string,
  referenceAssets: Asset[] = []
): Promise<ActionPlan> {
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) {
    throw new Error("Unable to analyze request: API key not configured");
  }

  try {
    const GoogleAI = await getGoogleAI();
    const client = new GoogleAI({ apiKey });
    // First, analyze reference images if provided
    let referenceAnalysis: string | undefined;
    if (referenceAssets.length > 0) {
      referenceAnalysis = await analyzeReferenceImages(referenceAssets);
    }

    // Build the analysis prompt
    const systemPrompt = `You are an expert at analyzing image generation requests. Analyze the user's request and provide a structured breakdown.

${referenceAnalysis ? `REFERENCE IMAGES ANALYSIS:\n${referenceAnalysis}\n\n` : ""}

Analyze the following image generation request and provide:
1. Summary: A natural 2-3 sentence narrative describing what will be created and key considerations
2. Intent: A clear statement of what the user wants to create
3. Subjects: List the main subjects/elements (comma-separated)
4. Style: The artistic style (e.g., photorealistic, cartoon, oil painting, watercolor, sketch, 3D render, pixel art)
5. Composition: The framing/composition (e.g., close-up, wide shot, centered, portrait framing)
6. Mood: The atmosphere/mood (e.g., bright/cheerful, dark/dramatic, serene/peaceful, mysterious/ethereal, neutral)
7. Technical Notes: Lighting, detail level, and other technical aspects (list up to 3 key points)

${referenceAnalysis ? "If reference images are provided, consider their visual characteristics when analyzing the request. The user may want to incorporate elements, style, or composition from the reference images." : ""}

Return your analysis in this exact JSON format:
{
  "summary": "Natural narrative summary of the generation plan",
  "intent": "Clear description of what to generate",
  "subjects": ["subject1", "subject2"],
  "style": "style name",
  "composition": "composition type",
  "mood": "mood description",
  "technicalNotes": ["note1", "note2", "note3"]
}

User request: "${userRequest}"`;

    const response = await client.models.generateContent({
      model: "gemini-2.5-flash",
      contents: systemPrompt,
    });

    const text = response.candidates?.[0]?.content?.parts?.[0]?.text || "";

    // Extract JSON from response (handle markdown code blocks)
    let jsonText = text.trim();
    if (jsonText.startsWith("```json")) {
      jsonText = jsonText.slice(7, -3).trim();
    } else if (jsonText.startsWith("```")) {
      jsonText = jsonText.slice(3, -3).trim();
    }

    const analysis = JSON.parse(jsonText);

    return {
      summary: analysis.summary || analysis.intent,
      intent: analysis.intent,
      subjects: Array.isArray(analysis.subjects) ? analysis.subjects : [analysis.subjects],
      style: analysis.style,
      composition: analysis.composition,
      mood: analysis.mood,
      technicalNotes: Array.isArray(analysis.technicalNotes) ? analysis.technicalNotes : [analysis.technicalNotes],
      referenceAnalysis,
    };
  } catch (error) {
    console.error("Error generating action plan:", error);

    // Parse Google AI API errors for user-friendly messages
    if (error instanceof Error) {
      const errorMessage = error.message;

      // Check for quota/rate limit errors
      if (errorMessage.includes("429") || errorMessage.includes("RESOURCE_EXHAUSTED") || errorMessage.includes("quota")) {
        throw new Error(
          "API quota exceeded. The Gemini API has rate limits that reset daily. " +
          "Please try again in a few minutes or consider upgrading your API plan at https://ai.google.dev/pricing"
        );
      }

      // Check for authentication errors
      if (errorMessage.includes("401") || errorMessage.includes("API key")) {
        throw new Error("API authentication failed. Please check your Google AI API key configuration.");
      }

      // Generic error fallback
      throw new Error(`Request analysis failed: ${errorMessage.substring(0, 200)}`);
    }

    throw new Error("An unexpected error occurred while analyzing your request.");
  }
}

export async function* generateThinkingTrace(
  userRequest: string,
  actionPlan: ActionPlan
): AsyncGenerator<ThinkingStep> {
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) {
    throw new Error("Unable to generate thinking trace: API key not configured");
  }

  try {
    const GoogleAI = await getGoogleAI();
    const client = new GoogleAI({ apiKey });

    const prompt = `You are an expert at crafting prompts for Imagen and other advanced image generation models.

USER'S REQUEST: "${userRequest}"

${actionPlan.referenceAnalysis ? `REFERENCE IMAGES PROVIDED:
${actionPlan.referenceAnalysis}

` : ""}REQUEST ANALYSIS:
- Intent: ${actionPlan.intent}
- Main Subjects: ${actionPlan.subjects.join(", ")}
- Desired Style: ${actionPlan.style}
- Composition: ${actionPlan.composition}
- Mood/Atmosphere: ${actionPlan.mood}
- Technical Considerations: ${actionPlan.technicalNotes.join(", ")}

Following best practices for Imagen prompts, break down your reasoning into these specific steps:

**PART 1: ESTABLISHING THE VISION**

1. **Subject Definition**: Define who or what is in the image. Be highly specific about:
   - Physical appearance and key characteristics
   - Specific details that distinguish the subject
   - Any important attributes or features

2. **Action & Moment**: Describe what is happening in the scene:
   - The specific action or pose
   - The moment being captured
   - Dynamic elements or movement

3. **Location & Environment**: Establish where the scene takes place:
   - Specific setting or environment
   - Environmental details that set the scene
   - Spatial relationships between elements

4. **Style & Aesthetic**: Define the overall visual treatment:
   - Specific art style, medium, or photographic approach
   - Historical period or era (if relevant)
   - Visual references or aesthetic movements

${actionPlan.referenceAnalysis ? `5. **Reference Integration**: How to incorporate the reference images:
   - Which visual elements to adopt from each reference
   - How to blend reference styles with the user's request
   - Specific aspects to emulate (pose, lighting, mood, composition, etc.)

` : ""}**PART 2: REFINING THE DETAILS**

${actionPlan.referenceAnalysis ? "6" : "5"}. **Composition & Framing**: Define the visual structure:
   - Camera angle and shot type (close-up, wide shot, etc.)
   - Framing and aspect ratio considerations
   - Visual hierarchy and focal points

${actionPlan.referenceAnalysis ? "7" : "6"}. **Lighting & Atmosphere**: Specify technical lighting details:
   - Type of lighting (natural, studio, golden hour, etc.)
   - Light direction and quality (soft, hard, dramatic)
   - Color temperature and mood created by lighting
   - Depth of field and camera settings (if photographic)

${actionPlan.referenceAnalysis ? "8" : "7"}. **Technical Specifications**: Define quality and format:
   - Level of detail and realism
   - Color grading or color palette
   - Texture and material properties
   - Any specific technical requirements (film grain, rendering style, etc.)

For each step, provide detailed reasoning with specific examples and choices. Use markdown formatting with bullet points for clarity. Be thorough and precise.`;

    const stream = await client.models.generateContentStream({
      model: "gemini-2.5-pro",
      contents: prompt,
    });

    let fullText = "";

    // Collect all chunks first
    for await (const chunk of stream) {
      const text = chunk.candidates?.[0]?.content?.parts?.[0]?.text || "";
      fullText += text;
    }

    // Parse into natural sections based on how the LLM structured it
    // Look for numbered sections (1., 2., etc.) or markdown headers (**, ##, etc.)
    const sections = parseThinkingSections(fullText);

    for (const section of sections) {
      yield section;
    }
  } catch (error) {
    console.error("Error generating thinking trace:", error);

    // Parse Google AI API errors for user-friendly messages
    if (error instanceof Error) {
      const errorMessage = error.message;

      // Check for quota/rate limit errors
      if (errorMessage.includes("429") || errorMessage.includes("RESOURCE_EXHAUSTED") || errorMessage.includes("quota")) {
        throw new Error(
          "API quota exceeded. The Gemini API has rate limits that reset daily. " +
          "Please try again in a few minutes or consider upgrading your API plan at https://ai.google.dev/pricing"
        );
      }

      // Check for authentication errors
      if (errorMessage.includes("401") || errorMessage.includes("API key")) {
        throw new Error("API authentication failed. Please check your Google AI API key configuration.");
      }

      // Check for model availability errors
      if (errorMessage.includes("model") && errorMessage.includes("not found")) {
        throw new Error("The requested AI model is not available. Please check your configuration.");
      }

      // Generic error fallback
      throw new Error(`Failed to generate thinking steps: ${errorMessage.substring(0, 200)}`);
    }

    throw new Error("An unexpected error occurred while generating thinking steps.");
  }
}

function parseThinkingSections(text: string): ThinkingStep[] {
  const sections: ThinkingStep[] = [];

  // Split by numbered sections like "1.", "2.", etc.
  const numberedPattern = /^(\d+)\.\s*\*\*([^*]+)\*\*:?\s*/gm;
  let lastIndex = 0;
  let match;
  const matches: Array<{ index: number; stepName: string }> = [];

  // Find all section headers
  while ((match = numberedPattern.exec(text)) !== null) {
    matches.push({
      index: match.index,
      stepName: match[2].trim(),
    });
  }

  // Extract content for each section
  for (let i = 0; i < matches.length; i++) {
    const currentMatch = matches[i];
    const nextMatch = matches[i + 1];

    const startIndex = currentMatch.index;
    const endIndex = nextMatch ? nextMatch.index : text.length;

    let content = text.slice(startIndex, endIndex).trim();

    // Remove the header from content
    content = content.replace(/^\d+\.\s*\*\*[^*]+\*\*:?\s*/, "").trim();

    if (content) {
      sections.push({
        step: currentMatch.stepName,
        reasoning: content,
      });
    }
  }

  // If no structured sections found, return the full text as one step
  if (sections.length === 0 && text.trim()) {
    sections.push({
      step: "Analysis",
      reasoning: text.trim(),
    });
  }

  return sections;
}

export async function constructPrompt(
  userRequest: string,
  actionPlan: ActionPlan,
  thinkingSteps: ThinkingStep[]
): Promise<string> {
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) {
    // Fallback to basic prompt construction
    return constructBasicPrompt(userRequest, actionPlan);
  }

  try {
    const GoogleAI = await getGoogleAI();
    const client = new GoogleAI({ apiKey });

    // Build context from thinking steps
    const thinkingContext = thinkingSteps
      .map((step) => `${step.step}: ${step.reasoning}`)
      .join("\n");

    const systemPrompt = `You are an expert at writing optimized prompts for Imagen and other advanced image generation models.

ORIGINAL REQUEST: "${userRequest}"

REQUEST ANALYSIS:
- Intent: ${actionPlan.intent}
- Subjects: ${actionPlan.subjects.join(", ")}
- Style: ${actionPlan.style}
- Composition: ${actionPlan.composition}
- Mood: ${actionPlan.mood}
- Technical Notes: ${actionPlan.technicalNotes.join(", ")}

${actionPlan.referenceAnalysis ? `REFERENCE IMAGES:\n${actionPlan.referenceAnalysis}\n\n` : ""}

DETAILED THINKING PROCESS:
${thinkingContext}

Based on the comprehensive analysis above, synthesize an optimized prompt for image generation. The prompt should:

1. **Be highly specific and descriptive** - Include all key details from the thinking steps
2. **Follow the Imagen prompt structure** - Subject, action, location, style, composition, lighting
3. **Incorporate technical details** - Camera settings, lighting quality, color grading, textures${actionPlan.referenceAnalysis ? `
4. **Integrate reference elements** - Explicitly reference visual elements from the provided images` : ""}
${actionPlan.referenceAnalysis ? "5" : "4"}. **Use precise terminology** - Professional photography/art terms that models understand well
${actionPlan.referenceAnalysis ? "6" : "5"}. **Be comprehensive yet concise** - 3-5 sentences that capture all essential elements

Return ONLY the final prompt text, nothing else. Make it production-ready for professional image generation.`;

    const response = await client.models.generateContent({
      model: "gemini-2.5-flash",
      contents: systemPrompt,
    });

    const prompt = response.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";

    if (!prompt) {
      return constructBasicPrompt(userRequest, actionPlan);
    }

    return prompt;
  } catch (error) {
    console.error("Error constructing prompt with LLM:", error);

    // For prompt construction, fall back to basic prompt rather than failing
    // This ensures the generation can continue even if the AI-enhanced prompt fails
    if (error instanceof Error) {
      const errorMessage = error.message;

      // Log quota errors but don't throw - use fallback instead
      if (errorMessage.includes("429") || errorMessage.includes("RESOURCE_EXHAUSTED") || errorMessage.includes("quota")) {
        console.warn("API quota exceeded during prompt construction, using fallback prompt");
      }
    }

    return constructBasicPrompt(userRequest, actionPlan);
  }
}

function constructBasicPrompt(userRequest: string, actionPlan: ActionPlan): string {
  const parts: string[] = [];

  // Core description
  parts.push(userRequest);

  // Style addition
  if (actionPlan.style !== "photorealistic") {
    parts.push(`in ${actionPlan.style} style`);
  } else {
    parts.push("photorealistic, highly detailed");
  }

  // Composition
  parts.push(`${actionPlan.composition} composition`);

  // Mood
  parts.push(`${actionPlan.mood} atmosphere`);

  // Technical notes
  parts.push(...actionPlan.technicalNotes);

  // Quality boosters
  parts.push("high quality", "professional", "masterful execution");

  return parts.join(", ");
}
