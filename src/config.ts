import discoveredPhotos from 'virtual:photos';

export type SceneState = 'CHAOS' | 'FORMED';
export type ThemeId = 'classic' | 'frost' | 'sakura';

export interface ThemePalette {
  id: ThemeId;
  label: string;
  background: string;
  ambient: string;
  foliageBase: string;
  foliageTip: string;
  foliageAccent: string;
  ribbon: string;
  star: string;
  lights: string[];
  borders: string[];
  giftColors: string[];
  candyColors: [string, string];
  uiAccent: string;
}

export interface VisualSettings {
  theme: ThemeId;
  particleDensity: number; // 0.4 - 1.5, default 1.0
  bloomIntensity: number;  // 0.3 - 2.2, default 1.1
  showPhotos: boolean;     // default true
}

export interface GestureFeedback {
  status: string;
  detectedGesture: 'Open_Palm' | 'Closed_Fist' | 'Pinch' | null;
  handPresent: boolean;
  isError: boolean;
}

export const BODY_PHOTO_PATHS: string[] = discoveredPhotos;

export const THEMES: Record<ThemeId, ThemePalette> = {
  classic: {
    id: 'classic',
    label: '经典绿金',
    background: '#020705',
    ambient: '#0a3d24',
    foliageBase: '#044225',
    foliageTip: '#1ea362',
    foliageAccent: '#ffd466',
    ribbon: '#ffcf56',
    star: '#ffd700',
    lights: ['#ff3b30', '#ffd700', '#34d399', '#ffb347', '#fff2b2'],
    borders: ['#fffaf0', '#f6e7cb', '#f0e68c', '#f5d0c5', '#d8ead3', '#e8dfd1'],
    giftColors: ['#c62828', '#d4af37', '#1b5e20', '#8e2430'],
    candyColors: ['#d32f2f', '#fff8ee'],
    uiAccent: '#ffd166',
  },
  frost: {
    id: 'frost',
    label: '冰雪蓝银',
    background: '#020611',
    ambient: '#0f2d56',
    foliageBase: '#0b3466',
    foliageTip: '#4cc9f0',
    foliageAccent: '#e2f4ff',
    ribbon: '#9be7ff',
    star: '#d9f2ff',
    lights: ['#7dd3fc', '#e0f2fe', '#60a5fa', '#a5f3fc', '#c4b5fd'],
    borders: ['#f0f8ff', '#dbeafe', '#e2e8f0', '#cffafe', '#ede9fe', '#f8fafc'],
    giftColors: ['#1d4ed8', '#cbd5e1', '#0284c7', '#475569'],
    candyColors: ['#38bdf8', '#f0f9ff'],
    uiAccent: '#7dd3fc',
  },
  sakura: {
    id: 'sakura',
    label: '暖粉星夜',
    background: '#0a030b',
    ambient: '#3b102f',
    foliageBase: '#591642',
    foliageTip: '#f472b6',
    foliageAccent: '#ffe0b5',
    ribbon: '#f7c59f',
    star: '#ffd1b3',
    lights: ['#ff85b3', '#ffd6a5', '#f472b6', '#e879f9', '#fff0f5'],
    borders: ['#fff5f7', '#fce7f3', '#fae8ff', '#ffedd5', '#f3e8ff', '#fff1e6'],
    giftColors: ['#be185d', '#e8b49a', '#9d174d', '#f472b6'],
    candyColors: ['#f472b6', '#fff5f7'],
    uiAccent: '#f9a8d4',
  },
};

export const DEFAULT_SETTINGS: VisualSettings = {
  theme: 'classic',
  particleDensity: 1.0,
  bloomIntensity: 1.1,
  showPhotos: true,
};

export const CONFIG = {
  counts: { foliage: 18000, ribbon: 3000, ornaments: 120, elements: 200, lights: 400 },
  tree: { height: 22, radius: 9 },
  photos: { body: BODY_PHOTO_PATHS },
} as const;
