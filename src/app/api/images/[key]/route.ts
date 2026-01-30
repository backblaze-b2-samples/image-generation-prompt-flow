import { getPresignedUrl } from "@/lib/storage/b2-client";

export async function GET(
  _req: Request,
  { params }: { params: { key: string } }
) {
  const key = decodeURIComponent(params.key);

  try {
    const url = await getPresignedUrl(key);
    return Response.json({ url });
  } catch (error) {
    return Response.json(
      { error: "Failed to generate presigned URL" },
      { status: 500 }
    );
  }
}
