import type { GameConfig } from './types';

export interface CombatHitInput {
  targetHp: number;
  targetShield: number;
  hitCountFromAttacker: number;
  isHeadshot: boolean;
  baseDamage: number;
  headshotMultiplier: number;
  config: GameConfig;
}

export interface CombatHitResult {
  nextHp: number;
  nextShield: number;
  damageApplied: number;
  nextHitCount: number;
  eliminated: boolean;
  isHeadCat: boolean;
  triggeredTwoShotRule: boolean;
}

export function applyCombatHit(input: CombatHitInput): CombatHitResult {
  const {
    targetHp,
    targetShield,
    hitCountFromAttacker,
    isHeadshot,
    baseDamage,
    headshotMultiplier,
    config,
  } = input;

  const nextHitCount = hitCountFromAttacker + 1;

  // Headshot instant elimination + HEAD CAT trigger when enabled
  if (isHeadshot && config.headshotInstantKillEnabled) {
    const totalRemaining = Math.max(0, targetHp) + Math.max(0, targetShield);
    return {
      nextHp: 0,
      nextShield: 0,
      damageApplied: Math.max(totalRemaining, Math.round(baseDamage * headshotMultiplier)),
      nextHitCount,
      eliminated: true,
      isHeadCat: true,
      triggeredTwoShotRule: false,
    };
  }

  // 2-hit elimination rule when enabled
  if (config.twoShotKillEnabled && nextHitCount >= 2) {
    const totalRemaining = Math.max(0, targetHp) + Math.max(0, targetShield);
    return {
      nextHp: 0,
      nextShield: 0,
      damageApplied: Math.max(totalRemaining, Math.round(baseDamage)),
      nextHitCount,
      eliminated: true,
      isHeadCat: false,
      triggeredTwoShotRule: true,
    };
  }

  const rawDamage = Math.round(
    isHeadshot ? baseDamage * headshotMultiplier : baseDamage
  );
  const shieldAbsorbed = Math.min(Math.max(0, targetShield), rawDamage);
  const nextShield = Math.max(0, targetShield - shieldAbsorbed);
  const hpDamage = rawDamage - shieldAbsorbed;
  const nextHp = Math.max(0, targetHp - hpDamage);

  return {
    nextHp,
    nextShield,
    damageApplied: rawDamage,
    nextHitCount,
    eliminated: nextHp <= 0,
    isHeadCat: false,
    triggeredTwoShotRule: false,
  };
}

export function calculateZoneDps(
  distanceFromCenter: number,
  zoneRadius: number,
  shrinkSpeedMultiplier: number
): number {
  if (distanceFromCenter <= zoneRadius) return 0;
  const over = distanceFromCenter - zoneRadius;
  const baseDps = 6 + Math.min(18, over * 0.75);
  return Number((baseDps * Math.max(0.3, Math.min(3.0, shrinkSpeedMultiplier))).toFixed(1));
}
