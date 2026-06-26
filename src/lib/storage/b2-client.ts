import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export const B2_SAMPLE_USER_AGENT =
  "image-generation-prompt-flow/0.1.0 (backblaze-b2-samples)";
const DEFAULT_PRESIGN_TTL_SECONDS = 900;
const MAX_PRESIGN_TTL_SECONDS = 7 * 24 * 60 * 60;
const B2_REGION_PATTERN_SOURCE = "[a-z]{2}(?:-[a-z]+)+-\\d{3}";
const B2_REGION_PATTERN = new RegExp(`^${B2_REGION_PATTERN_SOURCE}$`);
const LEGACY_B2_PREFIX = ["B2", "S3"].join("_");

const LEGACY_B2_ENV = {
  endpoint: `${LEGACY_B2_PREFIX}_ENDPOINT`,
  region: `${LEGACY_B2_PREFIX}_REGION`,
  bucketName: `${LEGACY_B2_PREFIX}_BUCKET`,
  applicationKeyId: `${LEGACY_B2_PREFIX}_ACCESS_KEY_ID`,
  applicationKey: `${LEGACY_B2_PREFIX}_SECRET_ACCESS_KEY`,
  presignTtlSeconds: `${LEGACY_B2_PREFIX}_PRESIGN_TTL_SECONDS`,
} as const;

export type B2Environment = Record<string, string | undefined>;

export type B2Config = {
  endpoint: string;
  region: string;
  applicationKeyId: string;
  applicationKey: string;
  bucketName: string;
  publicUrlBase: string;
  presignTtlSeconds: number;
};

function readOptionalEnv(env: B2Environment, name: string): string | undefined {
  const value = env[name]?.trim();
  return value || undefined;
}

function readEnv(
  env: B2Environment,
  preferredName: string,
  legacyName?: string
): string {
  const value =
    readOptionalEnv(env, preferredName) ??
    (legacyName ? readOptionalEnv(env, legacyName) : undefined);

  if (!value) {
    throw new Error(
      legacyName
        ? `${preferredName} or ${legacyName} must be set`
        : `${preferredName} must be set`
    );
  }
  return value;
}

function getPresignTtlSeconds(env: B2Environment): number {
  const rawValue =
    readOptionalEnv(env, "IMAGE_URL_TTL_SECONDS") ??
    readOptionalEnv(env, LEGACY_B2_ENV.presignTtlSeconds);

  if (!rawValue) {
    return DEFAULT_PRESIGN_TTL_SECONDS;
  }

  const ttl = Number(rawValue);
  if (
    !/^\d+$/.test(rawValue) ||
    !Number.isSafeInteger(ttl) ||
    ttl <= 0 ||
    ttl > MAX_PRESIGN_TTL_SECONDS
  ) {
    throw new Error(
      `IMAGE_URL_TTL_SECONDS must be an integer between 1 and ${MAX_PRESIGN_TTL_SECONDS}`
    );
  }
  return ttl;
}

function validateB2Region(region: string): string {
  if (!B2_REGION_PATTERN.test(region)) {
    throw new Error(
      "B2_REGION must be a Backblaze region identifier"
    );
  }
  return region;
}

