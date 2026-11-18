import { describe, expect, it, beforeEach } from 'vitest';
import { applyCombatHit, calculateZoneDps } from '../../src/shared/combatRules';
import {
  DEFAULT_GAME_CONFIG,
  isSuperAdminEmail,
  sanitizeGameConfig,
  SUPER_ADMIN_EMAIL,
} from '../../src/shared/constants';
import {
  clampHudControl,
  getPresetLayout,
  HUD_CONTROL_IDS,
  HUD_STORAGE_KEY,
  loadHudSettings,
  saveHudSettings,
} from '../../src/shared/hudLayout';
import { getWeaponBySlot, WEAPONS } from '../../src/shared/weapons';
import {
  ARENA_HALF_SIZE,
  ARENA_INITIAL_ZONE,
  islandTerrainHeightAt,
} from '../../src/game/villaMap';

describe('APEX DROP 30 — Oyun Kuralları & Bölge Hasarı', () => {
  it('kafadan tek kurşunda anında eleme ve HEAD CAT tetikler', () => {
    const res = applyCombatHit({
      targetHp: 150,
      targetShield: 100,
      hitCountFromAttacker: 0,
      isHeadshot: true,
      baseDamage: 25,
      headshotMultiplier: 2.0,
      config: DEFAULT_GAME_CONFIG,
    });
    expect(res.eliminated).toBe(true);
    expect(res.isHeadCat).toBe(true);
    expect(res.nextHp).toBe(0);
    expect(res.nextShield).toBe(0);
  });

  it('2 vuruşta eleme kuralı 2. gövde vuruşunda hedefi eler', () => {
    const hit1 = applyCombatHit({
      targetHp: 100,
      targetShield: 50,
      hitCountFromAttacker: 0,
      isHeadshot: false,
      baseDamage: 30,
      headshotMultiplier: 2.0,
      config: DEFAULT_GAME_CONFIG,
    });
    expect(hit1.eliminated).toBe(false);
    expect(hit1.nextShield).toBe(20);
    expect(hit1.nextHp).toBe(100);
    expect(hit1.nextHitCount).toBe(1);

    const hit2 = applyCombatHit({
      targetHp: hit1.nextHp,
      targetShield: hit1.nextShield,
      hitCountFromAttacker: hit1.nextHitCount,
      isHeadshot: false,
      baseDamage: 30,
      headshotMultiplier: 2.0,
      config: DEFAULT_GAME_CONFIG,
    });
    expect(hit2.eliminated).toBe(true);
    expect(hit2.triggeredTwoShotRule).toBe(true);
    expect(hit2.isHeadCat).toBe(false);
  });

  it('2 vuruş kuralı kapalıyken standart kalkan + can hesaplaması yapar', () => {
    const cfg = { ...DEFAULT_GAME_CONFIG, twoShotKillEnabled: false, headshotInstantKillEnabled: false };
    const hit1 = applyCombatHit({
      targetHp: 100,
      targetShield: 50,
      hitCountFromAttacker: 1,
      isHeadshot: false,
      baseDamage: 40,
      headshotMultiplier: 2.0,
      config: cfg,
    });
    expect(hit1.eliminated).toBe(false);
    expect(hit1.nextShield).toBe(10);
    expect(hit1.nextHp).toBe(100);
  });

  it('daralan bölge dışında DPS uygular ve içinde 0 döndürür', () => {
    expect(calculateZoneDps(10, 20, 1.0)).toBe(0);
    const dpsNormal = calculateZoneDps(30, 20, 1.0);
    const dpsFast = calculateZoneDps(30, 20, 2.0);
    expect(dpsNormal).toBeGreaterThan(0);
    expect(dpsFast).toBeCloseTo(dpsNormal * 2, 1);
  });
});

describe('APEX DROP 30 — 15 Silah Sistemi', () => {
  it('tam olarak 15 benzersiz silah tanımlar', () => {
    expect(WEAPONS).toHaveLength(15);
    const ids = new Set(WEAPONS.map((w) => w.id));
    const slots = new Set(WEAPONS.map((w) => w.slot));
    expect(ids.size).toBe(15);
    expect(slots.size).toBe(15);
    expect(getWeaponBySlot(12).name).toBe('Hydra RPG-4');
    expect(getWeaponBySlot(12).explosionRadius).toBeGreaterThan(0);
    expect(getWeaponBySlot(15).burstCount).toBe(3);
    expect(getWeaponBySlot(6).pellets).toBe(8);
  });
});

