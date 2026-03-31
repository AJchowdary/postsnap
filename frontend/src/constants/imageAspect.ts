export type ImageAspectPreset = 'square' | 'feed' | 'story' | 'landscape';

export const IMAGE_ASPECT_OPTIONS: {
  id: ImageAspectPreset;
  label: string;
  sub: string;
  pickerAspect: [number, number];
  /** Pixel target for AI image generation (documented; server maps to provider size). */
  width?: number;
  height?: number;
  /** Optional glyph shown in the aspect picker (same row as label). */
  icon?: string;
}[] = [
  { id: 'square', label: 'Square', sub: '1:1', pickerAspect: [1, 1] },
  { id: 'feed', label: 'Feed', sub: '3:2 wide', pickerAspect: [3, 2] },
  { id: 'story', label: 'Story', sub: '2:3 tall', pickerAspect: [2, 3] },
  {
    id: 'landscape',
    label: 'Landscape',
    sub: '16:9',
    pickerAspect: [16, 9],
    /** Target composition; server maps to provider wide size (e.g. 1536×1024). */
    width: 1792,
    height: 1024,
    icon: '▬',
  },
];

export function pickerAspectForPreset(preset: ImageAspectPreset): [number, number] {
  return IMAGE_ASPECT_OPTIONS.find((o) => o.id === preset)?.pickerAspect ?? [1, 1];
}

/** RN `aspectRatio` = width / height */
export function previewAspectRatio(preset: ImageAspectPreset): number {
  switch (preset) {
    case 'feed':
      return 3 / 2;
    case 'story':
      return 2 / 3;
    case 'landscape':
      return 16 / 9;
    case 'square':
    default:
      return 1;
  }
}
