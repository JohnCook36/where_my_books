export const coverStyles = ['parchment', 'forest', 'burgundy', 'midnight'] as const;
export type CoverStyle = typeof coverStyles[number];
export type CoverMode = 'automatic' | 'catalog' | 'custom' | 'placeholder';
export type UserCoverSource = 'gallery' | 'camera';
export interface CoverAssetResponse {
  id: string; source: UserCoverSource; mimeType: 'image/jpeg'; width: number; height: number; byteSize: number; createdAt: string;
}
export interface CoverSelection {
  coverStyle?: CoverStyle;
  coverMode?: CoverMode;
  coverAssetId?: string | null;
  coverUri?: string | null;
  automaticCoverUri?: string | null;
}
