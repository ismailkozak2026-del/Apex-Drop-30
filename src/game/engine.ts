import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { applyCombatHit, calculateZoneDps } from '../shared/combatRules';
import { DEFAULT_GAME_CONFIG } from '../shared/constants';
import type {
  BotProfileType,
  DropPhase,
  GameConfig,
  GameHudSnapshot,
  KillFeedItem,
  MatchSummary,
  MinimapBlip,
  WeaponSpec,
} from '../shared/types';
import { getWeaponBySlot, WEAPONS } from '../shared/weapons';
import { AudioEngine } from './audio';
import { buildCharacterRig, type CharacterModelRig } from './characterModels';
import {
  buildGrenadeMesh,
  buildParachuteRig,
  buildTransportPlane,
  buildVehicleRig,
  type GrenadeMeshRig,
  type TransportPlaneRig,
  type VehicleRig,
} from './vehicleModels';
import {
  ARENA_HALF_SIZE,
  ARENA_INITIAL_ZONE,
  buildVillaArena,
  islandTerrainHeightAt,
  type VillaMapResult,
} from './villaMap';
import { buildWeaponMesh } from './weaponModels';

const BOT_NAMES = [
  'Kaan_TR', 'Mira_Apex', 'VolkanX', 'Ege_Sniper', 'SenaPro', 'Bora_30',
  'ZeynepK', 'DemirKurt', 'Arda_99', 'MelisV', 'EmreTaktik', 'DenizNova',
  'Yigit_AR', 'DefneZero', 'Kerem_XR', 'Tuna_M4', 'Azra_MP5', 'Baris_RPG',
  'Efe_Titan', 'Nehir_V9', 'Kuzey_338', 'Irem_Apex', 'Sarp_AA12', 'Cem_P9',
  'Ozan_Arc', 'Selin_50', 'Alp_Rusher', 'Pelin_Kite', 'Doruk_VIP',
];

const BOT_PROFILES: BotProfileType[] = ['rusher', 'kiter', 'sniper', 'scavenger'];

const BOMB_WEAPON_SPEC: WeaponSpec = {
  id: 'frag-bomb',
  slot: 0,
  name: 'El Bombası',
  subtitle: 'Parça Tesirli',
  category: 'launcher',
  damage: 145,
  headshotMultiplier: 1.0,
  fireRateMs: 900,
  automatic: false,
  magSize: 8,
  reloadMs: 900,
  spreadHip: 0,
  spreadAds: 0,
  recoilKick: 0,
  adsFov: 72,
  range: 35,
  pellets: 1,
  projectileType: 'rocket',
  explosionRadius: 9.5,
  accentColor: '#f97316',
  soundPitch: 0.5,
};

const RAM_WEAPON_SPEC: WeaponSpec = {
  ...BOMB_WEAPON_SPEC,
  id: 'vehicle-ram',
  name: 'Araç Çarpması',
  damage: 140,
};

// Pre-allocated math objects for zero GC pressure inside render loop
const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _euler = new THREE.Euler(0, 0, 0, 'YXZ');
const _raycaster = new THREE.Raycaster();

interface TracerFx {
  mesh: THREE.Mesh;
  expiresAt: number;
}

interface ProjectileFx {
  mesh: THREE.Mesh;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  ownerId: string;
  weapon: WeaponSpec;
  expiresAt: number;
}

interface ParticleFx {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  expiresAt: number;
}

interface ShockwaveFx {
  mesh: THREE.Mesh;
  maxScale: number;
  createdAt: number;
  durationMs: number;
}

interface ThrownBombEntity {
  rig: GrenadeMeshRig;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  ownerId: string;
  ownerName: string;
  detonateAt: number;
}

interface VehicleEntity {
  id: string;
  name: string;
  pos: THREE.Vector3;
  yaw: number;
  speed: number;
  steerAngle: number;
  hp: number;
  maxHp: number;
  occupiedByPlayer: boolean;
  rig: VehicleRig;
}

interface BotActor {
  id: string;
  name: string;
  profile: BotProfileType;
  alive: boolean;
  hp: number;
  shield: number;
  pos: THREE.Vector3;
  velY: number;
  yaw: number;
  weapon: WeaponSpec;
  ammo: number;
  nextFireAt: number;
  nextBombAt: number;
  reloadingUntil: number;
  waypointId: number;
  targetWaypointId: number;
  strafeSign: number;
  nextDecisionAt: number;
  hitCountsFrom: Map<string, number>;
  hitFlashUntil: number;
  rig: CharacterModelRig;
  parachuteRig: THREE.Group;
  dropState: 'plane' | 'parachute' | 'ground';
  dropThresholdProgress: number;
  landTargetX: number;
  landTargetZ: number;
  walkPhase: number;
}

export interface EngineCallbacks {
  onHudUpdate: (snapshot: GameHudSnapshot) => void;
  onMatchEnd: (summary: MatchSummary) => void;
  onPauseRequest: () => void;
  onMuteToggle?: (muted: boolean) => void;
  onContextLost?: () => void;
}

export class ArenaEngine {
  private container: HTMLElement;
  private callbacks: EngineCallbacks;
  private audio = new AudioEngine();

  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private sunLight!: THREE.DirectionalLight;
  private map!: VillaMapResult;
  private zoneMesh!: THREE.Mesh;
  private isSoftwareGl = false;

  // Airplane & Parachute actors
  private transportPlane!: TransportPlaneRig;
  private planeStart = new THREE.Vector3(-235, 148, -220);
  private planeEnd = new THREE.Vector3(235, 148, 220);
  private planePos = new THREE.Vector3(-235, 148, -220);
  private planeYaw = 0;
  private planeProgress = 0;

  private playerThirdPersonRig!: CharacterModelRig;
  private playerParachuteRig!: THREE.Group;

  private viewWeaponRoot = new THREE.Group();
  private viewWeaponCache = new Map<
    number,
    { group: THREE.Group; muzzleOffset: THREE.Vector3; rotaryBarrels?: THREE.Group }
  >();
  private activeViewWeapon?: {
    group: THREE.Group;
    muzzleOffset: THREE.Vector3;
    rotaryBarrels?: THREE.Group;
  };
  private muzzleFlashLight!: THREE.PointLight;
  private muzzleFlashUntil = 0;

  private frameId = 0;
  private disposed = false;
  private mode: 'lobby' | 'playing' | 'paused' | 'ended' = 'lobby';
  private config: GameConfig = { ...DEFAULT_GAME_CONFIG };

  // Simulation timing
  private lastTimeMs = 0;
  private matchElapsed = 0;
  private hitstopUntil = 0;
  private shakeIntensity = 0;
  private lastHudEmitAt = 0;

  // Player state
  private dropPhase: DropPhase = 'ground';
  private parachuteOpen = false;
  private playerPos = new THREE.Vector3(0, 0, -24);
  private playerVelY = 0;
  private playerYaw = Math.PI;
  private playerPitch = 0;
  private playerGrounded = true;
  private jumpsUsed = 0;
  private jetpackFuel = 100;
  private playerHp = 100;
  private playerShield = 50;
  private playerGrenades = 4;
  private maxGrenades = 8;
  private playerKills = 0;
  private playerHeadshots = 0;
  private playerDamage = 0;
  private playerSlot = 1;
  private playerAmmoMap = new Map<number, number>();
  private playerReloadingUntil = 0;
  private playerReloadTotal = 1500;
  private playerNextFireAt = 0;
  private playerNextBombAt = 0;
  private playerBurstRemaining = 0;
  private playerNextBurstAt = 0;
  private playerHitCountsFrom = new Map<string, number>();
  private playerRecoilOffset = 0;
  private playerWalkBob = 0;

  // Vehicles
  private vehicles: VehicleEntity[] = [];
  private activeVehicle: VehicleEntity | null = null;
  private nearbyVehicle: VehicleEntity | null = null;

  // Inputs
  private keysHeld = new Set<string>();
  private fireHeld = false;
  private adsHeld = false;
  private jumpHeld = false;
  private jumpJustPressed = false;
  private joyX = 0;
  private joyY = 0;

  // Arena entities & FX
  private bots: BotActor[] = [];
  private tracers: TracerFx[] = [];
  private projectiles: ProjectileFx[] = [];
  private particles: ParticleFx[] = [];
  private shockwaves: ShockwaveFx[] = [];
  private thrownBombs: ThrownBombEntity[] = [];
  private killFeed: KillFeedItem[] = [];
  private zoneRadius = ARENA_INITIAL_ZONE;
  private hitMarker: 'none' | 'body' | 'head' = 'none';
  private hitMarkerUntil = 0;
  private headCatBannerUntil = 0;
  private headCatVictim = '';
  private lastZoneSoundAt = 0;

  // Shared geometries for FX
  private tracerGeo = new THREE.CylinderGeometry(0.018, 0.018, 1, 6);
  private rocketGeo = new THREE.ConeGeometry(0.08, 0.36, 8);
  private plasmaGeo = new THREE.SphereGeometry(0.11, 8, 8);
  private particleGeo = new THREE.BoxGeometry(0.16, 0.16, 0.16);
  private shockwaveGeo = new THREE.SphereGeometry(1, 16, 12);

  constructor(container: HTMLElement, callbacks: EngineCallbacks) {
    this.container = container;
    this.callbacks = callbacks;
    this.initThree();
    this.startLoop();
  }

  private detectSoftwareGl(): boolean {
    try {
      const probe = document.createElement('canvas');
      const gl = probe.getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    } catch {
      return true;
    }
  }

  private initThree() {
    this.isSoftwareGl = this.detectSoftwareGl();

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.setPixelRatio(
      this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2)
    );
    this.renderer.setSize(
      this.container.clientWidth || window.innerWidth,
      this.container.clientHeight || window.innerHeight
    );
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';

    this.container.innerHTML = '';
    this.container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    const skyColor = new THREE.Color(0x9bc4e2);
    this.scene.background = skyColor;
    // Light atmospheric fog so huge 560m island & houses are visible from the airplane!
    this.scene.fog = new THREE.FogExp2(0x9bc4e2, 0.0019);

    this.camera = new THREE.PerspectiveCamera(
      72,
      (this.container.clientWidth || window.innerWidth) /
        Math.max(1, this.container.clientHeight || window.innerHeight),
      0.1,
      950
    );
    this.scene.add(this.camera);

    // Mandatory Studio PMREM Environment
    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmremGenerator.fromScene(
      new RoomEnvironment(),
      0.04
    ).texture;
    pmremGenerator.dispose();

    // Warm Mediterranean Key Light + Cool Hemisphere Fill + Rim Light
    const hemi = new THREE.HemisphereLight(0xbbe1fa, 0x7c6a53, 0.78);
    this.scene.add(hemi);

    this.sunLight = new THREE.DirectionalLight(0xfff1d6, 1.55);
    this.sunLight.position.set(52, 85, -46);
    this.sunLight.castShadow = !this.isSoftwareGl;
    this.sunLight.shadow.mapSize.width = 2048;
    this.sunLight.shadow.mapSize.height = 2048;
    this.sunLight.shadow.camera.near = 10;
    this.sunLight.shadow.camera.far = 220;
    this.sunLight.shadow.camera.left = -58;
    this.sunLight.shadow.camera.right = 58;
    this.sunLight.shadow.camera.top = 58;
    this.sunLight.shadow.camera.bottom = -58;
    this.sunLight.shadow.bias = -0.0005;
    this.sunLight.shadow.normalBias = 0.02;
    this.scene.add(this.sunLight);
    this.scene.add(this.sunLight.target);

