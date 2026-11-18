import { clampNumber } from './constants';
import type { HudControlId, HudControlPosition, HudLayoutPreset, HudSettings } from './types';

export const HUD_STORAGE_KEY = 'apex_drop_30_hud_v1';

export const HUD_CONTROL_IDS: HudControlId[] = [
  'joystick',
  'fireMain',
  'fireAds',
  'jump',
  'reload',
  'weaponBar',
];

export const HUD_CONTROL_LABELS: Record<HudControlId, string> = {
  joystick: 'Hareket Çubuğu',
  fireMain: 'Ana Ateş',
  fireAds: 'Nişanlı Ateş (ADS)',
  jump: 'Zıpla / Süzül',
  reload: 'Şarjör Değiştir',
  weaponBar: '15 Silah Çubuğu',
};

export function getPresetLayout(preset: HudLayoutPreset): HudSettings {
  if (preset === 'lefty') {
    return {
      preset: 'lefty',
      controls: {
        joystick: { xPct: 86, yPct: 76, scale: 1.0 },
        fireMain: { xPct: 14, yPct: 76, scale: 1.05 },
        fireAds: { xPct: 14, yPct: 57, scale: 0.95 },
        jump: { xPct: 26, yPct: 68, scale: 0.95 },
        reload: { xPct: 26, yPct: 85, scale: 0.9 },
        weaponBar: { xPct: 50, yPct: 91, scale: 1.0 },
      },
    };
  }

  if (preset === 'claw4') {
    return {
      preset: 'claw4',
      controls: {
        joystick: { xPct: 14, yPct: 77, scale: 1.0 },
        fireMain: { xPct: 14, yPct: 28, scale: 1.1 },
        fireAds: { xPct: 86, yPct: 28, scale: 1.05 },
        jump: { xPct: 88, yPct: 66, scale: 1.0 },
        reload: { xPct: 76, yPct: 78, scale: 0.95 },
        weaponBar: { xPct: 50, yPct: 91, scale: 1.0 },
      },
    };
  }

  return {
    preset: 'default',
    controls: {
      joystick: { xPct: 14, yPct: 76, scale: 1.0 },
      fireMain: { xPct: 86, yPct: 75, scale: 1.05 },
      fireAds: { xPct: 86, yPct: 56, scale: 0.95 },
      jump: { xPct: 74, yPct: 67, scale: 0.95 },
      reload: { xPct: 74, yPct: 84, scale: 0.9 },
      weaponBar: { xPct: 50, yPct: 91, scale: 1.0 },
    },
  };
}

export function clampHudControl(pos: HudControlPosition): HudControlPosition {
  return {
    xPct: Number(clampNumber(pos.xPct, 6, 94).toFixed(1)),
    yPct: Number(clampNumber(pos.yPct, 10, 94).toFixed(1)),
    scale: Number(clampNumber(pos.scale, 0.6, 1.6).toFixed(2)),
  };
}

export function sanitizeHudSettings(raw: Partial<HudSettings> | null | undefined): HudSettings {
  const base = getPresetLayout(
    raw?.preset === 'lefty' || raw?.preset === 'claw4' ? raw.preset : 'default'
  );
  const controls = { ...base.controls };
  if (raw?.controls) {
    for (const id of HUD_CONTROL_IDS) {
      if (raw.controls[id]) {
        controls[id] = clampHudControl(raw.controls[id]);
      }
    }
  }
  return {
    preset: base.preset,
    controls,
  };
}

export function loadHudSettings(): HudSettings {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return getPresetLayout('default');
    }
    const raw = window.localStorage.getItem(HUD_STORAGE_KEY);
    if (!raw) return getPresetLayout('default');
    return sanitizeHudSettings(JSON.parse(raw) as Partial<HudSettings>);
  } catch {
    return getPresetLayout('default');
  }
}

export function saveHudSettings(settings: HudSettings): HudSettings {
  const sanitized = sanitizeHudSettings(settings);
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(HUD_STORAGE_KEY, JSON.stringify(sanitized));
    }
  } catch {
    // Ignore storage quota errors
  }
  return sanitized;
}
