import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const storageClientPath = "src/lib/storage/b2-client.ts";

const requiredB2Env = [
  "B2_APPLICATION_KEY_ID",
  "B2_APPLICATION_KEY",
  "B2_BUCKET_NAME",
  "B2_REGION",
  "B2_PUBLIC_URL_BASE",
];

const legacyB2Env = [
  ["B2", "S3", "ENDPOINT"].join("_"),
  ["B2", "S3", "REGION"].join("_"),
  ["B2", "S3", "BUCKET"].join("_"),
  ["B2", "S3", "ACCESS", "KEY", "ID"].join("_"),
  ["B2", "S3", "SECRET", "ACCESS", "KEY"].join("_"),
  ["B2", "S3", "PRESIGN", "TTL", "SECONDS"].join("_"),
];

function readRepoFile(relativePath) {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function listFiles(directory) {
  const entries = readdirSync(directory, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      return listFiles(fullPath);
    }
    return fullPath;
  });
}

test(".env.example uses the standardized B2 environment contract", () => {
  const envExample = readRepoFile(".env.example");
  const envKeys = Array.from(envExample.matchAll(/^([A-Z0-9_]+)=/gm), (match) => match[1]);
  const b2Keys = envKeys.filter((key) => key.startsWith("B2_"));

  assert.deepEqual([...b2Keys].sort(), [...requiredB2Env].sort());
  for (const key of requiredB2Env) {
    assert.match(envExample, new RegExp(`^${key}=`, "m"));
  }
  for (const key of legacyB2Env) {
    assert.doesNotMatch(envExample, new RegExp(`^${key}=`, "m"));
  }
});

test("the storage client uses S3 with a Backblaze sample user agent", () => {
  const source = readRepoFile(storageClientPath);

  assert.match(source, /new S3Client\(/);
  assert.match(source, /customUserAgent:\s*B2_SAMPLE_USER_AGENT/);
  assert.match(source, /backblaze-b2-samples/);

  for (const key of requiredB2Env) {
    assert.match(source, new RegExp(`"${key}"`));
  }
  for (const key of legacyB2Env) {
    assert.doesNotMatch(source, new RegExp(key));
  }
});

test("source files do not hardcode a Backblaze region", () => {
  const sourceFiles = listFiles(path.join(repoRoot, "src")).filter((file) => {
    const extension = path.extname(file);
    return [".ts", ".tsx", ".js", ".jsx"].includes(extension) && statSync(file).isFile();
  });

  for (const file of sourceFiles) {
    const relativePath = path.relative(repoRoot, file);
    assert.doesNotMatch(
      readRepoFile(relativePath),
      /\b(?:us|eu)-(?:west|east|central)-\d{3}\b/,
      `${relativePath} hardcodes a Backblaze region`
    );
  }
});