function inferRegionFromEndpoint(endpointValue: string): string | null {
  try {
    const endpoint = new URL(endpointValue);
    const match = endpoint.hostname.match(
      new RegExp(`^s3\\.(${B2_REGION_PATTERN_SOURCE})\\.backblazeb2\\.com$`)
    );
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

function resolveB2Region(env: B2Environment): string {
  const configuredRegion =
    readOptionalEnv(env, "B2_REGION") ??
    readOptionalEnv(env, LEGACY_B2_ENV.region);

  if (configuredRegion) {
    return validateB2Region(configuredRegion);
  }

  const legacyEndpoint = readOptionalEnv(env, LEGACY_B2_ENV.endpoint);
  if (legacyEndpoint) {
    const inferredRegion = inferRegionFromEndpoint(legacyEndpoint);
    if (!inferredRegion) {
      throw new Error(
        `${LEGACY_B2_ENV.endpoint} must be a Backblaze S3 endpoint when region is omitted`
      );
    }
    return validateB2Region(inferredRegion);
  }

  throw new Error(`B2_REGION or ${LEGACY_B2_ENV.region} must be set`);
}

function resolveB2Endpoint(region: string, endpointOverride?: string): string {
  const expectedHostname = `s3.${region}.backblazeb2.com`;

  if (!endpointOverride) {
    return `https://${expectedHostname}`;
  }

  let endpoint: URL;
  try {
    endpoint = new URL(endpointOverride);
  } catch {
    throw new Error(`${LEGACY_B2_ENV.endpoint} must be a valid URL`);
  }

  if (
    endpoint.protocol !== "https:" ||
    endpoint.hostname !== expectedHostname ||
    endpoint.port ||
    endpoint.username ||
    endpoint.password ||
    endpoint.pathname !== "/" ||
    endpoint.search ||
    endpoint.hash
  ) {
    throw new Error(
      `${LEGACY_B2_ENV.endpoint} must resolve to https://${expectedHostname}`
    );
  }

  return endpoint.origin;
}

function resolveB2PublicUrlBase(
  env: B2Environment,
  endpoint: string,
  bucketName: string,
  requireConfigured: boolean
): string {
  const configuredUrl = readOptionalEnv(env, "B2_PUBLIC_URL_BASE");
  if (!configuredUrl && requireConfigured) {
    throw new Error("B2_PUBLIC_URL_BASE must be set");
  }

  const publicUrlBase =
    configuredUrl ?? `${endpoint}/${encodeURIComponent(bucketName)}`;

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(publicUrlBase);
  } catch {
    throw new Error("B2_PUBLIC_URL_BASE must be a valid URL");
  }

  if (
    parsedUrl.protocol !== "https:" ||
    parsedUrl.username ||
    parsedUrl.password ||
    parsedUrl.search ||
    parsedUrl.hash
  ) {
    throw new Error(
      "B2_PUBLIC_URL_BASE must be an https URL without credentials, query, or fragment"
    );
  }

  return parsedUrl.href.replace(/\/+$/, "");
}

export function resolveB2Config(env: B2Environment = process.env): B2Config {
  const hasStandardB2Config = [
    "B2_APPLICATION_KEY_ID",
    "B2_APPLICATION_KEY",
    "B2_BUCKET_NAME",
  ].some((name) => readOptionalEnv(env, name) !== undefined);
  const region = resolveB2Region(env);
  const hasStandardRegion = readOptionalEnv(env, "B2_REGION") !== undefined;
  const endpoint = resolveB2Endpoint(
    region,
    hasStandardRegion ? undefined : readOptionalEnv(env, LEGACY_B2_ENV.endpoint)
  );
  const bucketName = readEnv(env, "B2_BUCKET_NAME", LEGACY_B2_ENV.bucketName);

  return {
    endpoint,
    region,
    applicationKeyId: readEnv(
      env,
      "B2_APPLICATION_KEY_ID",
      LEGACY_B2_ENV.applicationKeyId
    ),
    applicationKey: readEnv(
      env,
      "B2_APPLICATION_KEY",
      LEGACY_B2_ENV.applicationKey
    ),
    bucketName,
    publicUrlBase: resolveB2PublicUrlBase(
      env,
      endpoint,
      bucketName,
      hasStandardB2Config
    ),
    presignTtlSeconds: getPresignTtlSeconds(env),
  };
}

export function createB2Client(config: B2Config = resolveB2Config()): S3Client {
  return new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    credentials: {
      accessKeyId: config.applicationKeyId,
      secretAccessKey: config.applicationKey,
    },
    forcePathStyle: true,
    customUserAgent: B2_SAMPLE_USER_AGENT,
  });
}

export async function uploadImage(
  key: string,
  buffer: Buffer,
  mime: string
): Promise<void> {
  const config = resolveB2Config();
  const client = createB2Client(config);
  await client.send(
    new PutObjectCommand({
      Bucket: config.bucketName,
      Key: key,
      Body: buffer,
      ContentType: mime,
    })
  );
}

export async function getPresignedUrl(key: string): Promise<string> {
  const config = resolveB2Config();
  const client = createB2Client(config);
  const command = new GetObjectCommand({
    Bucket: config.bucketName,
    Key: key,
  });
  return getSignedUrl(client, command, { expiresIn: config.presignTtlSeconds });
}

export async function downloadImage(key: string): Promise<Buffer> {
  const config = resolveB2Config();
  const client = createB2Client(config);
  const command = new GetObjectCommand({
    Bucket: config.bucketName,
    Key: key,
  });
  const response = await client.send(command);
  const stream = response.Body as NodeJS.ReadableStream;
  const chunks: Buffer[] = [];

  return new Promise((resolve, reject) => {
    stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    stream.on('error', reject);
    stream.on('end', () => resolve(Buffer.concat(chunks)));
  });
}

export function generateKey(
  generationId: string,
  role: "reference" | "output",
  provider?: string,
  extension: string = "png"
): string {
  const timestamp = Date.now();
  if (role === "reference") {
    return `generations/${generationId}/reference/${timestamp}.${extension}`;
  }
  return `generations/${generationId}/output/${provider}/${timestamp}.${extension}`;
}