    const rim = new THREE.DirectionalLight(0x93c5fd, 0.42);
    rim.position.set(-40, 28, 45);
    this.scene.add(rim);

    // Build Huge Battle Royale Villa & Houses Arena
    this.map = buildVillaArena(this.isSoftwareGl);
    this.scene.add(this.map.group);

    // Spawn 10 Driveable Vehicles across the huge map
    this.spawnVehicles();

    // Transport Airplane + Player Parachute Rig
    this.transportPlane = buildTransportPlane();
    this.transportPlane.root.visible = false;
    this.scene.add(this.transportPlane.root);

    this.playerThirdPersonRig = buildCharacterRig(0);
    this.playerParachuteRig = buildParachuteRig();
    this.playerParachuteRig.visible = false;
    this.playerThirdPersonRig.root.add(this.playerParachuteRig);
    this.playerThirdPersonRig.root.visible = false;
    this.scene.add(this.playerThirdPersonRig.root);

    // Shrinking Energy Zone cylinder (tall enough to see from the airplane!)
    const zoneGeo = new THREE.CylinderGeometry(1, 1, 180, 64, 1, true);
    const zoneMat = new THREE.MeshBasicMaterial({
      color: 0x06b6d4,
      transparent: true,
      opacity: 0.2,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.zoneMesh = new THREE.Mesh(zoneGeo, zoneMat);
    this.zoneMesh.position.set(0, 80, 0);
    this.zoneMesh.scale.set(this.zoneRadius, 1, this.zoneRadius);
    this.zoneMesh.visible = false;
    this.scene.add(this.zoneMesh);

    // First-person weapon mount attached to camera
    this.viewWeaponRoot.position.set(0.26, -0.24, -0.36);
    this.camera.add(this.viewWeaponRoot);
    this.muzzleFlashLight = new THREE.PointLight(0xfbbf24, 0, 5);
    this.viewWeaponRoot.add(this.muzzleFlashLight);

    for (const w of WEAPONS) {
      const built = buildWeaponMesh(w);
      built.group.visible = false;
      this.viewWeaponRoot.add(built.group);
      this.viewWeaponCache.set(w.slot, built);
    }
    this.equipWeapon(1);
    this.viewWeaponRoot.visible = false;

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    window.addEventListener('resize', this.handleResize);
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('blur', this.handleWindowBlur);
    this.renderer.domElement.addEventListener('mousedown', this.handleMouseDown);
    window.addEventListener('mouseup', this.handleMouseUp);
    window.addEventListener('mousemove', this.handleMouseMove);
    this.renderer.domElement.addEventListener('contextmenu', this.preventContextMenu);
    this.renderer.domElement.addEventListener('wheel', this.handleWheel, { passive: true });
    this.renderer.domElement.addEventListener('webglcontextlost', this.handleContextLost);
  }

  private spawnVehicles() {
    for (const v of this.vehicles) {
      this.scene.remove(v.rig.root);
    }
    this.vehicles = [];
    for (const def of this.map.vehicleSpawns) {
      const rig = buildVehicleRig(def.color, def.style);
      const y = islandTerrainHeightAt(def.x, def.z);
      rig.root.position.set(def.x, y, def.z);
      rig.root.rotation.y = def.yaw;
      this.scene.add(rig.root);
      this.vehicles.push({
        id: def.id,
        name: def.name,
        pos: new THREE.Vector3(def.x, y, def.z),
        yaw: def.yaw,
        speed: 0,
        steerAngle: 0,
        hp: 300,
        maxHp: 300,
        occupiedByPlayer: false,
        rig,
      });
    }
  }

  private preventContextMenu = (e: MouseEvent) => e.preventDefault();

  private handleContextLost = (e: Event) => {
    e.preventDefault();
    this.callbacks.onContextLost?.();
  };

  private handleResize = () => {
    if (this.disposed) return;
    const w = this.container.clientWidth || window.innerWidth;
    const h = Math.max(1, this.container.clientHeight || window.innerHeight);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };

  private handleWindowBlur = () => {
    this.keysHeld.clear();
    this.fireHeld = false;
    this.adsHeld = false;
    this.jumpHeld = false;
  };

  private handleKeyDown = (e: KeyboardEvent) => {
    if (this.mode !== 'playing') return;
    if (e.code === 'Escape' || e.code === 'KeyP') {
      e.preventDefault();
      if (document.pointerLockElement === this.renderer.domElement) {
        document.exitPointerLock();
      }
      this.callbacks.onPauseRequest();
      return;
    }
    if (e.code === 'KeyM') {
      const next = !this.audio.isMuted();
      this.audio.setMuted(next);
      this.callbacks.onMuteToggle?.(next);
      return;
    }
    if (e.code === 'KeyF') {
      e.preventDefault();
      this.toggleVehicle();
      return;
    }
    if (e.code === 'KeyG') {
      e.preventDefault();
      this.throwBomb();
      return;
    }
    if (e.code === 'KeyR') {
      this.triggerReload();
      return;
    }
    if (e.code === 'KeyQ') {
      const prev = this.playerSlot <= 1 ? 15 : this.playerSlot - 1;
      this.equipWeapon(prev);
      return;
    }
    if (e.code === 'KeyE') {
      const next = this.playerSlot >= 15 ? 1 : this.playerSlot + 1;
      this.equipWeapon(next);
      return;
    }
    if (e.code.startsWith('Digit')) {
      const n = Number(e.code.replace('Digit', ''));
      if (n >= 1 && n <= 9) {
        this.equipWeapon(n);
      } else if (n === 0) {
        this.equipWeapon(10);
      }
      return;
    }
    if (e.code === 'Space') {
      e.preventDefault();
      if (this.dropPhase === 'plane') {
        this.triggerPlaneJump();
        return;
      }
      if (this.dropPhase === 'parachute' && !this.parachuteOpen) {
        this.triggerParachuteOpen();
        return;
      }
      if (!this.jumpHeld) this.jumpJustPressed = true;
      this.jumpHeld = true;
    }
    this.keysHeld.add(e.code);
  };

  private handleKeyUp = (e: KeyboardEvent) => {
    this.keysHeld.delete(e.code);
    if (e.code === 'Space') {
      this.jumpHeld = false;
    }
  };

  private handleMouseDown = (e: MouseEvent) => {
    if (this.mode !== 'playing') return;
    if (document.pointerLockElement !== this.renderer.domElement && e.button === 0) {
      try {
        void this.renderer.domElement.requestPointerLock();
      } catch {
        // Drag look fallback remains active
      }
    }
    if (this.dropPhase !== 'ground' || this.activeVehicle) return;
    if (e.button === 0) {
      this.fireHeld = true;
    } else if (e.button === 2) {
      this.adsHeld = true;
    }
  };

  private handleMouseUp = (e: MouseEvent) => {
    if (e.button === 0) this.fireHeld = false;
    if (e.button === 2) this.adsHeld = false;
  };

  private handleMouseMove = (e: MouseEvent) => {
    if (this.mode !== 'playing') return;
    const locked = document.pointerLockElement === this.renderer.domElement;
    if (!locked && e.buttons === 0) return;
    const sens = this.adsHeld ? 0.0014 : 0.0024;
    this.playerYaw -= e.movementX * sens;
    this.playerPitch = THREE.MathUtils.clamp(
      this.playerPitch - e.movementY * sens,
      -1.25,
      1.25
    );
  };

  private handleWheel = (e: WheelEvent) => {
    if (this.mode !== 'playing' || this.dropPhase !== 'ground' || this.activeVehicle) return;
    if (e.deltaY > 0) {
      this.equipWeapon(this.playerSlot >= 15 ? 1 : this.playerSlot + 1);
    } else if (e.deltaY < 0) {
      this.equipWeapon(this.playerSlot <= 1 ? 15 : this.playerSlot - 1);
    }
  };

  // --- Touch & External HUD Control Hooks ---
  public setJoystickInput(x: number, y: number) {
    this.joyX = THREE.MathUtils.clamp(x, -1, 1);
    this.joyY = THREE.MathUtils.clamp(y, -1, 1);
  }

  public addLookDelta(dx: number, dy: number) {
    if (this.mode !== 'playing') return;
    const sens = this.adsHeld ? 0.0024 : 0.0038;
    this.playerYaw -= dx * sens;
    this.playerPitch = THREE.MathUtils.clamp(
      this.playerPitch - dy * sens,
      -1.25,
      1.25
    );
  }

  public setTouchFire(firing: boolean, ads?: boolean) {
    if (this.dropPhase !== 'ground' || this.activeVehicle) {
      this.fireHeld = false;
      this.adsHeld = false;
      return;
    }
    this.fireHeld = firing;
    if (typeof ads === 'boolean') {
      this.adsHeld = ads;
    }
  }

  public setTouchJump(pressed: boolean) {
    if (pressed) {
      if (this.dropPhase === 'plane') {
        this.triggerPlaneJump();
        return;
      }
      if (this.dropPhase === 'parachute' && !this.parachuteOpen) {
        this.triggerParachuteOpen();
        return;
      }
    }
    if (pressed && !this.jumpHeld) {
      this.jumpJustPressed = true;
    }
    this.jumpHeld = pressed;
  }

  public triggerPlaneJump() {
    if (this.mode !== 'playing' || this.dropPhase !== 'plane') return;
    this.dropPhase = 'parachute';
    this.parachuteOpen = false;
    this.playerPos.set(this.planePos.x, this.planePos.y - 3.5, this.planePos.z);
    this.playerVelY = -6;
    this.playerGrounded = false;
    this.playerThirdPersonRig.root.visible = true;
    this.playerParachuteRig.visible = false;
    this.audio.playJump();
    this.emitHudNow();
  }

  public triggerParachuteOpen() {
    if (this.mode !== 'playing' || this.dropPhase !== 'parachute' || this.parachuteOpen) return;
    this.parachuteOpen = true;
    this.playerParachuteRig.visible = true;
    this.audio.playParachuteOpen();
    this.emitHudNow();
  }

  public toggleVehicle() {
    if (this.mode !== 'playing' || this.dropPhase !== 'ground') return;
    if (this.activeVehicle) {
      // Exit vehicle to left side
      const exitX = this.activeVehicle.pos.x - Math.cos(this.activeVehicle.yaw) * 2.7;
      const exitZ = this.activeVehicle.pos.z + Math.sin(this.activeVehicle.yaw) * 2.7;
      this.playerPos.set(
        THREE.MathUtils.clamp(exitX, -ARENA_HALF_SIZE, ARENA_HALF_SIZE),
        this.map.groundHeightAt(exitX, exitZ, this.activeVehicle.pos.y),
        THREE.MathUtils.clamp(exitZ, -ARENA_HALF_SIZE, ARENA_HALF_SIZE)
      );
      this.activeVehicle.occupiedByPlayer = false;
      this.activeVehicle.speed *= 0.35;
      this.activeVehicle = null;
      this.viewWeaponRoot.visible = true;
      this.audio.playVehicleToggle(false);
      this.emitHudNow();
      return;
    }

    if (this.nearbyVehicle && this.nearbyVehicle.hp > 0) {
      this.activeVehicle = this.nearbyVehicle;
      this.activeVehicle.occupiedByPlayer = true;
      this.fireHeld = false;
      this.adsHeld = false;
      this.viewWeaponRoot.visible = false;
      this.playerYaw = this.activeVehicle.yaw;
      this.audio.playVehicleToggle(true);
      this.emitHudNow();
    }
  }

  public throwBomb() {
    if (this.mode !== 'playing' || this.dropPhase !== 'ground') return;
    const now = performance.now();
    if (this.playerGrenades <= 0 || now < this.playerNextBombAt) return;

    this.playerGrenades--;
    this.playerNextBombAt = now + 700;
    this.audio.playBombThrow();

    _dir.set(0, 0, -1).applyQuaternion(this.camera.quaternion).normalize();
    const startPos = this.camera.position.clone().addScaledVector(_dir, 0.9);
    const vel = _dir.clone().multiplyScalar(23.5);
    vel.y += 5.8;
    if (this.activeVehicle) {
      vel.addScaledVector(
        new THREE.Vector3(-Math.sin(this.activeVehicle.yaw), 0, -Math.cos(this.activeVehicle.yaw)),
        Math.max(0, this.activeVehicle.speed)
      );
    }

    const rig = buildGrenadeMesh();
    rig.root.position.copy(startPos);
    this.scene.add(rig.root);

    this.thrownBombs.push({
      rig,
      pos: startPos,
      vel,
      ownerId: 'player',
      ownerName: 'SEN',
      detonateAt: now + 1700,
    });
    this.emitHudNow(now);
  }

  public triggerReload() {
    if (this.mode !== 'playing' || this.dropPhase !== 'ground' || this.activeVehicle) return;
    const w = getWeaponBySlot(this.playerSlot);
    const current = this.playerAmmoMap.get(w.slot) ?? w.magSize;
    if (current >= w.magSize || this.playerReloadingUntil > performance.now()) return;
    this.playerReloadTotal = w.reloadMs;
    this.playerReloadingUntil = performance.now() + w.reloadMs;
    this.audio.playReload();
  }

  public equipWeapon(slot: number) {
    const spec = getWeaponBySlot(slot);
    this.playerSlot = spec.slot;
    this.playerReloadingUntil = 0;
    for (const [s, item] of this.viewWeaponCache.entries()) {
      item.group.visible = s === spec.slot;
      if (s === spec.slot) {
        this.activeViewWeapon = item;
      }
    }
    this.emitHudNow();
  }

  public setMuted(muted: boolean) {
    this.audio.setMuted(muted);
  }

  public isMuted(): boolean {
    return this.audio.isMuted();
  }

  public updateLiveConfig(cfg: GameConfig) {
    this.config = { ...cfg };
  }

  public setPaused(paused: boolean) {
    if (this.mode === 'ended' || this.mode === 'lobby') return;
    this.mode = paused ? 'paused' : 'playing';
    this.keysHeld.clear();
    this.fireHeld = false;
    this.adsHeld = false;
    this.jumpHeld = false;
    this.lastTimeMs = performance.now();
  }

  public returnToLobby() {
    this.clearBotsAndFx();
    this.mode = 'lobby';
    this.dropPhase = 'ground';
    this.activeVehicle = null;
    this.nearbyVehicle = null;
    this.transportPlane.root.visible = false;
    this.playerThirdPersonRig.root.visible = false;
    this.playerParachuteRig.visible = false;
    this.zoneMesh.visible = false;
    this.viewWeaponRoot.visible = false;
    this.fireHeld = false;
    this.adsHeld = false;
    this.keysHeld.clear();
    if (document.pointerLockElement === this.renderer.domElement) {
      document.exitPointerLock();
    }
  }

  public startMatch() {
    this.clearBotsAndFx();
    this.spawnVehicles();
    this.mode = 'playing';
    this.matchElapsed = 0;
    this.zoneRadius = ARENA_INITIAL_ZONE;
    this.zoneMesh.visible = true;
    this.zoneMesh.scale.set(this.zoneRadius, 1, this.zoneRadius);

    // Randomize cross-island airplane flight trajectory
    const entryAngle = Math.random() * Math.PI * 2;
    const distEdge = 245;
    this.planeStart.set(Math.cos(entryAngle) * distEdge, 148, Math.sin(entryAngle) * distEdge);
    this.planeEnd.set(-Math.cos(entryAngle) * distEdge, 148, -Math.sin(entryAngle) * distEdge);
    this.planeProgress = 0;
    this.planePos.copy(this.planeStart);
    const flightDx = this.planeEnd.x - this.planeStart.x;
    const flightDz = this.planeEnd.z - this.planeStart.z;
    this.planeYaw = Math.atan2(-flightDx, -flightDz);

    this.transportPlane.root.position.copy(this.planePos);
    this.transportPlane.root.rotation.y = this.planeYaw;
    this.transportPlane.root.visible = true;

    // Player starts aboard the airplane
    this.dropPhase = 'plane';
    this.parachuteOpen = false;
    this.activeVehicle = null;
    this.nearbyVehicle = null;
    this.viewWeaponRoot.visible = false;
    this.playerThirdPersonRig.root.visible = false;
    this.playerParachuteRig.visible = false;
    this.playerPos.copy(this.planePos);
    this.playerVelY = 0;
    this.playerYaw = this.planeYaw;
    this.playerPitch = -0.38;
    this.playerGrounded = false;
    this.jumpsUsed = 0;
    this.jetpackFuel = 100;
    this.playerHp = this.config.startingHp;
    this.playerShield = this.config.startingShield;
    this.playerGrenades = 4;
    this.playerKills = 0;
    this.playerHeadshots = 0;
    this.playerDamage = 0;
    this.playerReloadingUntil = 0;
    this.playerNextFireAt = 0;
    this.playerNextBombAt = 0;
    this.playerBurstRemaining = 0;
    this.playerHitCountsFrom.clear();
    this.killFeed = [];
    this.hitMarker = 'none';
    this.headCatBannerUntil = 0;

    // Reset all supply crate cooldowns
    for (const c of this.map.crates) {
      c.cooldownUntil = 0;
      c.mesh.visible = true;
    }

    this.playerAmmoMap.clear();
    for (const w of WEAPONS) {
      this.playerAmmoMap.set(w.slot, w.magSize);
    }
    this.equipWeapon(1);

    // Spawn 29 AI Bots aboard the plane, jumping to different houses & zones!
    for (let i = 0; i < 29; i++) {
      const rig = buildCharacterRig(i);
      const parachuteRig = buildParachuteRig();
      parachuteRig.visible = false;
      rig.root.add(parachuteRig);

      const weapon = WEAPONS[(i * 3 + 1) % WEAPONS.length];
      const botWeaponMesh = buildWeaponMesh(weapon);
      botWeaponMesh.group.scale.setScalar(0.88);
      rig.weaponMount.add(botWeaponMesh.group);
      rig.root.visible = false;
      this.scene.add(rig.root);

      const targetSpot = this.map.spawnPoints[(i + 1) % this.map.spawnPoints.length];
      const nearestWp = this.findNearestWaypoint(targetSpot);
      const neighbors = this.map.waypoints[nearestWp]?.neighbors || [0];

      this.bots.push({
        id: `bot-${i + 1}`,
        name: BOT_NAMES[i % BOT_NAMES.length],
        profile: BOT_PROFILES[i % BOT_PROFILES.length],
        alive: true,
        hp: this.config.startingHp,
        shield: this.config.startingShield,
        pos: this.planeStart.clone(),
        velY: 0,
        yaw: Math.random() * Math.PI * 2,
        weapon,
        ammo: weapon.magSize,
        nextFireAt: performance.now() + 2500 + Math.random() * 1500,
        nextBombAt: performance.now() + 9000 + Math.random() * 12000,
        reloadingUntil: 0,
        waypointId: nearestWp,
        targetWaypointId: neighbors[Math.floor(Math.random() * neighbors.length)] ?? nearestWp,
        strafeSign: i % 2 === 0 ? 1 : -1,
        nextDecisionAt: 0,
        hitCountsFrom: new Map(),
        hitFlashUntil: 0,
        rig,
        parachuteRig,
        dropState: 'plane',
        dropThresholdProgress: 0.06 + (i / 29) * 0.82,
        landTargetX: targetSpot.x + (Math.random() - 0.5) * 18,
        landTargetZ: targetSpot.z + (Math.random() - 0.5) * 18,
        walkPhase: Math.random() * 6,
      });
    }

    this.lastTimeMs = performance.now();
    this.emitHudNow();
  }

  private clearBotsAndFx() {
    for (const bot of this.bots) {
      this.scene.remove(bot.rig.root);
    }
    this.bots = [];
    for (const t of this.tracers) this.scene.remove(t.mesh);
    this.tracers = [];
    for (const p of this.projectiles) this.scene.remove(p.mesh);
    this.projectiles = [];
    for (const pt of this.particles) this.scene.remove(pt.mesh);
    this.particles = [];
    for (const sw of this.shockwaves) {
      this.scene.remove(sw.mesh);
      (sw.mesh.material as THREE.Material).dispose();
    }
    this.shockwaves = [];
    for (const b of this.thrownBombs) {
      this.scene.remove(b.rig.root);
    }
    this.thrownBombs = [];
  }

  private findNearestWaypoint(pos: THREE.Vector3): number {
    let bestId = 0;
    let bestDist = Infinity;
    const sameFloor = pos.y >= 3.0 ? 2 : 1;
    for (const wp of this.map.waypoints) {
      const floorPenalty = wp.floor === sameFloor ? 0 : 100;
      const d = pos.distanceToSquared(wp.pos) + floorPenalty;
      if (d < bestDist) {
        bestDist = d;
        bestId = wp.id;
      }
    }
    return bestId;
  }

  private startLoop() {
    this.lastTimeMs = performance.now();

    const afterDraw = (cb: () => void) => {
      const gl = this.renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync?.(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      if (!sync) {
        this.frameId = window.setTimeout(cb, 80);
        return;
      }
      gl.flush();
      const poll = () => {
        if (this.disposed) return;
        const state = gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          this.frameId = window.setTimeout(poll, 5);
        } else {
          gl.deleteSync(sync);
          this.frameId = window.setTimeout(cb, 80);
        }
      };
      this.frameId = window.setTimeout(poll, 5);
    };

    const tick = () => {
      if (this.disposed) return;
      const now = performance.now();
      const rawDt = (now - this.lastTimeMs) / 1000;
      this.lastTimeMs = now;
      const dt = Math.min(Math.max(rawDt, 0.001), 0.05);

      this.update(dt, now);
      this.renderer.render(this.scene, this.camera);

      if (this.isSoftwareGl) {
        afterDraw(tick);
      } else {
        this.frameId = requestAnimationFrame(tick);
      }
    };

    if (this.isSoftwareGl) {
      this.frameId = window.setTimeout(tick, 16);
    } else {
      this.frameId = requestAnimationFrame(tick);
    }
  }

  private update(dt: number, now: number) {
    this.map.poolWaterMesh.position.y = 0.06 + Math.sin(now * 0.003) * 0.015;

    if (this.mode === 'lobby') {
      const angle = now * 0.00014;
      const radius = 92;
      this.camera.position.set(
        Math.cos(angle) * radius,
        36 + Math.sin(now * 0.0003) * 6,
        Math.sin(angle) * radius
      );
      this.camera.lookAt(0, 4, 0);
      this.sunLight.position.set(52, 85, -46);
      this.sunLight.target.position.set(0, 0, 0);
      return;
    }

    if (this.mode === 'paused' || this.mode === 'ended') {
      return;
    }

    if (now < this.hitstopUntil) {
      return;
    }

    this.matchElapsed += dt;

    // 1. Update Transport Airplane Flight
    if (this.transportPlane.root.visible) {
      this.planeProgress += dt * 0.045; // ~22s across the whole 560m island
      for (const prop of this.transportPlane.propellers) {
        prop.rotation.z += dt * 36;
      }
      if (this.planeProgress <= 1.05) {
        const clampedT = Math.min(1, this.planeProgress);
        this.planePos.lerpVectors(this.planeStart, this.planeEnd, clampedT);
        this.transportPlane.root.position.copy(this.planePos);
        if (this.dropPhase === 'plane' && this.planeProgress >= 0.96) {
          this.triggerPlaneJump();
        }
      } else {
        this.transportPlane.root.visible = false;
      }
    }

    // 2. Shrink Zone (scaled for 560m arena, pauses slightly during initial drop)
    if (this.matchElapsed > 10) {
      this.zoneRadius = Math.max(
        14,
        this.zoneRadius - dt * 1.35 * this.config.zoneShrinkSpeed
      );
      this.zoneMesh.scale.set(this.zoneRadius, 1, this.zoneRadius);
    }

    // 3. Player Drop / Vehicle / Ground Update
    if (this.dropPhase === 'plane') {
      this.updatePlayerInPlane(dt);
    } else if (this.dropPhase === 'parachute') {
      this.updatePlayerParachuting(dt);
    } else if (this.activeVehicle) {
      this.updatePlayerDriving(dt, now);
    } else {
      this.updatePlayerOnFoot(dt);
      this.updatePlayerWeapon(dt, now);
    }

    // Track nearby driveable car when on foot
    this.nearbyVehicle = null;
    if (this.dropPhase === 'ground' && !this.activeVehicle) {
      let bestDistSq = 4.8 * 4.8;
      for (const v of this.vehicles) {
        if (v.hp <= 0) continue;
        const dSq = this.playerPos.distanceToSquared(v.pos);
        if (dSq < bestDistSq) {
          bestDistSq = dSq;
          this.nearbyVehicle = v;
        }
      }
    }

    // Keep directional sun shadows following player across the huge 560m map
    this.sunLight.position.set(
      this.playerPos.x + 48,
      Math.max(45, this.playerPos.y + 68),
      this.playerPos.z - 42
    );
    this.sunLight.target.position.copy(this.playerPos);

    // 4. Supply Crates interaction (heals + ammo + +2 bombs)
    if (this.dropPhase === 'ground') {
      this.updateCrates(now);
    }

    // 5. AI Bots (29 combatants across the island)
    this.updateBots(dt, now);

    // 6. Projectiles, Bombs, Tracers & Shockwaves
    this.updateBombs(dt, now);
    this.updateFx(dt, now);

    // 7. Zone DPS on Player
    if (this.dropPhase === 'ground') {
      const distFromCenter = Math.hypot(this.playerPos.x, this.playerPos.z);
      const zoneDps = calculateZoneDps(
        distFromCenter,
        this.zoneRadius,
        this.config.zoneShrinkSpeed
      );
      if (zoneDps > 0) {
        const dmg = zoneDps * dt;
        if (this.playerShield > 0) {
          const abs = Math.min(this.playerShield, dmg);
          this.playerShield -= abs;
          this.playerHp = Math.max(0, this.playerHp - (dmg - abs));
        } else {
          this.playerHp = Math.max(0, this.playerHp - dmg);
        }
        if (now - this.lastZoneSoundAt > 900) {
          this.lastZoneSoundAt = now;
          this.audio.playHitMarker(false);
        }
        if (this.playerHp <= 0) {
          this.finishMatch('eliminated', 'Enerji Bölgesi');
          return;
        }
      }
    }

    // 8. Check Victory
    const aliveBots = this.bots.reduce((acc, b) => acc + (b.alive ? 1 : 0), 0);
    if (aliveBots === 0) {
      this.finishMatch('victory');
      return;
    }

    // 9. Throttled HUD update (~20 Hz)
    if (now - this.lastHudEmitAt >= 50) {
      this.emitHudNow(now);
    }
  }

  private updatePlayerInPlane(dt: number) {
    this.playerPos.copy(this.planePos);
    // 3rd-person camera behind/below aircraft, rotatable via look
    const camDist = 26;
    const sinY = Math.sin(this.playerYaw);
    const cosY = Math.cos(this.playerYaw);
    const cosP = Math.cos(this.playerPitch);
    const sinP = Math.sin(this.playerPitch);

    const targetX = this.planePos.x + sinY * cosP * camDist;
    const targetY = this.planePos.y - sinP * camDist + 4;
    const targetZ = this.planePos.z + cosY * cosP * camDist;

    this.camera.position.x = THREE.MathUtils.damp(this.camera.position.x, targetX, 10, dt);
    this.camera.position.y = THREE.MathUtils.damp(this.camera.position.y, targetY, 10, dt);
    this.camera.position.z = THREE.MathUtils.damp(this.camera.position.z, targetZ, 10, dt);
    this.camera.lookAt(this.planePos.x, this.planePos.y - 2, this.planePos.z);

    if (Math.abs(this.camera.fov - 78) > 0.1) {
      this.camera.fov = THREE.MathUtils.damp(this.camera.fov, 78, 8, dt);
      this.camera.updateProjectionMatrix();
    }
  }

  private updatePlayerParachuting(dt: number) {
    const forwardInput =
      (this.keysHeld.has('KeyW') || this.keysHeld.has('ArrowUp') ? 1 : 0) -
      (this.keysHeld.has('KeyS') || this.keysHeld.has('ArrowDown') ? 1 : 0) -
      this.joyY;
    const strafeInput =
      (this.keysHeld.has('KeyD') || this.keysHeld.has('ArrowRight') ? 1 : 0) -
      (this.keysHeld.has('KeyA') || this.keysHeld.has('ArrowLeft') ? 1 : 0) +
      this.joyX;

    // Auto-deploy parachute at 42m altitude
    if (!this.parachuteOpen && this.playerPos.y <= 42) {
      this.triggerParachuteOpen();
    }

    const horizSpeed = this.parachuteOpen ? 19.5 : 27.5;
    const fallTarget = this.parachuteOpen ? -8.2 : -22.5;
    this.playerVelY = THREE.MathUtils.damp(this.playerVelY, fallTarget, 5, dt);

    const sinY = Math.sin(this.playerYaw);
    const cosY = Math.cos(this.playerYaw);
    // Slight natural forward glide even with minimal key press when parachute is open
    const effForward = this.parachuteOpen && Math.abs(forwardInput) < 0.05 ? 0.55 : forwardInput;
    let moveX = -sinY * effForward + cosY * strafeInput;
    let moveZ = -cosY * effForward - sinY * strafeInput;
    const len = Math.hypot(moveX, moveZ);
    if (len > 1) {
      moveX /= len;
      moveZ /= len;
    }

    this.playerPos.x = THREE.MathUtils.clamp(
      this.playerPos.x + moveX * horizSpeed * dt,
      -ARENA_HALF_SIZE,
      ARENA_HALF_SIZE
    );
    this.playerPos.z = THREE.MathUtils.clamp(
      this.playerPos.z + moveZ * horizSpeed * dt,
      -ARENA_HALF_SIZE,
      ARENA_HALF_SIZE
    );
    this.playerPos.y += this.playerVelY * dt;

    // Show 3rd-person player & parachute rig
    this.playerThirdPersonRig.root.position.copy(this.playerPos);
    this.playerThirdPersonRig.root.rotation.y = this.playerYaw;

    // Follow camera in 3rd-person behind skydiver/parachutist
    const camDist = this.parachuteOpen ? 7.2 : 5.4;
    const camX = this.playerPos.x + sinY * camDist;
    const camY = this.playerPos.y + (this.parachuteOpen ? 3.4 : 2.6) - this.playerPitch * 3.5;
    const camZ = this.playerPos.z + cosY * camDist;
    this.camera.position.set(camX, camY, camZ);
    this.camera.lookAt(this.playerPos.x, this.playerPos.y + 1.4, this.playerPos.z);

    if (Math.abs(this.camera.fov - 76) > 0.1) {
      this.camera.fov = THREE.MathUtils.damp(this.camera.fov, 76, 8, dt);
      this.camera.updateProjectionMatrix();
    }

    const gY = this.map.groundHeightAt(this.playerPos.x, this.playerPos.z, this.playerPos.y);
    if (this.playerPos.y <= gY) {
      this.playerPos.y = gY;
      this.playerVelY = 0;
      this.playerGrounded = true;
      this.dropPhase = 'ground';
      this.parachuteOpen = false;
      this.playerThirdPersonRig.root.visible = false;
      this.playerParachuteRig.visible = false;
      this.viewWeaponRoot.visible = true;
      this.playerPitch = 0;
      this.audio.playPickup();
      this.emitHudNow();
    }
  }

  private updatePlayerDriving(dt: number, now: number) {
    const car = this.activeVehicle!;
    const throttle =
      (this.keysHeld.has('KeyW') || this.keysHeld.has('ArrowUp') ? 1 : 0) -
      (this.keysHeld.has('KeyS') || this.keysHeld.has('ArrowDown') ? 1 : 0) -
      this.joyY;
    const steerInput =
      (this.keysHeld.has('KeyA') || this.keysHeld.has('ArrowLeft') ? 1 : 0) -
      (this.keysHeld.has('KeyD') || this.keysHeld.has('ArrowRight') ? 1 : 0) -
      this.joyX;
    const handbrake = this.keysHeld.has('Space');

    const maxFwd = 32; // ~115 km/h
    const maxRev = -12;
    if (handbrake) {
      car.speed = THREE.MathUtils.damp(car.speed, 0, 5.5, dt);
    } else if (Math.abs(throttle) > 0.05) {
      const accel = throttle > 0 ? 19 : 15;
      car.speed = THREE.MathUtils.clamp(car.speed + throttle * accel * dt, maxRev, maxFwd);
    } else {
      car.speed = THREE.MathUtils.damp(car.speed, 0, 2.2, dt);
    }

    const targetSteer = steerInput * 0.52;
    car.steerAngle = THREE.MathUtils.damp(car.steerAngle, targetSteer, 12, dt);
    if (Math.abs(car.speed) > 0.4) {
      const turnRate = car.steerAngle * 2.4 * Math.sign(car.speed) * Math.min(1, Math.abs(car.speed) / 6);
      car.yaw += turnRate * dt;
    }

    const sinY = Math.sin(car.yaw);
    const cosY = Math.cos(car.yaw);
    const nextX = THREE.MathUtils.clamp(car.pos.x - sinY * car.speed * dt, -ARENA_HALF_SIZE, ARENA_HALF_SIZE);
    const nextZ = THREE.MathUtils.clamp(car.pos.z - cosY * car.speed * dt, -ARENA_HALF_SIZE, ARENA_HALF_SIZE);

    const prevX = car.pos.x;
    const prevZ = car.pos.z;
    this.resolveHorizontalMovement(car.pos, nextX, nextZ, 1.55);
    if (Math.abs(car.pos.x - nextX) > 0.05 || Math.abs(car.pos.z - nextZ) > 0.05) {
      car.speed *= 0.45; // Dampen speed on wall impact
    }

    const gY = this.map.groundHeightAt(car.pos.x, car.pos.z, car.pos.y + 0.5);
    car.pos.y = THREE.MathUtils.damp(car.pos.y, gY, 18, dt);

    car.rig.root.position.copy(car.pos);
    car.rig.root.rotation.y = car.yaw;

    // Spin wheels & pivot front wheels
    const movedDist = Math.hypot(car.pos.x - prevX, car.pos.z - prevZ) * Math.sign(car.speed || 1);
    for (const w of car.rig.wheels) {
      w.rotation.x -= movedDist * 2.4;
    }
    for (const pivot of car.rig.frontSteerPivots) {
      pivot.rotation.y = car.steerAngle;
    }

    // Sync player pos with vehicle
    this.playerPos.copy(car.pos);
    this.playerYaw = THREE.MathUtils.damp(this.playerYaw, car.yaw, 4.5, dt);

    // Roadkill collision check against bots
    if (Math.abs(car.speed) > 6.5) {
      for (const bot of this.bots) {
        if (!bot.alive) continue;
        if (car.pos.distanceToSquared(bot.pos) < 2.35 * 2.35) {
          this.applyDamageToBot(bot, 'player', 'SEN', RAM_WEAPON_SPEC, false, now);
          this.shakeIntensity = Math.max(this.shakeIntensity, 1.6);
        }
      }
    }

    // 3rd-person chase camera
    const camYaw = car.yaw;
    const camDist = 6.8;
    const camX = car.pos.x + Math.sin(camYaw) * camDist;
    const camZ = car.pos.z + Math.cos(camYaw) * camDist;
    const camY = car.pos.y + 3.0;
    this.camera.position.x = THREE.MathUtils.damp(this.camera.position.x, camX, 12, dt);
    this.camera.position.y = THREE.MathUtils.damp(this.camera.position.y, camY, 12, dt);
    this.camera.position.z = THREE.MathUtils.damp(this.camera.position.z, camZ, 12, dt);
    this.camera.lookAt(car.pos.x, car.pos.y + 1.2, car.pos.z);

    const targetFov = 72 + Math.min(14, Math.abs(car.speed) * 0.42);
    if (Math.abs(this.camera.fov - targetFov) > 0.1) {
      this.camera.fov = THREE.MathUtils.damp(this.camera.fov, targetFov, 10, dt);
      this.camera.updateProjectionMatrix();
    }
  }

  private updatePlayerOnFoot(dt: number) {
    const forwardInput =
      (this.keysHeld.has('KeyW') || this.keysHeld.has('ArrowUp') ? 1 : 0) -
      (this.keysHeld.has('KeyS') || this.keysHeld.has('ArrowDown') ? 1 : 0) -
      this.joyY;
    const strafeInput =
      (this.keysHeld.has('KeyD') || this.keysHeld.has('ArrowRight') ? 1 : 0) -
      (this.keysHeld.has('KeyA') || this.keysHeld.has('ArrowLeft') ? 1 : 0) +
      this.joyX;

    const joyMag = Math.hypot(this.joyX, this.joyY);
    const sprinting =
      this.keysHeld.has('ShiftLeft') ||
      this.keysHeld.has('ShiftRight') ||
      joyMag > 0.78;
    const baseSpeed = this.adsHeld ? 4.4 : sprinting ? 9.6 : 6.8;

    const sinY = Math.sin(this.playerYaw);
    const cosY = Math.cos(this.playerYaw);
    let moveX = -sinY * forwardInput + cosY * strafeInput;
    let moveZ = -cosY * forwardInput - sinY * strafeInput;
    const len = Math.hypot(moveX, moveZ);
    if (len > 1) {
      moveX /= len;
      moveZ /= len;
    }

    const nextX = THREE.MathUtils.clamp(
      this.playerPos.x + moveX * baseSpeed * dt,
      -ARENA_HALF_SIZE,
      ARENA_HALF_SIZE
    );
    const nextZ = THREE.MathUtils.clamp(
      this.playerPos.z + moveZ * baseSpeed * dt,
      -ARENA_HALF_SIZE,
      ARENA_HALF_SIZE
    );

    this.resolveHorizontalMovement(this.playerPos, nextX, nextZ, 0.42);

    // Jump, Double Jump & Jetpack Glide
    if (this.jumpJustPressed) {
      this.jumpJustPressed = false;
      if (this.playerGrounded) {
        this.playerVelY = 7.4;
        this.playerGrounded = false;
        this.jumpsUsed = 1;
        this.audio.playJump();
      } else if (this.config.doubleJumpJetpackEnabled && this.jumpsUsed < 2) {
        this.playerVelY = 6.9;
        this.jumpsUsed = 2;
        this.audio.playJump();
      }
    }

    if (
      this.config.doubleJumpJetpackEnabled &&
      !this.playerGrounded &&
      this.jumpHeld &&
      this.jetpackFuel > 0 &&
      this.playerVelY < 2.2
    ) {
      this.playerVelY = Math.min(2.8, this.playerVelY + 24 * dt);
      this.jetpackFuel = Math.max(0, this.jetpackFuel - 34 * dt);
    } else {
      this.playerVelY -= 19.5 * dt;
    }

    this.playerPos.y += this.playerVelY * dt;
    const floorY = this.map.groundHeightAt(this.playerPos.x, this.playerPos.z, this.playerPos.y);
    if (this.playerPos.y <= floorY) {
      this.playerPos.y = floorY;
      this.playerVelY = 0;
      this.playerGrounded = true;
      this.jumpsUsed = 0;
    } else {
      this.playerGrounded = false;
    }

    if (this.playerGrounded) {
      this.jetpackFuel = Math.min(100, this.jetpackFuel + 28 * dt);
    }

    const eyeHeight = 1.66;
    this.shakeIntensity = Math.max(0, this.shakeIntensity - dt * 2.5);
    this.playerRecoilOffset = THREE.MathUtils.damp(this.playerRecoilOffset, 0, 14, dt);

    const shakeX = (Math.random() - 0.5) * this.shakeIntensity * 0.08;
    const shakeY = (Math.random() - 0.5) * this.shakeIntensity * 0.08;

    this.camera.position.set(
      this.playerPos.x + shakeX,
      this.playerPos.y + eyeHeight + shakeY,
      this.playerPos.z
    );
    _euler.set(this.playerPitch + this.playerRecoilOffset, this.playerYaw, 0, 'YXZ');
    this.camera.quaternion.setFromEuler(_euler);

    const weapon = getWeaponBySlot(this.playerSlot);
    const targetFov = this.adsHeld ? weapon.adsFov : 72;
    if (Math.abs(this.camera.fov - targetFov) > 0.05) {
      this.camera.fov = THREE.MathUtils.damp(this.camera.fov, targetFov, 14, dt);
      this.camera.updateProjectionMatrix();
    }

    if (len > 0.08 && this.playerGrounded) {
      this.playerWalkBob += dt * (sprinting ? 14 : 9.5);
    }
    const targetWX = this.adsHeld ? 0.0 : 0.25 + Math.cos(this.playerWalkBob) * 0.012;
    const targetWY = this.adsHeld ? -0.17 : -0.23 + Math.sin(this.playerWalkBob * 2) * 0.01;
    const targetWZ = this.adsHeld ? -0.24 : -0.36;
    this.viewWeaponRoot.position.x = THREE.MathUtils.damp(this.viewWeaponRoot.position.x, targetWX, 16, dt);
    this.viewWeaponRoot.position.y = THREE.MathUtils.damp(this.viewWeaponRoot.position.y, targetWY, 16, dt);
    this.viewWeaponRoot.position.z = THREE.MathUtils.damp(this.viewWeaponRoot.position.z, targetWZ, 16, dt);

    if (this.activeViewWeapon?.rotaryBarrels && this.fireHeld) {
      this.activeViewWeapon.rotaryBarrels.rotation.z += dt * 26;
    }
  }

  private resolveHorizontalMovement(
    pos: THREE.Vector3,
    nextX: number,
    nextZ: number,
    radius: number
  ) {
    const actorBottom = pos.y + 0.45;
    const actorTop = pos.y + 1.72;

    const hitsAny = (tx: number, tz: number): boolean => {
      for (const box of this.map.solidColliders) {
        if (box.isFloor) continue;
        if (actorTop <= box.minY || actorBottom >= box.maxY) continue;
        if (
          tx + radius > box.minX &&
          tx - radius < box.maxX &&
          tz + radius > box.minZ &&
          tz - radius < box.maxZ
        ) {
          return true;
        }
      }
      return false;
    };

    if (!hitsAny(nextX, pos.z)) {
      pos.x = nextX;
    }
    if (!hitsAny(pos.x, nextZ)) {
      pos.z = nextZ;
    }
  }

  private updatePlayerWeapon(_dt: number, now: number) {
    if (now < this.muzzleFlashUntil) {
      this.muzzleFlashLight.intensity = 3.2;
    } else {
      this.muzzleFlashLight.intensity = 0;
    }

    const weapon = getWeaponBySlot(this.playerSlot);

    if (this.playerReloadingUntil > 0 && now >= this.playerReloadingUntil) {
      this.playerReloadingUntil = 0;
      this.playerAmmoMap.set(weapon.slot, weapon.magSize);
      this.emitHudNow(now);
    }

    if (this.playerReloadingUntil > 0) return;

    if (this.playerBurstRemaining > 0 && now >= this.playerNextBurstAt) {
      this.playerBurstRemaining--;
      this.playerNextBurstAt = now + 55;
      this.firePlayerSingleShot(weapon, now);
      return;
    }

    if (!this.fireHeld || now < this.playerNextFireAt) return;

    const ammo = this.playerAmmoMap.get(weapon.slot) ?? weapon.magSize;
    if (ammo <= 0) {
      this.triggerReload();
      return;
    }

    this.playerNextFireAt = now + weapon.fireRateMs;
    if (!weapon.automatic) {
      this.fireHeld = false;
    }

    if (weapon.burstCount && weapon.burstCount > 1) {
      this.playerBurstRemaining = weapon.burstCount - 1;
      this.playerNextBurstAt = now + 55;
    }
    this.firePlayerSingleShot(weapon, now);
  }

  private firePlayerSingleShot(weapon: WeaponSpec, now: number) {
    const ammo = this.playerAmmoMap.get(weapon.slot) ?? weapon.magSize;
    if (ammo <= 0) {
      this.triggerReload();
      return;
    }
    this.playerAmmoMap.set(weapon.slot, ammo - 1);
    if (ammo - 1 <= 0) {
      this.triggerReload();
    }

    this.audio.playWeaponFire(weapon, 1.0);
    this.muzzleFlashUntil = now + 45;
    this.playerRecoilOffset = Math.min(0.14, this.playerRecoilOffset + weapon.recoilKick);
    this.viewWeaponRoot.position.z += 0.045;
    this.shakeIntensity = Math.max(this.shakeIntensity, weapon.recoilKick * 3.5);

    const spread = this.adsHeld ? weapon.spreadAds : weapon.spreadHip;

    const muzzleWorld = _v1.copy(
      this.activeViewWeapon?.muzzleOffset || new THREE.Vector3(0, 0, -0.5)
    );
    this.viewWeaponRoot.localToWorld(muzzleWorld);

    for (let p = 0; p < weapon.pellets; p++) {
      _dir.set(0, 0, -1).applyQuaternion(this.camera.quaternion);
      _dir.x += (Math.random() - 0.5) * spread * 2;
      _dir.y += (Math.random() - 0.5) * spread * 2;
      _dir.z += (Math.random() - 0.5) * spread * 2;
      _dir.normalize();

      if (weapon.projectileType === 'rocket' || weapon.projectileType === 'plasma') {
        const isRocket = weapon.projectileType === 'rocket';
        const mesh = new THREE.Mesh(
          isRocket ? this.rocketGeo : this.plasmaGeo,
          new THREE.MeshBasicMaterial({
            color: isRocket ? 0xf97316 : 0xc084fc,
          })
        );
        mesh.position.copy(muzzleWorld);
        if (isRocket) {
          mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), _dir);
        }
        this.scene.add(mesh);
        this.projectiles.push({
          mesh,
          pos: muzzleWorld.clone(),
          vel: _dir.clone().multiplyScalar(weapon.projectileSpeed || 50),
          ownerId: 'player',
          weapon,
          expiresAt: now + 3500,
        });
      } else {
        this.performHitscanShot(
          'player',
          'SEN',
          this.camera.position,
          _dir,
          muzzleWorld,
          weapon,
          now
        );
      }
    }
  }

  private performHitscanShot(
    attackerId: string,
    attackerName: string,
    origin: THREE.Vector3,
    direction: THREE.Vector3,
    muzzleStart: THREE.Vector3,
    weapon: WeaponSpec,
    now: number
  ) {
    _raycaster.set(origin, direction);
    _raycaster.far = weapon.range;

    const wallHits = _raycaster.intersectObjects(this.map.bulletBlockers, false);
    const wallDist = wallHits.length > 0 ? wallHits[0].distance : weapon.range;

    let bestHitDist = wallDist;
    let hitBot: BotActor | null = null;
    let hitPlayer = false;
    let isHeadshot = false;

    for (const bot of this.bots) {
      if (!bot.alive || bot.dropState !== 'ground' || bot.id === attackerId) continue;
      if (bot.pos.distanceToSquared(origin) > weapon.range * weapon.range) continue;
      const headHit = _raycaster.intersectObject(bot.rig.headMesh, false);
      if (headHit.length > 0 && headHit[0].distance < bestHitDist) {
        bestHitDist = headHit[0].distance;
        hitBot = bot;
        hitPlayer = false;
        isHeadshot = true;
      }
      const bodyHit = _raycaster.intersectObject(bot.rig.bodyMesh, false);
      if (bodyHit.length > 0 && bodyHit[0].distance < bestHitDist) {
        bestHitDist = bodyHit[0].distance;
        hitBot = bot;
        hitPlayer = false;
        isHeadshot = false;
      }
    }

    if (attackerId !== 'player' && this.dropPhase === 'ground') {
      const toPlayer = _v2.subVectors(this.playerPos, origin);
      toPlayer.y += 1.05;
      const proj = toPlayer.dot(direction);
      if (proj > 0 && proj < bestHitDist) {
        const closest = _v3.copy(origin).addScaledVector(direction, proj);
        const horizDist = Math.hypot(closest.x - this.playerPos.x, closest.z - this.playerPos.z);
        const dy = closest.y - this.playerPos.y;
        if (horizDist <= 0.44 && dy >= 0 && dy <= 1.82) {
          bestHitDist = proj;
          hitBot = null;
          hitPlayer = true;
          isHeadshot = dy >= 1.46;
        }
      }
    }

    const endPoint = _v2.copy(origin).addScaledVector(direction, bestHitDist);
    this.spawnTracer(muzzleStart, endPoint, weapon.accentColor, now);

    if (hitBot) {
      this.spawnParticles(endPoint, isHeadshot ? 0xef4444 : 0xfbbf24, 6, now);
      this.applyDamageToBot(hitBot, attackerId, attackerName, weapon, isHeadshot, now);
    } else if (hitPlayer) {
      this.spawnParticles(endPoint, 0xef4444, 4, now);
      this.applyDamageToPlayer(attackerId, attackerName, weapon, isHeadshot, now);
    } else if (wallHits.length > 0) {
      this.spawnParticles(endPoint, 0xd6d3d1, 3, now);
    }
  }

  private applyDamageToBot(
    bot: BotActor,
    attackerId: string,
    attackerName: string,
    weapon: WeaponSpec,
    isHeadshot: boolean,
    now: number
  ) {
    if (!bot.alive) return;
    const prevHits = bot.hitCountsFrom.get(attackerId) || 0;
    const res = applyCombatHit({
      targetHp: bot.hp,
      targetShield: bot.shield,
      hitCountFromAttacker: prevHits,
      isHeadshot,
      baseDamage: weapon.damage,
      headshotMultiplier: weapon.headshotMultiplier,
      config: this.config,
    });

    bot.hp = res.nextHp;
    bot.shield = res.nextShield;
    bot.hitCountsFrom.set(attackerId, res.nextHitCount);
    bot.hitFlashUntil = now + 90;

    if (attackerId === 'player') {
      this.playerDamage += res.damageApplied;
      this.hitMarker = isHeadshot || res.eliminated ? 'head' : 'body';
      this.hitMarkerUntil = now + 180;
      this.audio.playHitMarker(isHeadshot);
    }

    if (res.eliminated) {
      bot.alive = false;
      bot.rig.root.visible = false;
      this.spawnParticles(bot.pos.clone().add(new THREE.Vector3(0, 1.1, 0)), 0xf59e0b, 14, now);

      if (attackerId === 'player') {
        this.playerKills++;
        this.hitstopUntil = now + 45;
        if (res.isHeadCat) {
          this.playerHeadshots++;
          this.headCatVictim = bot.name;
          this.headCatBannerUntil = now + 2400;
          this.audio.playHeadCatChime();
        } else if (isHeadshot) {
          this.playerHeadshots++;
        }
      }

      this.pushKillFeed({
        id: `${now}-${bot.id}`,
        killerName: attackerName,
        victimName: bot.name,
        weaponName: weapon.name,
        isHeadshot,
        killerIsPlayer: attackerId === 'player',
        victimIsPlayer: false,
        timestamp: now,
      });
      this.emitHudNow(now);
    }
  }

  private applyDamageToPlayer(
    attackerId: string,
    attackerName: string,
    weapon: WeaponSpec,
    isHeadshot: boolean,
    now: number
  ) {
    // Vehicle absorbs some damage when driving!
    const vehicleMitigation = this.activeVehicle ? 0.42 : 0.62;
    if (this.activeVehicle) {
      this.activeVehicle.hp = Math.max(0, this.activeVehicle.hp - Math.round(weapon.damage * 0.4));
    }

    const prevHits = this.playerHitCountsFrom.get(attackerId) || 0;
    const res = applyCombatHit({
      targetHp: this.playerHp,
      targetShield: this.playerShield,
      hitCountFromAttacker: prevHits,
      isHeadshot,
      baseDamage: weapon.damage * vehicleMitigation,
      headshotMultiplier: weapon.headshotMultiplier,
      config: this.config,
    });

    this.playerHp = res.nextHp;
    this.playerShield = res.nextShield;
    this.playerHitCountsFrom.set(attackerId, res.nextHitCount);
    this.shakeIntensity = Math.max(this.shakeIntensity, 1.4);

    if (res.eliminated) {
      this.pushKillFeed({
        id: `${now}-player`,
        killerName: attackerName,
        victimName: 'SEN',
        weaponName: weapon.name,
        isHeadshot,
        killerIsPlayer: false,
        victimIsPlayer: true,
        timestamp: now,
      });
      this.finishMatch('eliminated', attackerName);
    }
  }

  private updateCrates(now: number) {
    for (const crate of this.map.crates) {
      const available = now >= crate.cooldownUntil;
      crate.mesh.visible = available;
      if (!available) continue;

      if (this.playerPos.distanceToSquared(crate.position) < 2.6 * 2.6) {
        crate.cooldownUntil = now + 18000;
        this.playerHp = Math.min(this.config.startingHp, this.playerHp + 35);
        this.playerShield = Math.min(this.config.startingShield, this.playerShield + 25);
        this.playerGrenades = Math.min(this.maxGrenades, this.playerGrenades + 2);
        for (const w of WEAPONS) {
          this.playerAmmoMap.set(w.slot, w.magSize);
        }
        this.audio.playPickup();
        this.emitHudNow(now);
      }
    }
  }

  private updateBots(dt: number, now: number) {
    const agg = this.config.botAggression;
    const reactionDelay = agg === 'hard' ? 0.65 : agg === 'low' ? 1.7 : 1.1;
    const aimAccuracy = agg === 'hard' ? 0.055 : agg === 'low' ? 0.17 : 0.1;
    const sightRange = agg === 'hard' ? 52 : agg === 'low' ? 32 : 42;

    for (const bot of this.bots) {
      if (!bot.alive) continue;

      // 1. Bots still in Airplane -> Jump out at staggered flight progress
      if (bot.dropState === 'plane') {
        if (this.planeProgress >= bot.dropThresholdProgress) {
          bot.dropState = 'parachute';
          bot.pos.copy(this.planePos);
          bot.pos.y -= 2.5;
          bot.velY = -5;
          bot.rig.root.position.copy(bot.pos);
          bot.rig.root.visible = true;
          bot.parachuteRig.visible = false;
        }
        continue;
      }

      // 2. Bots Parachuting toward their chosen house/landmark
      if (bot.dropState === 'parachute') {
        if (bot.pos.y <= 52) {
          bot.parachuteRig.visible = true;
        }
        const fallSpeed = bot.parachuteRig.visible ? -9.5 : -24;
        bot.velY = THREE.MathUtils.damp(bot.velY, fallSpeed, 5, dt);
        const dx = bot.landTargetX - bot.pos.x;
        const dz = bot.landTargetZ - bot.pos.z;
        const dist = Math.hypot(dx, dz);
        if (dist > 1) {
          const glideSpd = Math.min(20, dist * 0.7);
          bot.pos.x += (dx / dist) * glideSpd * dt;
          bot.pos.z += (dz / dist) * glideSpd * dt;
          bot.yaw = Math.atan2(-dx, -dz);
        }
        bot.pos.y += bot.velY * dt;
        const gY = this.map.groundHeightAt(bot.pos.x, bot.pos.z, bot.pos.y);
        if (bot.pos.y <= gY) {
          bot.pos.y = gY;
          bot.velY = 0;
          bot.dropState = 'ground';
          bot.parachuteRig.visible = false;
          bot.waypointId = this.findNearestWaypoint(bot.pos);
          const nbrs = this.map.waypoints[bot.waypointId]?.neighbors || [0];
          bot.targetWaypointId = nbrs[Math.floor(Math.random() * nbrs.length)] ?? bot.waypointId;
        }
        bot.rig.root.position.copy(bot.pos);
        bot.rig.root.rotation.y = bot.yaw;
        continue;
      }

      // Hit flash restore
      const flash = now < bot.hitFlashUntil;
      for (const m of bot.rig.hitFlashMaterials) {
        m.emissive.setHex(flash ? 0xef4444 : 0x000000);
        m.emissiveIntensity = flash ? 0.85 : 0;
      }

      // Shrink zone DPS on bots
      const bDist = Math.hypot(bot.pos.x, bot.pos.z);
      if (bDist > this.zoneRadius) {
        bot.hp -=
          calculateZoneDps(bDist, this.zoneRadius, this.config.zoneShrinkSpeed) *
          dt *
          1.15;
        if (bot.hp <= 0) {
          bot.alive = false;
          bot.rig.root.visible = false;
          this.pushKillFeed({
            id: `${now}-zone-${bot.id}`,
            killerName: 'Enerji Bölgesi',
            victimName: bot.name,
            weaponName: 'Bölge Hasarı',
            isHeadshot: false,
            killerIsPlayer: false,
            victimIsPlayer: false,
            timestamp: now,
          });
          continue;
        }
      }

      // Find nearest grounded enemy
      let targetPos: THREE.Vector3 | null = null;
      let targetIsPlayer = false;
      let targetBot: BotActor | null = null;
      let bestDistSq = sightRange * sightRange;

      if (this.dropPhase === 'ground') {
        const dPlayerSq = bot.pos.distanceToSquared(this.playerPos);
        if (dPlayerSq < bestDistSq) {
          bestDistSq = dPlayerSq;
          targetPos = this.playerPos;
          targetIsPlayer = true;
        }
      }

      for (const other of this.bots) {
        if (!other.alive || other.dropState !== 'ground' || other.id === bot.id) continue;
        const dSq = bot.pos.distanceToSquared(other.pos);
        if (dSq < bestDistSq) {
          bestDistSq = dSq;
          targetPos = other.pos;
          targetIsPlayer = false;
          targetBot = other;
        }
      }

      let hasLos = false;
      if (targetPos) {
        _v1.set(bot.pos.x, bot.pos.y + 1.45, bot.pos.z);
        _v2.set(targetPos.x, targetPos.y + 1.3, targetPos.z);
        _dir.subVectors(_v2, _v1);
        const dist = _dir.length();
        if (dist > 0.2) {
          _dir.divideScalar(dist);
          _raycaster.set(_v1, _dir);
          _raycaster.far = dist;
          const blocked = _raycaster.intersectObjects(this.map.bulletBlockers, false);
          hasLos = blocked.length === 0;
        }
      }

      let moveSpeed = 5.0;
      let desiredMoveX = 0;
      let desiredMoveZ = 0;

      if (hasLos && targetPos) {
        const dx = targetPos.x - bot.pos.x;
        const dz = targetPos.z - bot.pos.z;
        const d = Math.hypot(dx, dz) || 1;
        bot.yaw = Math.atan2(-dx, -dz);

        if (bot.profile === 'rusher') {
          if (d > 6) {
            desiredMoveX = dx / d;
            desiredMoveZ = dz / d;
          } else {
            desiredMoveX = (-dz / d) * bot.strafeSign;
            desiredMoveZ = (dx / d) * bot.strafeSign;
          }
          moveSpeed = 5.8;
        } else if (bot.profile === 'kiter') {
          const dirSign = d < 12 ? -1 : d > 22 ? 1 : 0;
          desiredMoveX = (dx / d) * dirSign * 0.6 + (-dz / d) * bot.strafeSign * 0.8;
          desiredMoveZ = (dz / d) * dirSign * 0.6 + (dx / d) * bot.strafeSign * 0.8;
        } else if (bot.profile === 'sniper') {
          moveSpeed = d < 10 ? 4.4 : 1.2;
          desiredMoveX = d < 10 ? -dx / d : (-dz / d) * bot.strafeSign * 0.5;
          desiredMoveZ = d < 10 ? -dz / d : (dx / d) * bot.strafeSign * 0.5;
        } else {
          desiredMoveX = (-dz / d) * bot.strafeSign;
          desiredMoveZ = (dx / d) * bot.strafeSign;
        }

        // Occasional AI Bomb throw at mid-range enemies
        if (d > 9 && d < 24 && now >= bot.nextBombAt) {
          bot.nextBombAt = now + 11000 + Math.random() * 9000;
          const rig = buildGrenadeMesh();
          const startPos = new THREE.Vector3(bot.pos.x, bot.pos.y + 1.5, bot.pos.z);
          rig.root.position.copy(startPos);
          this.scene.add(rig.root);
          const tossVel = new THREE.Vector3(dx / d, 0.35, dz / d).multiplyScalar(Math.min(20, d * 1.05));
          tossVel.y += 4.5;
          this.thrownBombs.push({
            rig,
            pos: startPos,
            vel: tossVel,
            ownerId: bot.id,
            ownerName: bot.name,
            detonateAt: now + 1850,
          });
        }

        // Fire weapon
        if (now >= bot.nextFireAt && now >= bot.reloadingUntil) {
          bot.nextFireAt = now + Math.max(bot.weapon.fireRateMs * 2.1, 240 * reactionDelay);
          if (bot.ammo <= 0) {
            bot.reloadingUntil = now + bot.weapon.reloadMs;
            bot.ammo = bot.weapon.magSize;
          } else {
            bot.ammo--;
            _v1.set(bot.pos.x, bot.pos.y + 1.38, bot.pos.z);
            _v2.set(
              targetPos.x + (Math.random() - 0.5) * aimAccuracy * d,
              targetPos.y + 1.15 + (Math.random() - 0.5) * aimAccuracy * d,
              targetPos.z + (Math.random() - 0.5) * aimAccuracy * d
            );
            _dir.subVectors(_v2, _v1).normalize();
            if (targetIsPlayer || targetBot) {
              this.performHitscanShot(bot.id, bot.name, _v1, _dir, _v1, bot.weapon, now);
            }
          }
        }
      } else {
        // Multi-house & Multi-floor Waypoint Navigation + Zone Migration
        const targetWp = this.map.waypoints[bot.targetWaypointId];
        if (targetWp) {
          const dx = targetWp.pos.x - bot.pos.x;
          const dz = targetWp.pos.z - bot.pos.z;
          const dist2d = Math.hypot(dx, dz);
          if (dist2d < 2.2) {
            bot.waypointId = targetWp.id;
            const nbrs = targetWp.neighbors;
            if (nbrs.length > 0) {
              if (bDist > this.zoneRadius * 0.85) {
                let bestNbr = nbrs[0];
                let bestR = Infinity;
                for (const nid of nbrs) {
                  const np = this.map.waypoints[nid].pos;
                  const r = Math.hypot(np.x, np.z);
                  if (r < bestR) {
                    bestR = r;
                    bestNbr = nid;
                  }
                }
                bot.targetWaypointId = bestNbr;
              } else {
                bot.targetWaypointId = nbrs[Math.floor(Math.random() * nbrs.length)];
              }
            }
          } else {
            desiredMoveX = dx / dist2d;
            desiredMoveZ = dz / dist2d;
            bot.yaw = Math.atan2(-desiredMoveX, -desiredMoveZ);
          }
        }
      }

      if (now > bot.nextDecisionAt) {
        bot.nextDecisionAt = now + 1500 + Math.random() * 1500;
        bot.strafeSign = Math.random() < 0.5 ? 1 : -1;
      }

      const nextX = THREE.MathUtils.clamp(
        bot.pos.x + desiredMoveX * moveSpeed * dt,
        -ARENA_HALF_SIZE,
        ARENA_HALF_SIZE
      );
      const nextZ = THREE.MathUtils.clamp(
        bot.pos.z + desiredMoveZ * moveSpeed * dt,
        -ARENA_HALF_SIZE,
        ARENA_HALF_SIZE
      );
      this.resolveHorizontalMovement(bot.pos, nextX, nextZ, 0.38);

      bot.velY -= 19.5 * dt;
      bot.pos.y += bot.velY * dt;
      const gY = this.map.groundHeightAt(bot.pos.x, bot.pos.z, bot.pos.y);
      if (bot.pos.y <= gY) {
        bot.pos.y = gY;
        bot.velY = 0;
      }

      bot.rig.root.position.copy(bot.pos);
      bot.rig.root.rotation.y = bot.yaw;
      bot.walkPhase += dt * moveSpeed * 1.7;
      bot.rig.leftLeg.rotation.x = Math.sin(bot.walkPhase) * 0.42;
      bot.rig.rightLeg.rotation.x = -Math.sin(bot.walkPhase) * 0.42;
    }
  }

  private detonateExplosion(
    impactPos: THREE.Vector3,
    ownerId: string,
    ownerName: string,
    weapon: WeaponSpec,
    radius: number,
    now: number
  ) {
    this.audio.playExplosion();
    this.spawnParticles(impactPos, 0xf97316, 26, now);
    this.spawnParticles(impactPos, 0xfef08a, 10, now);

    // Expanding fiery shockwave sphere
    const swMat = new THREE.MeshBasicMaterial({
      color: 0xfb923c,
      transparent: true,
      opacity: 0.65,
      depthWrite: false,
    });
    const swMesh = new THREE.Mesh(this.shockwaveGeo, swMat);
    swMesh.position.copy(impactPos);
    swMesh.scale.setScalar(0.5);
    this.scene.add(swMesh);
    this.shockwaves.push({
      mesh: swMesh,
      maxScale: radius,
      createdAt: now,
      durationMs: 360,
    });

    const playerDist = this.playerPos.distanceTo(impactPos);
    if (playerDist < 42) {
      this.shakeIntensity = Math.max(this.shakeIntensity, 2.8 * (1 - playerDist / 42));
    }

    // Splash damage on all grounded bots
    for (const bot of this.bots) {
      if (!bot.alive || bot.dropState !== 'ground') continue;
      const d = bot.pos.distanceTo(impactPos);
      if (d <= radius) {
        const falloff = Math.max(0.35, 1 - d / radius);
        const splashSpec: WeaponSpec = {
          ...weapon,
          damage: Math.round(weapon.damage * falloff),
        };
        this.applyDamageToBot(bot, ownerId, ownerName, splashSpec, false, now);
      }
    }

    // Splash damage on vehicles
    for (const v of this.vehicles) {
      if (v.pos.distanceTo(impactPos) <= radius) {
        v.hp = Math.max(0, v.hp - 65);
      }
    }

    // Splash damage on player (capped fair self-damage)
    if (this.dropPhase === 'ground' && playerDist <= radius * 0.85) {
      const falloff = Math.max(0.2, 1 - playerDist / radius);
      const dmg = Math.round((ownerId === 'player' ? 42 : weapon.damage * 0.5) * falloff);
      if (this.playerShield > 0) {
        const abs = Math.min(this.playerShield, dmg);
        this.playerShield -= abs;
        this.playerHp = Math.max(0, this.playerHp - (dmg - abs));
      } else {
        this.playerHp = Math.max(0, this.playerHp - dmg);
      }
      if (this.playerHp <= 0) {
        this.finishMatch('eliminated', ownerName);
      }
    }
  }

  private updateBombs(dt: number, now: number) {
    for (let i = this.thrownBombs.length - 1; i >= 0; i--) {
      const b = this.thrownBombs[i];
      if (now >= b.detonateAt) {
        this.detonateExplosion(b.pos, b.ownerId, b.ownerName, BOMB_WEAPON_SPEC, 9.5, now);
        this.scene.remove(b.rig.root);
        this.thrownBombs.splice(i, 1);
        continue;
      }

      b.vel.y -= 19.0 * dt;
      const nextPos = _v1.copy(b.pos).addScaledVector(b.vel, dt);

      // Simple wall bounce check
      const prevY = b.pos.y;
      this.resolveHorizontalMovement(b.pos, nextPos.x, nextPos.z, 0.18);
      if (Math.abs(b.pos.x - nextPos.x) > 0.01) b.vel.x *= -0.45;
      if (Math.abs(b.pos.z - nextPos.z) > 0.01) b.vel.z *= -0.45;

      b.pos.y = prevY + b.vel.y * dt;
      const gY = this.map.groundHeightAt(b.pos.x, b.pos.z, b.pos.y) + 0.14;
      if (b.pos.y <= gY) {
        b.pos.y = gY;
        b.vel.y = Math.abs(b.vel.y) > 2.2 ? -b.vel.y * 0.42 : 0;
        b.vel.x *= 0.72;
        b.vel.z *= 0.72;
      }

      b.rig.root.position.copy(b.pos);
      b.rig.root.rotation.x += dt * 7;
      b.rig.root.rotation.z += dt * 5;
      // Blinking fuse LED
      const blink = Math.floor((b.detonateAt - now) / 90) % 2 === 0;
      b.rig.ledMesh.visible = blink;
    }
  }

  private spawnTracer(start: THREE.Vector3, end: THREE.Vector3, colorHex: string, now: number) {
    const dist = start.distanceTo(end);
    if (dist < 0.2) return;
    const mat = new THREE.MeshBasicMaterial({
      color: colorHex,
      transparent: true,
      opacity: 0.85,
    });
    const mesh = new THREE.Mesh(this.tracerGeo, mat);
    mesh.position.lerpVectors(start, end, 0.5);
    mesh.scale.set(1, dist, 1);
    _dir.subVectors(end, start).normalize();
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), _dir);
    this.scene.add(mesh);
    this.tracers.push({ mesh, expiresAt: now + 75 });
  }

  private spawnParticles(pos: THREE.Vector3, colorHex: number, count: number, now: number) {
    const mat = new THREE.MeshBasicMaterial({ color: colorHex });
    for (let i = 0; i < count; i++) {
      const m = new THREE.Mesh(this.particleGeo, mat);
      m.position.copy(pos);
      this.scene.add(m);
      this.particles.push({
        mesh: m,
        vel: new THREE.Vector3(
          (Math.random() - 0.5) * 9,
          Math.random() * 6.5,
          (Math.random() - 0.5) * 9
        ),
        expiresAt: now + 450,
      });
    }
  }

  private updateFx(dt: number, now: number) {
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      if (now >= this.tracers[i].expiresAt) {
        this.scene.remove(this.tracers[i].mesh);
        (this.tracers[i].mesh.material as THREE.Material).dispose();
        this.tracers.splice(i, 1);
      }
    }

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pt = this.particles[i];
      if (now >= pt.expiresAt) {
        this.scene.remove(pt.mesh);
        this.particles.splice(i, 1);
        continue;
      }
      pt.vel.y -= 14 * dt;
      pt.mesh.position.addScaledVector(pt.vel, dt);
      pt.mesh.scale.multiplyScalar(0.95);
    }

    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const sw = this.shockwaves[i];
      const t = (now - sw.createdAt) / sw.durationMs;
      if (t >= 1) {
        this.scene.remove(sw.mesh);
        (sw.mesh.material as THREE.Material).dispose();
        this.shockwaves.splice(i, 1);
        continue;
      }
      const scale = 0.6 + t * sw.maxScale;
      sw.mesh.scale.setScalar(scale);
      (sw.mesh.material as THREE.MeshBasicMaterial).opacity = 0.65 * (1 - t);
    }

    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const pr = this.projectiles[i];
      if (now >= pr.expiresAt) {
        this.scene.remove(pr.mesh);
        this.projectiles.splice(i, 1);
        continue;
      }
      const stepDist = pr.vel.length() * dt;
      _dir.copy(pr.vel).normalize();
      _raycaster.set(pr.pos, _dir);
      _raycaster.far = stepDist + 0.35;

      const wallHits = _raycaster.intersectObjects(this.map.bulletBlockers, false);
      let directBotHit: BotActor | null = null;
      let hitHead = false;
      for (const bot of this.bots) {
        if (!bot.alive || bot.dropState !== 'ground' || bot.id === pr.ownerId) continue;
        const h1 = _raycaster.intersectObject(bot.rig.headMesh, false);
        if (h1.length > 0) {
          directBotHit = bot;
          hitHead = true;
          break;
        }
        const h2 = _raycaster.intersectObject(bot.rig.bodyMesh, false);
        if (h2.length > 0) {
          directBotHit = bot;
          break;
        }
      }

      if (directBotHit || wallHits.length > 0) {
        const impactPos = directBotHit
          ? directBotHit.pos.clone().add(new THREE.Vector3(0, 1.1, 0))
          : wallHits[0].point.clone();

        if (pr.weapon.projectileType === 'rocket') {
          this.detonateExplosion(
            impactPos,
            pr.ownerId,
            pr.ownerId === 'player' ? 'SEN' : 'Bot',
            pr.weapon,
            pr.weapon.explosionRadius || 6.5,
            now
          );
        } else {
          this.spawnParticles(impactPos, 0xa855f7, 8, now);
          if (directBotHit) {
            this.applyDamageToBot(
              directBotHit,
              pr.ownerId,
              pr.ownerId === 'player' ? 'SEN' : 'Bot',
              pr.weapon,
              hitHead,
              now
            );
          }
        }

        this.scene.remove(pr.mesh);
        this.projectiles.splice(i, 1);
      } else {
        pr.pos.addScaledVector(pr.vel, dt);
        pr.mesh.position.copy(pr.pos);
      }
    }
  }

  private pushKillFeed(item: KillFeedItem) {
    this.killFeed = [item, ...this.killFeed].slice(0, 5);
  }

  private finishMatch(outcome: 'victory' | 'eliminated', eliminatedBy?: string) {
    if (this.mode === 'ended') return;
    this.mode = 'ended';
    this.fireHeld = false;
    this.adsHeld = false;
    this.keysHeld.clear();
    if (document.pointerLockElement === this.renderer.domElement) {
      document.exitPointerLock();
    }

    const aliveBots = this.bots.reduce((acc, b) => acc + (b.alive ? 1 : 0), 0);
    const placement = outcome === 'victory' ? 1 : aliveBots + 1;
    this.emitHudNow();
    this.callbacks.onMatchEnd({
      outcome,
      placement,
      totalCombatants: 30,
      kills: this.playerKills,
      headshots: this.playerHeadshots,
      damageDealt: Math.round(this.playerDamage),
      survivalSeconds: Math.round(this.matchElapsed),
      eliminatedBy,
    });
  }

  private emitHudNow(now = performance.now()) {
    this.lastHudEmitAt = now;
    const weapon = getWeaponBySlot(this.playerSlot);
    const ammo = this.playerAmmoMap.get(weapon.slot) ?? weapon.magSize;
    const isReloading = this.playerReloadingUntil > now;
    const reloadProgress = isReloading
      ? 1 - (this.playerReloadingUntil - now) / Math.max(1, this.playerReloadTotal)
      : 0;

    const room = this.map.roomNameAt(this.playerPos.x, this.playerPos.y, this.playerPos.z);
    const aliveBots = this.bots.reduce((acc, b) => acc + (b.alive ? 1 : 0), 0);

    const blips: MinimapBlip[] = [];
    for (const bot of this.bots) {
      if (!bot.alive || bot.dropState === 'plane') continue;
      blips.push({
        x: bot.pos.x,
        z: bot.pos.z,
        floor: bot.pos.y >= 3.2 ? 2 : 1,
        kind: 'bot',
      });
    }
    for (const c of this.map.crates) {
      if (now >= c.cooldownUntil) {
        blips.push({
          x: c.position.x,
          z: c.position.z,
          floor: c.floor,
          kind: 'crate',
        });
      }
    }
    for (const v of this.vehicles) {
      if (v.hp > 0 && !v.occupiedByPlayer) {
        blips.push({
          x: v.pos.x,
          z: v.pos.z,
          floor: 1,
          kind: 'car',
        });
      }
    }

    const distCenter = Math.hypot(this.playerPos.x, this.playerPos.z);
    const zoneDps =
      this.dropPhase === 'ground'
        ? calculateZoneDps(distCenter, this.zoneRadius, this.config.zoneShrinkSpeed)
        : 0;

    this.callbacks.onHudUpdate({
      hp: Math.ceil(this.playerHp),
      maxHp: this.config.startingHp,
      shield: Math.ceil(this.playerShield),
      maxShield: this.config.startingShield,
      jetpackFuel: Math.round(this.jetpackFuel),
      grenades: this.playerGrenades,
      maxGrenades: this.maxGrenades,
      aliveCount: aliveBots + (this.playerHp > 0 ? 1 : 0),
      totalCount: 30,
      kills: this.playerKills,
      headshots: this.playerHeadshots,
      damageDealt: Math.round(this.playerDamage),
      survivalSeconds: Math.round(this.matchElapsed),
      weaponSlot: weapon.slot,
      ammoInMag: ammo,
      magSize: weapon.magSize,
      isReloading,
      reloadProgress,
      isAds: this.adsHeld,
      currentFloor: room.floor,
      currentRoom: room.name,
      zoneRadius: Number(this.zoneRadius.toFixed(1)),
      outsideZone: zoneDps > 0,
      zoneDps,
      playerX: this.playerPos.x,
      playerY: this.playerPos.y,
      playerZ: this.playerPos.z,
      playerYaw: this.playerYaw,
      dropPhase: this.dropPhase,
      altitude: Math.max(0, Math.round(this.playerPos.y)),
      parachuteOpen: this.parachuteOpen,
      planeProgress: Math.min(1, this.planeProgress),
      planeStartX: this.planeStart.x,
      planeStartZ: this.planeStart.z,
      planeEndX: this.planeEnd.x,
      planeEndZ: this.planeEnd.z,
      inVehicle: Boolean(this.activeVehicle),
      vehicleName: this.activeVehicle?.name || '',
      vehicleSpeedKmh: this.activeVehicle
        ? Math.round(Math.abs(this.activeVehicle.speed) * 3.6)
        : 0,
      vehicleHp: this.activeVehicle?.hp || 0,
      vehicleMaxHp: this.activeVehicle?.maxHp || 300,
      nearbyVehicleName: this.nearbyVehicle?.name || null,
      houses: this.map.houses,
      blips,
      hitMarker: now < this.hitMarkerUntil ? this.hitMarker : 'none',
      headCatBannerUntil: this.headCatBannerUntil,
      headCatVictim: this.headCatVictim,
      killFeed: this.killFeed,
    });
  }

  public dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);
    window.removeEventListener('resize', this.handleResize);
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('blur', this.handleWindowBlur);
    window.removeEventListener('mouseup', this.handleMouseUp);
    window.removeEventListener('mousemove', this.handleMouseMove);
    this.renderer.domElement.removeEventListener('mousedown', this.handleMouseDown);
    this.renderer.domElement.removeEventListener('contextmenu', this.preventContextMenu);
    this.renderer.domElement.removeEventListener('wheel', this.handleWheel);
    this.renderer.domElement.removeEventListener('webglcontextlost', this.handleContextLost);
    this.renderer.dispose();
  }
}
