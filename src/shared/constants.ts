import type { GameConfig } from './types';

export const SUPER_ADMIN_EMAIL = 'ismailkozak2026@gmail.com';

export const DEFAULT_GAME_CONFIG: GameConfig = {
  maintenanceMode: false,
  maintenanceMessage:
    'APEX DROP 30 sunucuları şu anda bakım çalışması nedeniyle geçici olarak kapalıdır.',
  announcement: '',
  twoShotKillEnabled: true,
  headshotInstantKillEnabled: true,
  doubleJumpJetpackEnabled: true,
  startingHp: 100,
  startingShield: 50,
  zoneShrinkSpeed: 1.0,
  botAggression: 'normal',
};

export function isSuperAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  return email.trim().toLowerCase() === SUPER_ADMIN_EMAIL;
}

export function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

export function sanitizeGameConfig(raw: Partial<GameConfig>): GameConfig {
  const aggression =
    raw.botAggression === 'low' ||
    raw.botAggression === 'normal' ||
    raw.botAggression === 'hard'
      ? raw.botAggression
      : DEFAULT_GAME_CONFIG.botAggression;

  return {
    maintenanceMode: Boolean(raw.maintenanceMode ?? DEFAULT_GAME_CONFIG.maintenanceMode),
    maintenanceMessage: String(
      raw.maintenanceMessage ?? DEFAULT_GAME_CONFIG.maintenanceMessage
    ).slice(0, 300),
    announcement: String(raw.announcement ?? DEFAULT_GAME_CONFIG.announcement).slice(0, 300),
    twoShotKillEnabled: Boolean(
      raw.twoShotKillEnabled ?? DEFAULT_GAME_CONFIG.twoShotKillEnabled
    ),
    headshotInstantKillEnabled: Boolean(
      raw.headshotInstantKillEnabled ?? DEFAULT_GAME_CONFIG.headshotInstantKillEnabled
    ),
    doubleJumpJetpackEnabled: Boolean(
      raw.doubleJumpJetpackEnabled ?? DEFAULT_GAME_CONFIG.doubleJumpJetpackEnabled
    ),
    startingHp: Math.round(
      clampNumber(Number(raw.startingHp ?? DEFAULT_GAME_CONFIG.startingHp), 50, 300)
    ),
    startingShield: Math.round(
      clampNumber(
        Number(raw.startingShield ?? DEFAULT_GAME_CONFIG.startingShield),
        0,
        200
      )
    ),
    zoneShrinkSpeed: Number(
      clampNumber(
        Number(raw.zoneShrinkSpeed ?? DEFAULT_GAME_CONFIG.zoneShrinkSpeed),
        0.3,
        3.0
      ).toFixed(2)
    ),
    botAggression: aggression,
    updatedAt: raw.updatedAt,
    updatedBy: raw.updatedBy ? String(raw.updatedBy).slice(0, 160) : '',
  };
}
