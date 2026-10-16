export type CoverMode = 'automatic' | 'catalog' | 'custom' | 'placeholder';
export type UserCoverSource = 'gallery' | 'camera';
export interface CoverAssetResponse {
  id: string; source: UserCoverSource; mimeType: 'image/jpeg'; width: number; height: number; byteSize: number; createdAt: string;
}
export interface CoverSelection {
  coverMode?: CoverMode;
  coverAssetId?: string | null;
  coverUri?: string | null;
  automaticCoverUri?: string | null;
}