describe('APEX DROP 30 — HUD Yerleşim ve Önayarlar', () => {
  beforeEach(() => {
    const store: Record<string, string> = {};
    (globalThis as unknown as { window: unknown }).window = {
      localStorage: {
        getItem: (k: string) => store[k] ?? null,
        setItem: (k: string, v: string) => {
          store[k] = v;
        },
      },
    };
  });

  it('3 hazır düzen 6 HUD kontrolünü doğru üretir', () => {
    for (const preset of ['default', 'lefty', 'claw4'] as const) {
      const layout = getPresetLayout(preset);
      expect(layout.preset).toBe(preset);
      for (const id of HUD_CONTROL_IDS) {
        expect(layout.controls[id]).toBeDefined();
      }
    }
    const lefty = getPresetLayout('lefty');
    expect(lefty.controls.joystick.xPct).toBeGreaterThan(50);
    expect(lefty.controls.fireMain.xPct).toBeLessThan(50);
  });

  it('ölçek (0.6x-1.6x) ve koordinat sınırlarını uygular ve localStorage ile kalıcı saklar', () => {
    const clamped = clampHudControl({ xPct: 120, yPct: -10, scale: 2.8 });
    expect(clamped.xPct).toBe(94);
    expect(clamped.yPct).toBe(10);
    expect(clamped.scale).toBe(1.6);

    const custom = getPresetLayout('claw4');
    custom.controls.fireMain = { xPct: 22, yPct: 33, scale: 1.4 };
    saveHudSettings(custom);
    const loaded = loadHudSettings();
    expect(loaded.preset).toBe('claw4');
    expect(loaded.controls.fireMain.scale).toBe(1.4);
    expect(window.localStorage.getItem(HUD_STORAGE_KEY)).toBeTruthy();
  });
});

describe('APEX DROP 30 — Canlı Ayar & Süper Yönetici Yetki Doğrulaması', () => {
  it('yalnızca ismailkozak2026@gmail.com süper yönetici olarak doğrulanır', () => {
    expect(SUPER_ADMIN_EMAIL).toBe('ismailkozak2026@gmail.com');
    expect(isSuperAdminEmail('ismailkozak2026@gmail.com')).toBe(true);
    expect(isSuperAdminEmail('ISMAILKOZAK2026@GMAIL.COM')).toBe(true);
    expect(isSuperAdminEmail('ismailkozak4646@gmail.com')).toBe(false);
    expect(isSuperAdminEmail('rastgele@gmail.com')).toBe(false);
    expect(isSuperAdminEmail(null)).toBe(false);
  });

  it('game_config/live sayısal aralıklarını güvenli sınırlarda tutar', () => {
    const sanitized = sanitizeGameConfig({
      startingHp: 999,
      startingShield: -40,
      zoneShrinkSpeed: 10,
      botAggression: 'hard',
    });
    expect(sanitized.startingHp).toBe(300);
    expect(sanitized.startingShield).toBe(0);
    expect(sanitized.zoneShrinkSpeed).toBe(3.0);
    expect(sanitized.botAggression).toBe('hard');
  });
});

describe('APEX DROP 30 — Dev Açık Arena & Arazi Yüksekliği', () => {
  it('560x560m dev arena sınırlarını ve başlangıç enerji bölgesini tanımlar', () => {
    expect(ARENA_HALF_SIZE).toBe(270);
    expect(ARENA_INITIAL_ZONE).toBe(260);
  });

  it('Merkez Villa ve yollar düz (0m) kalırken açık arazide tepe yükseltileri oluşturur', () => {
    expect(islandTerrainHeightAt(0, 0)).toBe(0);
    expect(islandTerrainHeightAt(0, -120)).toBe(0);
    expect(islandTerrainHeightAt(-34, -108)).toBe(0);
    expect(islandTerrainHeightAt(125, 85)).toBeGreaterThanOrEqual(0);
  });
});
