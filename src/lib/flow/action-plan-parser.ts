import type { ActionPlan } from "@/types";

export const ACTION_PLAN_LIMITS = {
  maxRawJsonLength: 12_000,
  maxScalarLength: 1_000,
  maxArrayItems: 20,
  maxArrayItemLength: 500,
  maxSerializedLength: 6_000,
} as const;

export function parseActionPlanResponse(
  text: string
): Omit<ActionPlan, "referenceAnalysis"> {
  const jsonText = extractJsonObject(text);

  if (!jsonText) {
    throw new Error("Gemini returned an empty or non-JSON action plan response.");
  }

  if (jsonText.length > ACTION_PLAN_LIMITS.maxRawJsonLength) {
    throw new Error(
      `Gemini action plan JSON exceeds ${ACTION_PLAN_LIMITS.maxRawJsonLength} characters.`
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown parse error";
    throw new Error(`Gemini returned invalid JSON for the action plan: ${message}`);
  }

  if (!isRecord(parsed)) {
    throw new Error("Gemini returned an action plan response that was not a JSON object.");
  }

  const intent = requireStringField(parsed, "intent");
  const actionPlan = {
    summary: optionalStringField(parsed, "summary") || intent,
    intent,
    subjects: requireStringArrayField(parsed, "subjects"),
    style: requireStringField(parsed, "style"),
    composition: requireStringField(parsed, "composition"),
    mood: requireStringField(parsed, "mood"),
    technicalNotes: requireStringArrayField(parsed, "technicalNotes"),
  };

  requireSerializedSize(actionPlan);

  return actionPlan;
}

function extractJsonObject(text: string): string | null {
  let trimmed = text.trim();

  if (!trimmed) {
    return null;
  }

  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fencedMatch) {
    trimmed = fencedMatch[1].trim();
  }

  const firstBrace = trimmed.indexOf("{");

  if (firstBrace === -1) {
    return null;
  }

  let depth = 0;
  let isInString = false;
  let isEscaped = false;

  for (let index = firstBrace; index < trimmed.length; index++) {
    const char = trimmed[index];

    if (isInString) {
      if (isEscaped) {
        isEscaped = false;
        continue;
      }

      if (char === "\\") {
        isEscaped = true;
        continue;
      }

      if (char === "\"") {
        isInString = false;
      }

      continue;
    }

    if (char === "\"") {
      isInString = true;
    } else if (char === "{") {
      depth++;
    } else if (char === "}") {
      depth--;

      if (depth === 0) {
        return trimmed.slice(firstBrace, index + 1);
      }
    }
  }

  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireStringField(
  value: Record<string, unknown>,
  fieldName: string
): string {
  const fieldValue = value[fieldName];

  if (typeof fieldValue === "string" && fieldValue.trim()) {
    return requireStringLength(
      fieldValue.trim(),
      fieldName,
      ACTION_PLAN_LIMITS.maxScalarLength
    );
  }

  throw new Error(`Gemini action plan is missing required string field "${fieldName}".`);
}

function optionalStringField(
  value: Record<string, unknown>,
  fieldName: string
): string | undefined {
  const fieldValue = value[fieldName];

  if (typeof fieldValue === "string" && fieldValue.trim()) {
    return requireStringLength(
      fieldValue.trim(),
      fieldName,
      ACTION_PLAN_LIMITS.maxScalarLength
    );
  }

  return undefined;
}

function requireStringArrayField(
  value: Record<string, unknown>,
  fieldName: string
): string[] {
  const fieldValue = value[fieldName];

  if (Array.isArray(fieldValue)) {
    if (fieldValue.length > ACTION_PLAN_LIMITS.maxArrayItems) {
      throw new Error(
        `Gemini action plan list field "${fieldName}" exceeds ${ACTION_PLAN_LIMITS.maxArrayItems} items.`
      );
    }

    const entries = fieldValue
      .map((item, index) => {
        if (typeof item !== "string" || !item.trim()) {
          throw new Error(
            `Gemini action plan list field "${fieldName}" contains an invalid entry at index ${index}.`
          );
        }

        return requireStringLength(
          item.trim(),
          `${fieldName}[${index}]`,
          ACTION_PLAN_LIMITS.maxArrayItemLength
        );
      });

    if (entries.length > 0) {
      return entries;
    }
  }

  if (typeof fieldValue === "string" && fieldValue.trim()) {
    return [
      requireStringLength(
        fieldValue.trim(),
        fieldName,
        ACTION_PLAN_LIMITS.maxArrayItemLength
      ),
    ];
  }

  throw new Error(`Gemini action plan is missing required list field "${fieldName}".`);
}

function requireStringLength(
  value: string,
  fieldName: string,
  maxLength: number
): string {
  if (value.length > maxLength) {
    throw new Error(
      `Gemini action plan field "${fieldName}" exceeds ${maxLength} characters.`
    );
  }

  return value;
}

function requireSerializedSize(
  actionPlan: Omit<ActionPlan, "referenceAnalysis">
): void {
  const serializedLength = JSON.stringify(actionPlan).length;

  if (serializedLength > ACTION_PLAN_LIMITS.maxSerializedLength) {
    throw new Error(
      `Gemini action plan exceeds ${ACTION_PLAN_LIMITS.maxSerializedLength} serialized characters.`
    );
  }
}
