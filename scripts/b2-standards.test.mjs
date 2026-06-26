import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import ts from "typescript";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const storageClientPath = "src/lib/storage/b2-client.ts";
const legacyB2Prefix = ["B2", "S3"].join("_");

const requiredB2Env = [
  "B2_APPLICATION_KEY_ID",
  "B2_APPLICATION_KEY",
  "B2_BUCKET_NAME",
  "B2_REGION",
  "B2_PUBLIC_URL_BASE",
];

const legacyB2Env = [
  `${legacyB2Prefix}_ENDPOINT`,
  `${legacyB2Prefix}_REGION`,
  `${legacyB2Prefix}_BUCKET`,
  `${legacyB2Prefix}_ACCESS_KEY_ID`,
  `${legacyB2Prefix}_SECRET_ACCESS_KEY`,
  `${legacyB2Prefix}_PRESIGN_TTL_SECONDS`,
];

const legacyB2 = {
  endpoint: legacyB2Env[0],
  region: legacyB2Env[1],
  bucketName: legacyB2Env[2],
  applicationKeyId: legacyB2Env[3],
  applicationKey: legacyB2Env[4],
  presignTtlSeconds: legacyB2Env[5],
};

function readRepoFile(relativePath) {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function toPlainObject(value) {
  return JSON.parse(JSON.stringify(value));
}

function loadStorageClientModule() {
  const source = readRepoFile(storageClientPath);
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  });
  const module = { exports: {} };
  const require = createRequire(path.join(repoRoot, storageClientPath));

  vm.runInNewContext(
    transpiled.outputText,
    {
      Buffer,
      URL,
      console,
      exports: module.exports,
      module,
      process: { env: {} },
      require,
    },
    { filename: storageClientPath }
  );

  return module.exports;
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

  for (const key of requiredB2Env) {
    assert.match(envExample, new RegExp(`^${key}=`, "m"));
  }
  for (const key of legacyB2Env) {
    assert.doesNotMatch(envExample, new RegExp(`^${key}=`, "m"));
  }
});

test("the storage config resolver prefers standardized env names", () => {
  const { resolveB2Config } = loadStorageClientModule();
  const config = resolveB2Config({
    B2_APPLICATION_KEY_ID: "new-key-id",
    B2_APPLICATION_KEY: "new-application-key",
    B2_BUCKET_NAME: "new-bucket",
    B2_PUBLIC_URL_BASE: "https://s3.us-west-004.backblazeb2.com/new-bucket",
    B2_REGION: "us-west-004",
    IMAGE_URL_TTL_SECONDS: "123",
    [legacyB2.applicationKeyId]: "old-key-id",
    [legacyB2.applicationKey]: "old-application-key",
    [legacyB2.bucketName]: "old-bucket",
    [legacyB2.region]: "eu-central-003",
    [legacyB2.presignTtlSeconds]: "456",
  });

  assert.deepEqual(toPlainObject(config), {
    endpoint: "https://s3.us-west-004.backblazeb2.com",
    region: "us-west-004",
    applicationKeyId: "new-key-id",
    applicationKey: "new-application-key",
    bucketName: "new-bucket",
    publicUrlBase: "https://s3.us-west-004.backblazeb2.com/new-bucket",
    presignTtlSeconds: 123,
  });
});

test("the storage config resolver supports the legacy env contract", () => {
  const { resolveB2Config } = loadStorageClientModule();
  const config = resolveB2Config({
    [legacyB2.endpoint]: "https://s3.eu-central-003.backblazeb2.com",
    [legacyB2.region]: "eu-central-003",
    [legacyB2.applicationKeyId]: "legacy-key-id",
    [legacyB2.applicationKey]: "legacy-application-key",
    [legacyB2.bucketName]: "legacy-bucket",
    [legacyB2.presignTtlSeconds]: "456",
  });

  assert.deepEqual(toPlainObject(config), {
    endpoint: "https://s3.eu-central-003.backblazeb2.com",
    region: "eu-central-003",
    applicationKeyId: "legacy-key-id",
    applicationKey: "legacy-application-key",
    bucketName: "legacy-bucket",
    publicUrlBase: "https://s3.eu-central-003.backblazeb2.com/legacy-bucket",
    presignTtlSeconds: 456,
  });
});

test("B2_REGION rejects URL authority injection payloads", () => {
  const { resolveB2Config } = loadStorageClientModule();

  assert.throws(
    () =>
      resolveB2Config({
        B2_APPLICATION_KEY_ID: "key-id",
        B2_APPLICATION_KEY: "application-key",
        B2_BUCKET_NAME: "bucket",
        B2_PUBLIC_URL_BASE: "https://s3.us-west-004.backblazeb2.com/bucket",
        B2_REGION: "us-west-004.backblazeb2.com@evil.example/collect",
      }),
    /B2_REGION/
  );
});

test("presigned URL TTL rejects non-integer strings", () => {
  const { resolveB2Config } = loadStorageClientModule();
  const env = {
    B2_APPLICATION_KEY_ID: "key-id",
    B2_APPLICATION_KEY: "application-key",
    B2_BUCKET_NAME: "bucket",
    B2_PUBLIC_URL_BASE: "https://s3.us-west-004.backblazeb2.com/bucket",
    B2_REGION: "us-west-004",
  };

  assert.throws(
    () => resolveB2Config({ ...env, IMAGE_URL_TTL_SECONDS: "10.5" }),
    /positive integer/
  );
  assert.throws(
    () => resolveB2Config({ ...env, IMAGE_URL_TTL_SECONDS: "10abc" }),
    /positive integer/
  );
});

test("legacy endpoint fallback must match the selected B2 region", () => {
  const { resolveB2Config } = loadStorageClientModule();

  assert.throws(
    () =>
      resolveB2Config({
        [legacyB2.endpoint]: "https://evil.example",
        [legacyB2.region]: "us-west-004",
        [legacyB2.applicationKeyId]: "key-id",
        [legacyB2.applicationKey]: "application-key",
        [legacyB2.bucketName]: "bucket",
      }),
    new RegExp(legacyB2.endpoint)
  );
});

test("the S3 client factory applies the Backblaze sample user agent", () => {
  const { B2_SAMPLE_USER_AGENT, createB2Client } = loadStorageClientModule();
  const client = createB2Client({
    endpoint: "https://s3.us-west-004.backblazeb2.com",
    region: "us-west-004",
    applicationKeyId: "key-id",
    applicationKey: "application-key",
    bucketName: "bucket",
    publicUrlBase: "https://s3.us-west-004.backblazeb2.com/bucket",
    presignTtlSeconds: 900,
  });

  const userAgentParts = Array.isArray(client.config.customUserAgent)
    ? client.config.customUserAgent.flat(Number.POSITIVE_INFINITY)
    : [client.config.customUserAgent];

  assert.ok(userAgentParts.includes(B2_SAMPLE_USER_AGENT));
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
