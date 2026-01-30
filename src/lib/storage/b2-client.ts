import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

function getB2Client(): S3Client {
  return new S3Client({
    endpoint: process.env.B2_S3_ENDPOINT,
    region: process.env.B2_S3_REGION || "us-west-004",
    credentials: {
      accessKeyId: process.env.B2_S3_ACCESS_KEY_ID!,
      secretAccessKey: process.env.B2_S3_SECRET_ACCESS_KEY!,
    },
    forcePathStyle: true,
    customUserAgent: "b2ai-imggenflow",
  });
}

export async function uploadImage(
  key: string,
  buffer: Buffer,
  mime: string
): Promise<void> {
  const client = getB2Client();
  await client.send(
    new PutObjectCommand({
      Bucket: process.env.B2_S3_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: mime,
    })
  );
}

export async function getPresignedUrl(key: string): Promise<string> {
  const client = getB2Client();
  const command = new GetObjectCommand({
    Bucket: process.env.B2_S3_BUCKET,
    Key: key,
  });
  const ttl = parseInt(process.env.B2_S3_PRESIGN_TTL_SECONDS || "900");
  return getSignedUrl(client, command, { expiresIn: ttl });
}

export async function downloadImage(key: string): Promise<Buffer> {
  const client = getB2Client();
  const command = new GetObjectCommand({
    Bucket: process.env.B2_S3_BUCKET,
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
