export type AssetLocator = {
  b2Key: string;
};

export type FindAssetById = (assetId: string) => Promise<AssetLocator | null>;
export type SignB2Key = (b2Key: string) => Promise<string>;

export async function authorizeImageUrl(
  assetId: string,
  findAssetById: FindAssetById,
  signB2Key: SignB2Key
): Promise<string | null> {
  const asset = await findAssetById(assetId);
  if (!asset) {
    return null;
  }

  return signB2Key(asset.b2Key);
}
