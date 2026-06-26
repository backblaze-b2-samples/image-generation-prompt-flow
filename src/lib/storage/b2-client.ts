import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const B2_SAMPLE_USER_AGENT =
  "image-generation-prompt-flow/0.1.0 (backblaze-b2-samples)";
const DEFAULT_PRESIGN_TTL_SECONDS = 900;

type B2Config = {
  endpoint: string;
  region: string;
  applicationKeyId: string;
  applicationKey: string;
  bucketName: string;
  publicUrlBase: string;
  presignTtlSeconds: number;
};

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} must be set`);
  }
  return value;
}

function getPresignTtlSeconds(): number {
  const rawValue = process.env.IMAGE_URL_TTL_SECONDS;
  if (!rawValue) {
    return DEFAULT_PRESIGN_TTL_SECONDS;
  }

  const ttl = parseInt(rawValue, 10);
  if (!Number.isFinite(ttl) || ttl <= 0) {
    throw new Error("IMAGE_URL_TTL_SECONDS must be a positive integer");
  }
  return ttl;
}

function getB2Config(): B2Config {
  const region = requireEnv("B2_REGION");

  return {
    endpoint: `https://s3.${region}.backblazeb2.com`,
    region,
    applicationKeyId: requireEnv("B2_APPLICATION_KEY_ID"),
    applicationKey: requireEnv("B2_APPLICATION_KEY"),
    bucketName: requireEnv("B2_BUCKET_NAME"),
    publicUrlBase: requireEnv("B2_PUBLIC_URL_BASE"),
    presignTtlSeconds: getPresignTtlSeconds(),
  };
}

function getB2Client(config: B2Config): S3Client {
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
  const config = getB2Config();
  const client = getB2Client(config);
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
  const config = getB2Config();
  const client = getB2Client(config);
  const command = new GetObjectCommand({
    Bucket: config.bucketName,
    Key: key,
  });
  return getSignedUrl(client, command, { expiresIn: config.presignTtlSeconds });
}

export async function downloadImage(key: string): Promise<Buffer> {
  const config = getB2Config();
  const client = getB2Client(config);
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

export function getPublicUrl(key: string): string {
  const { publicUrlBase } = getB2Config();
  const encodedKey = key.split("/").map(encodeURIComponent).join("/");
  return `${publicUrlBase.replace(/\/+$/, "")}/${encodedKey}`;
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
