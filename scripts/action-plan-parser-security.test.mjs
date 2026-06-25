import assert from "node:assert/strict";
import { readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const parserPath = path.join(repoRoot, "src/lib/flow/action-plan-parser.ts");

const { ACTION_PLAN_LIMITS, parseActionPlanResponse } = await loadParser();

test("accepts a bounded action plan from a fenced Gemini response", () => {
  const result = parseActionPlanResponse(
    `\`\`\`json\n${serializeActionPlan()}\n\`\`\`\nAdditional text with {ignored} braces.`
  );

  assert.equal(result.intent, "Create a calm mountain scene");
  assert.deepEqual(result.subjects, ["mountain", "lake"]);
});

test("extracts the first balanced object from unfenced responses", () => {
  const result = parseActionPlanResponse(
    `${serializeActionPlan()}\nAdditional text with {ignored} braces.`
  );

  assert.equal(result.intent, "Create a calm mountain scene");
  assert.deepEqual(result.technicalNotes, ["soft morning light", "high detail"]);
});

test("rejects blank list entries", () => {
  assert.throws(
    () =>
      parseActionPlanResponse(
        serializeActionPlan({
          subjects: ["mountain", "   "],
        })
      ),
    /subjects.*invalid entry at index 1/
  );
});

test("rejects prompt-injected oversized scalar fields", () => {
  assert.throws(
    () =>
      parseActionPlanResponse(
        serializeActionPlan({
          intent: "x".repeat(ACTION_PLAN_LIMITS.maxScalarLength + 1),
        })
      ),
    /intent.*exceeds/
  );
});

test("rejects prompt-injected oversized arrays", () => {
  assert.throws(
    () =>
      parseActionPlanResponse(
        serializeActionPlan({
          subjects: Array.from(
            { length: ACTION_PLAN_LIMITS.maxArrayItems + 1 },
            (_, index) => `subject-${index}`
          ),
        })
      ),
    /subjects.*exceeds.*items/
  );
});

test("rejects prompt-injected oversized array items", () => {
  assert.throws(
    () =>
      parseActionPlanResponse(
        serializeActionPlan({
          technicalNotes: ["x".repeat(ACTION_PLAN_LIMITS.maxArrayItemLength + 1)],
        })
      ),
    /technicalNotes\[0\].*exceeds/
  );
});

test("rejects action plans that exceed total serialized size", () => {
  const scalar = "x".repeat(ACTION_PLAN_LIMITS.maxScalarLength - 100);
  const arrayItem = "x".repeat(
    Math.floor(ACTION_PLAN_LIMITS.maxArrayItemLength / 2)
  );
  const payload = serializeActionPlan({
    summary: scalar,
    intent: scalar,
    style: scalar,
    composition: scalar,
    mood: scalar,
    subjects: Array.from({ length: 10 }, (_, index) => `${index}-${arrayItem}`),
    technicalNotes: Array.from({ length: 3 }, () => arrayItem),
  });

  assert.ok(payload.length < ACTION_PLAN_LIMITS.maxRawJsonLength);
  assert.ok(payload.length > ACTION_PLAN_LIMITS.maxSerializedLength);
  assert.throws(
    () => parseActionPlanResponse(payload),
    /serialized characters/
  );
});

async function loadParser() {
  const source = await readFile(parserPath, "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
    fileName: parserPath,
  });

  const compiledPath = path.join(
    tmpdir(),
    `action-plan-parser-${process.pid}-${Date.now()}.cjs`
  );
  await writeFile(compiledPath, outputText);

  try {
    const imported = await import(pathToFileURL(compiledPath).href);
    return imported.default ?? imported;
  } finally {
    await rm(compiledPath, { force: true });
  }
}

function serializeActionPlan(overrides = {}) {
  return JSON.stringify({
    summary: "A concise generation plan",
    intent: "Create a calm mountain scene",
    subjects: ["mountain", "lake"],
    style: "photorealistic",
    composition: "wide shot",
    mood: "serene",
    technicalNotes: ["soft morning light", "high detail"],
    ...overrides,
  });
}
