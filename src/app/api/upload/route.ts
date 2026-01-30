import { nanoid } from "nanoid";
import { db, schema } from "@/lib/db";
import { uploadImage, generateKey } from "@/lib/storage/b2-client";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const providedGenerationId = formData.get("generationId") as string | null;
    const generationId = providedGenerationId || nanoid();

    if (!file) {
      return Response.json(
        { error: "file is required" },
        { status: 400 }
      );
    }

    console.log("Uploading file:", file.name, "size:", file.size, "type:", file.type);

    // Ensure generation record exists
    const existingGeneration = await db.query.generations.findFirst({
      where: (generations, { eq }) => eq(generations.id, generationId),
    });

    if (!existingGeneration) {
      await db.insert(schema.generations).values({
        id: generationId,
        userRequest: "Pending...", // Will be updated when user submits
        createdAt: new Date(),
      });
      console.log("Created generation record:", generationId);
    } else {
      console.log("Generation record already exists:", generationId);
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = file.name.split(".").pop() || "png";
    const key = generateKey(generationId, "reference", undefined, ext);

    console.log("Generated key:", key);

    await uploadImage(key, buffer, file.type);
    console.log("Image uploaded to B2 successfully");

    const assetId = nanoid();
    await db.insert(schema.assets).values({
      id: assetId,
      generationId,
      runId: null,
      role: "reference",
      provider: null,
      b2Key: key,
      mime: file.type,
      width: null,
      height: null,
      sizeBytes: buffer.length,
      createdAt: new Date(),
    });

    console.log("Asset record created:", assetId);

    return Response.json({ id: assetId, key, generationId });
  } catch (error) {
    console.error("Upload error:", error);
    return Response.json(
      {
        error: "Upload failed",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}
