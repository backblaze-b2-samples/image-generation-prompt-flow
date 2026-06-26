import { db, schema } from "@/lib/db";
import { authorizeImageUrl } from "@/lib/storage/image-access";
import { getPresignedUrl } from "@/lib/storage/b2-client";
import { eq } from "drizzle-orm";

async function findAssetById(assetId: string): Promise<{ b2Key: string } | null> {
  const [asset] = await db
    .select({ b2Key: schema.assets.b2Key })
    .from(schema.assets)
    .where(eq(schema.assets.id, assetId))
    .limit(1);

  return asset ?? null;
}

export async function GET(
  _req: Request,
  { params }: { params: { key: string } }
) {
  try {
    const assetId = decodeURIComponent(params.key);
    const url = await authorizeImageUrl(
      assetId,
      findAssetById,
      getPresignedUrl
    );
    if (!url) {
      return Response.json({ error: "Image not found" }, { status: 404 });
    }

    return Response.json({ url });
  } catch (error) {
    if (error instanceof URIError) {
      return Response.json({ error: "Invalid image id" }, { status: 400 });
    }

    return Response.json(
      { error: "Failed to generate presigned URL" },
      { status: 500 }
    );
  }
}
