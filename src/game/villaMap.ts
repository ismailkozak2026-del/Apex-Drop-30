import * as THREE from 'three';
import type { HouseFootprint } from '../shared/types';
import type { VehicleStyle } from './vehicleModels';

export const ARENA_HALF_SIZE = 270;
export const ARENA_INITIAL_ZONE = 260;

export interface BoxCollider {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
  isGlass?: boolean;
  isFloor?: boolean;
}

export interface SupplyCrateNode {
  id: string;
  position: THREE.Vector3;
  floor: 1 | 2;
  mesh: THREE.Group;
  cooldownUntil: number;
}

export interface WaypointNode {
  id: number;
  pos: THREE.Vector3;
  floor: 1 | 2;
  neighbors: number[];
}

export interface VehicleSpawnDef {
  id: string;
  name: string;
  style: VehicleStyle;
  color: number;
  x: number;
  z: number;
  yaw: number;
}

export interface VillaMapResult {
  group: THREE.Group;
  solidColliders: BoxCollider[];
  bulletBlockers: THREE.Mesh[];
  glassPanes: THREE.Mesh[];
  crates: SupplyCrateNode[];
  waypoints: WaypointNode[];
  spawnPoints: THREE.Vector3[];
  houses: HouseFootprint[];
  vehicleSpawns: VehicleSpawnDef[];
  poolWaterMesh: THREE.Mesh;
  groundHeightAt: (x: number, z: number, currentY: number) => number;
  roomNameAt: (x: number, y: number, z: number) => { floor: 1 | 2; name: string };
}

interface HouseBlueprint {
  id: string;
  name: string;
  x: number;
  z: number;
  w: number;
  d: number;
  wallColor: number;
  roofColor: number;
  hasSecondFloor?: boolean;
}

// 18 independent houses scattered across huge distances (75m to 232m from center)
const INDEPENDENT_HOUSES: HouseBlueprint[] = [
  { id: 'h1', name: 'Kuzey Çiftlik Evi', x: -34, z: -108, w: 14, d: 11, wallColor: 0xf1e8d9, roofColor: 0xb4533c },
  { id: 'h2', name: 'Kuzeydoğu Taş Konak', x: 78, z: -118, w: 15, d: 12, wallColor: 0xe6dccb, roofColor: 0x9a3412 },
  { id: 'h3', name: 'Kuzeybatı Orman Evi', x: -116, z: -96, w: 13, d: 11, wallColor: 0xdcc7ab, roofColor: 0x7c2d12 },
  { id: 'h4', name: 'Batı Kavşak Evi', x: -92, z: -14, w: 14, d: 12, wallColor: 0xf4efe6, roofColor: 0x334155 },
  { id: 'h5', name: 'Doğu Deniz Evi', x: 96, z: 18, w: 14, d: 12, wallColor: 0xe0f2fe, roofColor: 0x0369a1 },
  { id: 'h6', name: 'Güney Bağ Evi', x: -26, z: 98, w: 14, d: 11, wallColor: 0xf5ebe0, roofColor: 0xb4533c },
  { id: 'h7', name: 'Güneydoğu Çardak', x: 88, z: 104, w: 13, d: 11, wallColor: 0xede0d4, roofColor: 0x92400e },
  { id: 'h8', name: 'Güneybatı Depo Evi', x: -104, z: 92, w: 15, d: 12, wallColor: 0xe2e8f0, roofColor: 0x475569 },
  { id: 'h9', name: 'Uzak Kuzey Malikanesi', x: 16, z: -206, w: 16, d: 13, wallColor: 0xfaf5ee, roofColor: 0xb91c1c },
  { id: 'h10', name: 'Kuzeybatı Tepe Kulübesi', x: -195, z: -178, w: 12, d: 10, wallColor: 0xd6bfa3, roofColor: 0x78350f },
  { id: 'h11', name: 'Kuzeydoğu Gözcü Evi', x: 188, z: -184, w: 13, d: 11, wallColor: 0xf1f5f9, roofColor: 0x1e293b },
  { id: 'h12', name: 'Uzak Batı Vadi Evi', x: -208, z: -24, w: 15, d: 12, wallColor: 0xf3e8d6, roofColor: 0x9a3412 },
  { id: 'h13', name: 'Batı Sahil Köşkü', x: -186, z: 146, w: 14, d: 12, wallColor: 0xe0f2fe, roofColor: 0x0284c7 },
  { id: 'h14', name: 'Güneybatı Kır Evi', x: -118, z: 204, w: 14, d: 11, wallColor: 0xf5efe6, roofColor: 0xb4533c },
  { id: 'h15', name: 'Uzak Güney İstasyonu', x: 24, z: 208, w: 16, d: 12, wallColor: 0xe2e8f0, roofColor: 0x334155 },
  { id: 'h16', name: 'Güneydoğu İskele Evi', x: 164, z: 186, w: 14, d: 12, wallColor: 0xe0f2fe, roofColor: 0x0369a1 },
  { id: 'h17', name: 'Uzak Doğu Çiftliği', x: 212, z: 54, w: 15, d: 12, wallColor: 0xf4ede2, roofColor: 0x9a3412 },
  { id: 'h18', name: 'Doğu Rüzgar Evi', x: 192, z: -76, w: 13, d: 11, wallColor: 0xfaf5ee, roofColor: 0x475569 },
];

const VEHICLE_SPAWNS: VehicleSpawnDef[] = [
  { id: 'car-1', name: 'Apex GT Spor', style: 'sport', color: 0xdc2626, x: 16, z: -28, yaw: Math.PI / 2 },
  { id: 'car-2', name: 'Akdeniz 4x4', style: 'offroad', color: 0x3f6212, x: -22, z: -76, yaw: 0 },
  { id: 'car-3', name: 'Vanguard Sedan', style: 'sedan', color: 0xf8fafc, x: 56, z: 6, yaw: -Math.PI / 2 },
  { id: 'car-4', name: 'Çöl Kamyoneti 4x4', style: 'offroad', color: 0xd97706, x: -74, z: -6, yaw: Math.PI / 2 },
  { id: 'car-5', name: 'Kuzey GT Coupe', style: 'sport', color: 0x0284c7, x: 8, z: -158, yaw: Math.PI },
  { id: 'car-6', name: 'Güney Sedan', style: 'sedan', color: 0x1e293b, x: -10, z: 154, yaw: 0 },
  { id: 'car-7', name: 'Doğu Safari 4x4', style: 'offroad', color: 0x0f766e, x: 154, z: -18, yaw: 0.3 },
  { id: 'car-8', name: 'Batı Turbo Spor', style: 'sport', color: 0xfacc15, x: -156, z: 22, yaw: -0.2 },
  { id: 'car-9', name: 'Sahil Sedan', style: 'sedan', color: 0x7c3aed, x: 138, z: 152, yaw: -Math.PI / 4 },
  { id: 'car-10', name: 'Tepe 4x4', style: 'offroad', color: 0xbe123c, x: -146, z: -144, yaw: Math.PI / 4 },
];

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = THREE.MathUtils.clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

// Smooth deterministic rolling hills that flatten cleanly at the Central Villa, roads, and every house pad
export function islandTerrainHeightAt(x: number, z: number): number {
  const distCenter = Math.hypot(x, z);
  // Keep central Villa & garden perfectly flat (radius 48m)
  let flatMask = smoothstep(46, 74, distCenter);

  // Flatten along N-S and E-W main asphalt roads (|x| < 12 or |z| < 12)
  const roadNS = smoothstep(7, 16, Math.abs(x));
  const roadEW = smoothstep(7, 16, Math.abs(z));
  flatMask *= Math.min(roadNS, roadEW);

  // Flatten along outer ring road (r ~ 154m)
  const ringDist = Math.abs(distCenter - 154);
  flatMask *= smoothstep(6, 15, ringDist);

  // Flatten beneath each of the 18 independent houses
  for (const h of INDEPENDENT_HOUSES) {
    const dx = Math.abs(x - h.x) - h.w * 0.65;
    const dz = Math.abs(z - h.z) - h.d * 0.65;
    const dPad = Math.max(dx, dz, 0);
    flatMask *= smoothstep(2, 14, dPad);
  }

  // Rolling Mediterranean hills
  const wave =
    Math.sin(x * 0.021) * Math.cos(z * 0.019) * 5.2 +
    Math.sin((x + z) * 0.011) * 3.4 +
    Math.cos(x * 0.037 - z * 0.028) * 1.6;
  const hillHeight = Math.max(0, wave + 1.8) * flatMask;

  // Coastal drop outside playable arena border (r > 278m)
  if (distCenter > 276) {
    const drop = smoothstep(276, 325, distCenter) * 9.0;
    return hillHeight - drop;
  }

  return hillHeight;
}

function makeCanvasTexture(
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
  repeatX = 1,
  repeatY = 1,
  size = 256
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  draw(ctx, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  return tex;
}

export function buildVillaArena(isSoftwareGl: boolean): VillaMapResult {
  const group = new THREE.Group();
  const solidColliders: BoxCollider[] = [];
  const bulletBlockers: THREE.Mesh[] = [];
  const glassPanes: THREE.Mesh[] = [];
  const crates: SupplyCrateNode[] = [];

  // Procedural Mediterranean PBR Textures
  const marbleTex = makeCanvasTexture(
    (ctx, w, h) => {
      ctx.fillStyle = '#ede8de';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = 'rgba(168, 152, 128, 0.35)';
      ctx.lineWidth = 3;
      for (let i = 0; i <= 4; i++) {
        const p = (i * w) / 4;
        ctx.beginPath();
        ctx.moveTo(p, 0);
        ctx.lineTo(p, h);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, p);
        ctx.lineTo(w, p);
        ctx.stroke();
      }
    },
    10,
    10
  );

  const woodTex = makeCanvasTexture(
    (ctx, w, h) => {
      ctx.fillStyle = '#8b5e3c';
      ctx.fillRect(0, 0, w, h);
      for (let y = 0; y < h; y += 32) {
        ctx.fillStyle = y % 64 === 0 ? '#7c5132' : '#966642';
        ctx.fillRect(0, y, w, 30);
        ctx.fillStyle = '#4e311d';
        ctx.fillRect(0, y + 30, w, 2);
      }
    },
    6,
    6
  );

  const travertineTex = makeCanvasTexture(
    (ctx, w, h) => {
      ctx.fillStyle = '#d9ccb4';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = 'rgba(120, 105, 82, 0.25)';
      ctx.lineWidth = 2;
      for (let x = 0; x <= w; x += 64) {
        ctx.strokeRect(x, 0, 64, 64);
        ctx.strokeRect(x, 64, 64, 64);
        ctx.strokeRect(x, 128, 64, 64);
        ctx.strokeRect(x, 192, 64, 64);
      }
    },
    12,
    8
  );

  const grassTex = makeCanvasTexture(
    (ctx, w, h) => {
      ctx.fillStyle = '#4b7447';
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 600; i++) {
        ctx.fillStyle = i % 2 === 0 ? 'rgba(62, 102, 58, 0.45)' : 'rgba(104, 138, 76, 0.3)';
        ctx.fillRect(Math.random() * w, Math.random() * h, 6, 6);
      }
    },
    48,
    48
  );

  const roadTex = makeCanvasTexture(
    (ctx, w, h) => {
      ctx.fillStyle = '#2d333b';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#eab308';
      ctx.fillRect(w / 2 - 4, 16, 8, 96);
      ctx.fillRect(w / 2 - 4, 144, 8, 96);
    },
    1,
    40
  );

  const stuccoMat = new THREE.MeshStandardMaterial({ color: 0xf4efe6, roughness: 0.86, metalness: 0.02 });
  const warmStoneMat = new THREE.MeshStandardMaterial({ color: 0xc9b99f, roughness: 0.82, metalness: 0.04 });
  const terracottaMat = new THREE.MeshStandardMaterial({ color: 0xb4533c, roughness: 0.72, metalness: 0.05 });
  const marbleMat = new THREE.MeshStandardMaterial({ map: marbleTex, roughness: 0.22, metalness: 0.08 });
  const woodMat = new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.55, metalness: 0.05 });
  const travertineMat = new THREE.MeshStandardMaterial({ map: travertineTex, roughness: 0.78, metalness: 0.03 });
  const darkTrimMat = new THREE.MeshStandardMaterial({ color: 0x272a30, roughness: 0.38, metalness: 0.75 });
  const brassMat = new THREE.MeshStandardMaterial({ color: 0xd4a44a, roughness: 0.25, metalness: 0.88 });
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0x93d5f5,
    roughness: 0.08,
    metalness: 0.05,
    transparent: true,
    opacity: isSoftwareGl ? 0.34 : 0.28,
    transmission: isSoftwareGl ? 0 : 0.7,
    ior: 1.48,
    depthWrite: false,
  });

  const addBox = (
    cx: number,
    cy: number,
    cz: number,
    sx: number,
    sy: number,
    sz: number,
    mat: THREE.Material,
    options: { collide?: boolean; blockBullets?: boolean; isGlass?: boolean; isFloor?: boolean; castShadow?: boolean } = {}
  ) => {
    const {
      collide = true,
      blockBullets = true,
      isGlass = false,
      isFloor = false,
      castShadow = !isFloor && !isGlass,
    } = options;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat);
    mesh.position.set(cx, cy, cz);
    mesh.castShadow = castShadow;
    mesh.receiveShadow = true;
    if (isGlass) {
      mesh.renderOrder = 4;
      glassPanes.push(mesh);
    }
    group.add(mesh);
    if (collide) {
      solidColliders.push({
        minX: cx - sx / 2,
        maxX: cx + sx / 2,
        minY: cy - sy / 2,
        maxY: cy + sy / 2,
        minZ: cz - sz / 2,
        maxZ: cz + sz / 2,
        isGlass,
        isFloor,
      });
    }
    if (blockBullets && !isGlass) {
      bulletBlockers.push(mesh);
    }
    return mesh;
  };

  // --- 1. HUGE 720m x 720m MEDITERRANEAN ISLAND TERRAIN + OCEAN HORIZON ---
  const terrainGeo = new THREE.PlaneGeometry(720, 720, 128, 128);
  terrainGeo.rotateX(-Math.PI / 2);
  const posAttr = terrainGeo.attributes.position;
  for (let i = 0; i < posAttr.count; i++) {
    const vx = posAttr.getX(i);
    const vz = posAttr.getZ(i);
    posAttr.setY(i, islandTerrainHeightAt(vx, vz) - 0.03);
  }
  terrainGeo.computeVertexNormals();

  const lawnMat = new THREE.MeshStandardMaterial({
    map: grassTex,
    roughness: 0.92,
    metalness: 0.0,
  });
  const groundMesh = new THREE.Mesh(terrainGeo, lawnMat);
  groundMesh.receiveShadow = true;
  group.add(groundMesh);
  bulletBlockers.push(groundMesh);

  // Surrounding Mediterranean Sea plane
  const seaMat = new THREE.MeshPhysicalMaterial({
    color: 0x0284c7,
    roughness: 0.16,
    metalness: 0.08,
    clearcoat: 0.85,
  });
  const seaMesh = new THREE.Mesh(new THREE.PlaneGeometry(1800, 1800), seaMat);
  seaMesh.rotation.x = -Math.PI / 2;
  seaMesh.position.y = -3.8;
  group.add(seaMesh);

  // --- 2. PAVED ASPHALT ROAD NETWORK (Connecting Villa & Outer Compounds) ---
  const roadMat = new THREE.MeshStandardMaterial({
    map: roadTex,
    roughness: 0.85,
    metalness: 0.04,
  });
  const roadStripMat = new THREE.MeshStandardMaterial({
    color: 0x2d333b,
    roughness: 0.86,
    metalness: 0.04,
  });
  // North Road (Z: -255 -> -36)
  addBox(0, 0.02, -145.5, 8.5, 0.05, 219, roadMat, { collide: false, isFloor: true, castShadow: false });
  // South Road (Z: 36 -> 255)
  addBox(0, 0.02, 145.5, 8.5, 0.05, 219, roadMat, { collide: false, isFloor: true, castShadow: false });
  // West Road (X: -255 -> -36)
  addBox(-145.5, 0.02, 0, 219, 0.05, 8.5, roadStripMat, { collide: false, isFloor: true, castShadow: false });
  // East Road (X: 36 -> 255)
  addBox(145.5, 0.02, 0, 219, 0.05, 8.5, roadStripMat, { collide: false, isFloor: true, castShadow: false });

  // Outer Ring Road (r ~ 154m)
  const ringRoad = new THREE.Mesh(
    new THREE.RingGeometry(150, 158, 64),
    roadStripMat
  );
  ringRoad.rotation.x = -Math.PI / 2;
  ringRoad.position.y = 0.03;
  ringRoad.receiveShadow = true;
  group.add(ringRoad);

  // --- 3. CENTRAL 2-STORY LUXURY VILLA + POOL (0,0 Landmark) ---
  addBox(0, 0.01, -20, 42, 0.04, 12, travertineMat, { collide: false, isFloor: true });
  addBox(0, 0.01, 21, 44, 0.04, 22, travertineMat, { collide: false, isFloor: true });

  addBox(0, 0.05, 15.3, 17.6, 0.14, 0.5, warmStoneMat, { collide: false, isFloor: true });
  addBox(0, 0.05, 24.7, 17.6, 0.14, 0.5, warmStoneMat, { collide: false, isFloor: true });
  addBox(-8.7, 0.05, 20, 0.5, 0.14, 9.8, warmStoneMat, { collide: false, isFloor: true });
  addBox(8.7, 0.05, 20, 0.5, 0.14, 9.8, warmStoneMat, { collide: false, isFloor: true });

  const poolWaterMat = new THREE.MeshPhysicalMaterial({
    color: 0x0ea5e9,
    roughness: 0.12,
    metalness: 0.05,
    clearcoat: 1.0,
    transparent: true,
    opacity: 0.82,
  });
  const poolWaterMesh = new THREE.Mesh(new THREE.PlaneGeometry(16.8, 8.8, 18, 10), poolWaterMat);
  poolWaterMesh.rotation.x = -Math.PI / 2;
  poolWaterMesh.position.set(0, 0.06, 20);
  group.add(poolWaterMesh);

  // Villa 1st Floor Slabs
  addBox(0, 0.02, -2, 12, 0.06, 24, marbleMat, { collide: false, isFloor: true });
  addBox(-12, 0.02, -7.5, 12, 0.06, 13, woodMat, { collide: false, isFloor: true });
  addBox(-12, 0.02, 4.5, 12, 0.06, 11, woodMat, { collide: false, isFloor: true });
  addBox(12, 0.02, -2, 12, 0.06, 24, marbleMat, { collide: false, isFloor: true });

  const wallH = 4.1;
  const wallY = wallH / 2;

  // North facade
  addBox(-12, wallY, -14, 12, wallH, 0.45, stuccoMat);
  addBox(-4.1, wallY, -14, 3.8, wallH, 0.45, stuccoMat);
  addBox(4.1, wallY, -14, 3.8, wallH, 0.45, stuccoMat);
  addBox(0, 3.65, -14, 4.4, 0.9, 0.45, stuccoMat);
  addBox(7.8, wallY, -14, 3.6, wallH, 0.45, stuccoMat);
  addBox(16.2, wallY, -14, 3.6, wallH, 0.45, stuccoMat);
  addBox(12, 0.5, -14, 4.8, 1.0, 0.45, stuccoMat);
  addBox(12, 3.65, -14, 4.8, 0.9, 0.45, stuccoMat);
  addBox(12, 2.1, -14, 4.8, 2.2, 0.12, glassMat, { isGlass: true, blockBullets: false });

  // South facade
  addBox(-4.2, wallY, 10, 3.6, wallH, 0.45, stuccoMat);
  addBox(4.2, wallY, 10, 3.6, wallH, 0.45, stuccoMat);
  addBox(0, 3.65, 10, 4.8, 0.9, 0.45, stuccoMat);
  addBox(-16.2, wallY, 10, 3.6, wallH, 0.45, stuccoMat);
  addBox(-7.8, wallY, 10, 3.6, wallH, 0.45, stuccoMat);
  addBox(-12, 0.5, 10, 4.8, 1.0, 0.45, stuccoMat);
  addBox(-12, 3.65, 10, 4.8, 0.9, 0.45, stuccoMat);
  addBox(-12, 2.1, 10, 4.8, 2.2, 0.12, glassMat, { isGlass: true, blockBullets: false });
  addBox(8.0, wallY, 10, 4.0, wallH, 0.45, stuccoMat);
  addBox(16.0, wallY, 10, 4.0, wallH, 0.45, stuccoMat);
  addBox(12.0, 3.65, 10, 4.0, 0.9, 0.45, stuccoMat);

  // West & East Villa walls
  addBox(-18, wallY, -11.5, 0.45, wallH, 5, stuccoMat);
  addBox(-18, 0.5, -6.5, 0.45, 1.0, 5, stuccoMat);
  addBox(-18, 3.65, -6.5, 0.45, 0.9, 5, stuccoMat);
  addBox(-18, 2.1, -6.5, 0.12, 2.2, 5, glassMat, { isGlass: true, blockBullets: false });
  addBox(-18, wallY, -1.5, 0.45, wallH, 5, stuccoMat);
  addBox(-18, 0.5, 4.5, 0.45, 1.0, 5, stuccoMat);
  addBox(-18, 3.65, 4.5, 0.45, 0.9, 5, stuccoMat);
  addBox(-18, 2.1, 4.5, 0.12, 2.2, 5, glassMat, { isGlass: true, blockBullets: false });
  addBox(-18, wallY, 8.5, 0.45, wallH, 3, stuccoMat);

  addBox(18, wallY, -11, 0.45, wallH, 6, stuccoMat);
  addBox(18, 0.5, -3, 0.45, 1.0, 10, stuccoMat);
  addBox(18, 3.65, -3, 0.45, 0.9, 10, stuccoMat);
  addBox(18, 2.1, -3, 0.12, 2.2, 10, glassMat, { isGlass: true, blockBullets: false });
  addBox(18, wallY, 6, 0.45, wallH, 8, stuccoMat);

  // Villa interior partitions
  addBox(-6, wallY, -11.25, 0.35, wallH, 5.5, stuccoMat);
  addBox(-6, 3.65, -7.0, 0.35, 0.9, 3.0, stuccoMat);
  addBox(-6, wallY, -1.25, 0.35, wallH, 8.5, stuccoMat);
  addBox(-6, 3.65, 4.5, 0.35, 0.9, 3.0, stuccoMat);
  addBox(-6, wallY, 8.0, 0.35, wallH, 4.0, stuccoMat);

  addBox(-15.75, wallY, -1, 4.5, wallH, 0.35, stuccoMat);
  addBox(-12.0, 3.65, -1, 3.0, 0.9, 0.35, stuccoMat);
  addBox(-8.25, wallY, -1, 4.5, wallH, 0.35, stuccoMat);

  addBox(6, wallY, -9.5, 0.35, wallH, 9.0, stuccoMat);
  addBox(6, 3.65, -3.0, 0.35, 0.9, 4.0, stuccoMat);
  addBox(6, wallY, 1.5, 0.35, wallH, 5.0, stuccoMat);
  addBox(6, 3.65, 5.5, 0.35, 0.9, 3.0, stuccoMat);
  addBox(6, wallY, 8.5, 0.35, wallH, 3.0, stuccoMat);

  // Central Staircase
  for (let i = 0; i < 10; i++) {
    const t = (i + 1) / 10;
    const stepH = t * 2.1;
    const stepZ = -6.5 + (i + 0.5) * (5.5 / 10);
    addBox(0, stepH / 2, stepZ, 4.4, stepH, 5.5 / 10 + 0.04, marbleMat, { collide: false, isFloor: true });
  }
  addBox(0, 1.05, 0.25, 5.0, 2.1, 2.5, marbleMat, { collide: true, isFloor: true });
  for (let i = 0; i < 10; i++) {
    const t = (i + 1) / 10;
    const stepH = 2.1 + t * 2.1;
    const stepZ = 1.5 + (i + 0.5) * (5.3 / 10);
    addBox(0, stepH / 2, stepZ, 4.4, stepH, 5.3 / 10 + 0.04, marbleMat, { collide: false, isFloor: true });
  }
  addBox(-2.25, 2.6, 0.2, 0.1, 0.9, 13.0, brassMat, { collide: false });
  addBox(2.25, 2.6, 0.2, 0.1, 0.9, 13.0, brassMat, { collide: false });

  // 2nd Floor Slabs & Walls
  const f2Y = 4.05;
  const slabT = 0.3;
  addBox(-12, f2Y, -2, 12, slabT, 24, travertineMat, { collide: true, isFloor: true });
  addBox(12, f2Y, -2, 12, slabT, 24, woodMat, { collide: true, isFloor: true });
  addBox(0, f2Y, -10.5, 12, slabT, 7.0, marbleMat, { collide: true, isFloor: true });
  addBox(0, f2Y, 8.4, 12, slabT, 3.2, marbleMat, { collide: true, isFloor: true });
  addBox(-4.3, f2Y, -0.1, 3.4, slabT, 13.8, marbleMat, { collide: true, isFloor: true });
  addBox(4.3, f2Y, -0.1, 3.4, slabT, 13.8, marbleMat, { collide: true, isFloor: true });

  addBox(-2.6, 4.7, -0.1, 0.08, 1.0, 13.4, glassMat, { isGlass: true, blockBullets: false });
  addBox(2.6, 4.7, -0.1, 0.08, 1.0, 13.4, glassMat, { isGlass: true, blockBullets: false });
  addBox(0, 4.7, -6.9, 5.2, 1.0, 0.08, glassMat, { isGlass: true, blockBullets: false });

  const f2WallH = 4.0;
  const f2WallY = 4.2 + f2WallH / 2;
  addBox(-4.1, f2WallY, -14, 3.8, f2WallH, 0.4, stuccoMat);
  addBox(4.1, f2WallY, -14, 3.8, f2WallH, 0.4, stuccoMat);
  addBox(0, 6.2, -14, 4.4, 3.8, 0.12, glassMat, { isGlass: true, blockBullets: false });
  addBox(0, 4.75, 10, 12, 1.1, 0.14, glassMat, { isGlass: true, blockBullets: false });
  addBox(-6, f2WallY, -12, 0.35, f2WallH, 4.0, stuccoMat);
  addBox(-6, f2WallY, -1.0, 0.35, f2WallH, 12.0, stuccoMat);
  addBox(-6, f2WallY, 9.0, 0.35, f2WallH, 2.0, stuccoMat);
  addBox(-12, 4.75, -14, 12, 1.1, 0.16, glassMat, { isGlass: true, blockBullets: false });
  addBox(-12, 4.75, 10, 12, 1.1, 0.16, glassMat, { isGlass: true, blockBullets: false });
  addBox(-18, 4.75, -2, 0.16, 1.1, 24, glassMat, { isGlass: true, blockBullets: false });
  for (let z = -12; z <= 8; z += 4) {
    addBox(-12, 8.1, z, 11.6, 0.22, 0.28, darkTrimMat, { collide: false });
  }
  addBox(-17.6, 6.2, -13.6, 0.4, 4.0, 0.4, stuccoMat);
  addBox(-17.6, 6.2, 9.6, 0.4, 4.0, 0.4, stuccoMat);
  addBox(6, f2WallY, -12, 0.35, f2WallH, 4.0, stuccoMat);
  addBox(6, 7.7, -8.5, 0.35, 1.0, 3.0, stuccoMat);
  addBox(6, f2WallY, 1.5, 0.35, f2WallH, 17.0, stuccoMat);
  addBox(12, 4.7, -14, 12, 1.0, 0.4, stuccoMat);
  addBox(12, 7.7, -14, 12, 1.0, 0.4, stuccoMat);
  addBox(12, 6.2, -14, 10, 2.0, 0.12, glassMat, { isGlass: true, blockBullets: false });
  addBox(12, 4.7, 10, 12, 1.0, 0.4, stuccoMat);
  addBox(12, 7.7, 10, 12, 1.0, 0.4, stuccoMat);
  addBox(12, 6.2, 10, 10, 2.0, 0.12, glassMat, { isGlass: true, blockBullets: false });
  addBox(18, f2WallY, -10, 0.4, f2WallH, 8, stuccoMat);
  addBox(18, 4.7, -2, 0.4, 1.0, 8, stuccoMat);
  addBox(18, 7.7, -2, 0.4, 1.0, 8, stuccoMat);
  addBox(18, 6.2, -2, 0.12, 2.0, 8, glassMat, { isGlass: true, blockBullets: false });
  addBox(18, f2WallY, 6, 0.4, f2WallH, 8, stuccoMat);
  addBox(6, 8.35, -2, 24.6, 0.35, 24.6, terracottaMat, { collide: false });

  // Villa Furniture
  const fabricMat = new THREE.MeshStandardMaterial({ color: 0xd6cfc2, roughness: 0.9 });
  const cushionMat = new THREE.MeshStandardMaterial({ color: 0x0f766e, roughness: 0.85 });
  const counterMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.3, metalness: 0.3 });

  addBox(-3.6, 0.55, -10.5, 1.8, 1.1, 1.0, warmStoneMat);
  addBox(3.6, 0.55, 6.5, 1.8, 1.1, 1.0, warmStoneMat);
  addBox(-12, 0.45, -8.5, 4.4, 0.9, 1.2, fabricMat);
  addBox(-15, 0.45, -5.5, 1.2, 0.9, 3.6, fabricMat);
  addBox(-12, 0.3, -5.5, 2.0, 0.6, 1.2, darkTrimMat);
  addBox(-13, 0.42, 5.2, 2.4, 0.84, 3.2, fabricMat);
  addBox(-13, 0.72, 6.4, 2.2, 0.6, 0.4, cushionMat);
  addBox(-8.2, 1.2, 0.8, 2.2, 2.4, 0.9, woodMat);
  addBox(12, 0.55, -7.2, 4.4, 1.1, 1.5, counterMat);
  addBox(12, 0.45, 2.2, 3.2, 0.9, 4.4, woodMat);
  addBox(12.5, 4.62, -2.5, 3.0, 0.84, 3.4, fabricMat);
  addBox(12.5, 4.95, -4.0, 2.8, 0.65, 0.4, cushionMat);
  addBox(10.5, 4.65, 5.2, 2.6, 0.9, 1.1, cushionMat);
  addBox(-12, 4.7, -8.5, 3.2, 1.0, 1.2, warmStoneMat);
  addBox(-12, 4.7, 3.5, 3.2, 1.0, 1.2, warmStoneMat);
  addBox(-9.5, 4.6, -2.5, 1.2, 0.8, 2.8, woodMat);
  addBox(-14, 0.35, 18.5, 1.1, 0.7, 2.4, fabricMat);
  addBox(-14, 0.35, 22.5, 1.1, 0.7, 2.4, fabricMat);
  addBox(14, 0.35, 18.5, 1.1, 0.7, 2.4, fabricMat);
  addBox(14, 0.35, 22.5, 1.1, 0.7, 2.4, fabricMat);
  addBox(0, 0.65, 28.0, 5.5, 1.3, 1.4, warmStoneMat);

  // Villa Perimeter Low Limestone Garden Wall (wide gates on all 4 sides for driving & running!)
  addBox(-21, 1.0, -33, 22, 2.0, 0.8, warmStoneMat);
  addBox(21, 1.0, -33, 22, 2.0, 0.8, warmStoneMat);
  addBox(-21, 1.0, 33, 22, 2.0, 0.8, warmStoneMat);
  addBox(21, 1.0, 33, 22, 2.0, 0.8, warmStoneMat);
  addBox(-33, 1.0, -20, 0.8, 2.0, 24, warmStoneMat);
  addBox(-33, 1.0, 20, 0.8, 2.0, 24, warmStoneMat);
  addBox(33, 1.0, -20, 0.8, 2.0, 24, warmStoneMat);
  addBox(33, 1.0, 20, 0.8, 2.0, 24, warmStoneMat);

  // --- 4. 18 INDEPENDENT HOUSES / COMPOUNDS ACROSS THE HUGE ARENA ---
  const crateBodyMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.38, metalness: 0.65 });
  const crateTrimMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    roughness: 0.25,
    metalness: 0.5,
    emissive: 0xf59e0b,
    emissiveIntensity: 0.55,
  });

  const spawnCrate = (id: string, x: number, y: number, z: number, floor: 1 | 2) => {
    const cg = new THREE.Group();
    cg.position.set(x, y, z);
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.62, 0.65), crateBodyMat);
    box.position.y = 0.31;
    box.castShadow = true;
    cg.add(box);
    const strip = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.1, 0.7), crateTrimMat);
    strip.position.y = 0.48;
    cg.add(strip);
    group.add(cg);

    crates.push({
      id,
      position: new THREE.Vector3(x, y, z),
      floor,
      mesh: cg,
      cooldownUntil: 0,
    });
  };

  // Villa's 10 Supply Crates
  const villaCrates: Array<{ id: string; x: number; y: number; z: number; floor: 1 | 2 }> = [
    { id: 'c1', x: 0, y: 0, z: -10.5, floor: 1 },
    { id: 'c2', x: -13.5, y: 0, z: -11, floor: 1 },
    { id: 'c3', x: -15, y: 0, z: 7.5, floor: 1 },
    { id: 'c4', x: 14.5, y: 0, z: -10, floor: 1 },
    { id: 'c5', x: 14.5, y: 0, z: 6.5, floor: 1 },
    { id: 'c6', x: 0, y: 4.2, z: -11, floor: 2 },
    { id: 'c7', x: -14.5, y: 4.2, z: 4.5, floor: 2 },
    { id: 'c8', x: 14.5, y: 4.2, z: 3.5, floor: 2 },
    { id: 'c9', x: -14, y: 0, z: 26, floor: 1 },
    { id: 'c10', x: 14, y: 0, z: 26, floor: 1 },
  ];
  villaCrates.forEach((vc) => spawnCrate(vc.id, vc.x, vc.y, vc.z, vc.floor));

  // Build each independent compound with walls, front/back doorways, glass side windows, roof, table & crate
  const houseMaterialCache = new Map<number, THREE.MeshStandardMaterial>();
  const getMat = (color: number, roughness = 0.82) => {
    const key = color * 100 + Math.round(roughness * 10);
    let m = houseMaterialCache.get(key);
    if (!m) {
      m = new THREE.MeshStandardMaterial({ color, roughness, metalness: 0.05 });
      houseMaterialCache.set(key, m);
    }
    return m;
  };

  INDEPENDENT_HOUSES.forEach((h, idx) => {
    const wallMat = getMat(h.wallColor, 0.85);
    const roofMat = getMat(h.roofColor, 0.72);
    const hw = h.w / 2;
    const hd = h.d / 2;
    const hWall = 3.9;
    const wy = hWall / 2;
    const doorW = 3.0;
    const frontWingW = (h.w - doorW) / 2;

    // Floor & porch slab
    addBox(h.x, 0.02, h.z, h.w + 2.4, 0.08, h.d + 2.4, travertineMat, { collide: false, isFloor: true, castShadow: false });

    // North wall (-Z) with central doorway
    addBox(h.x - (doorW / 2 + frontWingW / 2), wy, h.z - hd, frontWingW, hWall, 0.4, wallMat);
    addBox(h.x + (doorW / 2 + frontWingW / 2), wy, h.z - hd, frontWingW, hWall, 0.4, wallMat);
    addBox(h.x, 3.45, h.z - hd, doorW, 0.9, 0.4, wallMat);

    // South wall (+Z) with central doorway
    addBox(h.x - (doorW / 2 + frontWingW / 2), wy, h.z + hd, frontWingW, hWall, 0.4, wallMat);
    addBox(h.x + (doorW / 2 + frontWingW / 2), wy, h.z + hd, frontWingW, hWall, 0.4, wallMat);
    addBox(h.x, 3.45, h.z + hd, doorW, 0.9, 0.4, wallMat);

    // West & East walls with glass windows (bullets shoot through glass!)
    const winD = 4.0;
    const sideWingD = (h.d - winD) / 2;
    for (const sx of [-1, 1]) {
      const wx = h.x + sx * hw;
      addBox(wx, wy, h.z - (winD / 2 + sideWingD / 2), 0.4, hWall, sideWingD, wallMat);
      addBox(wx, wy, h.z + (winD / 2 + sideWingD / 2), 0.4, hWall, sideWingD, wallMat);
      addBox(wx, 0.5, h.z, 0.4, 1.0, winD, wallMat);
      addBox(wx, 3.45, h.z, 0.4, 0.9, winD, wallMat);
      addBox(wx, 2.0, h.z, 0.1, 2.0, winD, glassMat, { isGlass: true, blockBullets: false });
    }

    // Overhanging pitched-style composite roof + trim
    addBox(h.x, 4.08, h.z, h.w + 1.4, 0.34, h.d + 1.4, roofMat);
    addBox(h.x, 4.48, h.z, h.w * 0.68, 0.46, h.d * 0.68, roofMat, { collide: false });

    // Interior cover counter + corner crate
    addBox(h.x - hw * 0.38, 0.5, h.z, 2.0, 1.0, 1.2, woodMat);
    spawnCrate(`hc-${idx + 1}`, h.x + hw * 0.42, 0, h.z + hd * 0.35, 1);
  });

  // --- 5. HUGE MEDITERRANEAN CYPRESS & OLIVE FOREST (240 Instanced Trees + 60 Rocks) ---
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 0.9 });
  const cypressMat = new THREE.MeshStandardMaterial({ color: 0x2d5a36, roughness: 0.85 });
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.88 });

  const isClearForTree = (tx: number, tz: number): boolean => {
    if (Math.hypot(tx, tz) < 46) return false; // Keep Villa clear
    if (Math.abs(tx) < 10 || Math.abs(tz) < 10) return false; // Keep N-S & E-W roads clear
    if (Math.abs(Math.hypot(tx, tz) - 154) < 11) return false; // Keep Ring road clear
    for (const h of INDEPENDENT_HOUSES) {
      if (Math.abs(tx - h.x) < h.w * 0.78 + 3 && Math.abs(tz - h.z) < h.d * 0.78 + 3) {
        return false;
      }
    }
    for (const v of VEHICLE_SPAWNS) {
      if (Math.hypot(tx - v.x, tz - v.z) < 8) return false;
    }
    return true;
  };

  const treeCoords: [number, number][] = [];
  // Inner Villa cypress ring + vast scattered island groves
  for (let i = 0; i < 36; i++) {
    const angle = (i / 36) * Math.PI * 2;
    const r = 41 + (i % 3) * 3.5;
    const tx = Math.cos(angle) * r;
    const tz = Math.sin(angle) * r;
    if (Math.abs(tx) > 8 && Math.abs(tz) > 8) {
      treeCoords.push([tx, tz]);
    }
  }
  for (let i = 0; i < 320 && treeCoords.length < 240; i++) {
    // Deterministic pseudo-random golden spiral distribution across ±255m
    const frac = (i + 0.5) / 320;
    const r = 52 + Math.sqrt(frac) * 208;
    const theta = i * 2.3999632;
    const tx = Math.cos(theta) * r;
    const tz = Math.sin(theta) * r;
    if (isClearForTree(tx, tz)) {
      treeCoords.push([tx, tz]);
    }
  }

  const trunkInst = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.28, 0.38, 2.8, 7),
    trunkMat,
    treeCoords.length
  );
  const foliageInst = new THREE.InstancedMesh(
    new THREE.ConeGeometry(1.5, 7.6, 8),
    cypressMat,
    treeCoords.length
  );
  const dummy = new THREE.Object3D();
  treeCoords.forEach(([tx, tz], idx) => {
    const groundY = islandTerrainHeightAt(tx, tz);
    const s = 0.85 + (idx % 5) * 0.14;
    dummy.position.set(tx, groundY + 1.4 * s, tz);
    dummy.scale.set(s, s, s);
    dummy.updateMatrix();
    trunkInst.setMatrixAt(idx, dummy.matrix);

    dummy.position.set(tx, groundY + 5.1 * s, tz);
    dummy.scale.set(s, s, s);
    dummy.updateMatrix();
    foliageInst.setMatrixAt(idx, dummy.matrix);

    solidColliders.push({
      minX: tx - 0.55,
      maxX: tx + 0.55,
      minY: groundY,
      maxY: groundY + 4.5,
      minZ: tz - 0.55,
      maxZ: tz + 0.55,
    });
  });
  trunkInst.computeBoundingSphere();
  foliageInst.computeBoundingSphere();
  group.add(trunkInst, foliageInst);

  // Instanced rock outcrops across hills & coast
  const rockCoords: [number, number][] = [];
  for (let i = 0; i < 64; i++) {
    const r = 68 + ((i * 37) % 195);
    const ang = i * 1.91;
    const rx = Math.cos(ang) * r;
    const rz = Math.sin(ang) * r;
    if (isClearForTree(rx, rz)) {
      rockCoords.push([rx, rz]);
    }
  }
  const rockInst = new THREE.InstancedMesh(
    new THREE.DodecahedronGeometry(2.2, 0),
    rockMat,
    rockCoords.length
  );
  rockCoords.forEach(([rx, rz], idx) => {
    const gy = islandTerrainHeightAt(rx, rz);
    const sx = 1.0 + (idx % 3) * 0.45;
    const sy = 0.65 + (idx % 2) * 0.25;
    dummy.position.set(rx, gy + 0.6, rz);
    dummy.rotation.set(0, idx * 0.7, 0);
    dummy.scale.set(sx, sy, sx * 0.9);
    dummy.updateMatrix();
    rockInst.setMatrixAt(idx, dummy.matrix);
  });
  rockInst.computeBoundingSphere();
  group.add(rockInst);

  // --- 6. EXPANDED WAYPOINT GRAPH (Villa 32 nodes + Roads & 18 Houses) ---
  const wpCoords: Array<{ pos: [number, number, number]; floor: 1 | 2 }> = [
    /* 0 */ { pos: [0, 0, -21], floor: 1 },
    /* 1 */ { pos: [0, 0, -12], floor: 1 },
    /* 2 */ { pos: [0, 0, -7.2], floor: 1 },
    /* 3 */ { pos: [0, 2.1, 0.2], floor: 1 },
    /* 4 */ { pos: [0, 4.2, 7.6], floor: 2 },
    /* 5 */ { pos: [-4.2, 4.2, 0], floor: 2 },
    /* 6 */ { pos: [4.2, 4.2, 0], floor: 2 },
    /* 7 */ { pos: [0, 4.2, -9.5], floor: 2 },
    /* 8 */ { pos: [-8, 4.2, -8.5], floor: 2 },
    /* 9 */ { pos: [-14, 4.2, -2], floor: 2 },
    /* 10 */ { pos: [-12, 4.2, 6.5], floor: 2 },
    /* 11 */ { pos: [8, 4.2, -8.5], floor: 2 },
    /* 12 */ { pos: [14, 4.2, -8], floor: 2 },
    /* 13 */ { pos: [14, 4.2, 5], floor: 2 },
    /* 14 */ { pos: [-4, 0, -7], floor: 1 },
    /* 15 */ { pos: [-12, 0, -11], floor: 1 },
    /* 16 */ { pos: [-12, 0, -3], floor: 1 },
    /* 17 */ { pos: [-12, 0, 1.5], floor: 1 },
    /* 18 */ { pos: [-8, 0, 4.5], floor: 1 },
    /* 19 */ { pos: [4, 0, -3], floor: 1 },
    /* 20 */ { pos: [12, 0, -10.5], floor: 1 },
    /* 21 */ { pos: [15, 0, -2], floor: 1 },
    /* 22 */ { pos: [12, 0, 7], floor: 1 },
    /* 23 */ { pos: [0, 0, 8.2], floor: 1 },
    /* 24 */ { pos: [0, 0, 13], floor: 1 },
    /* 25 */ { pos: [-12, 0, 13], floor: 1 },
    /* 26 */ { pos: [12, 0, 13], floor: 1 },
    /* 27 */ { pos: [-12, 0, 25], floor: 1 },
    /* 28 */ { pos: [12, 0, 25], floor: 1 },
    /* 29 */ { pos: [0, 0, 26.5], floor: 1 },
    /* 30 */ { pos: [-24, 0, 4], floor: 1 },
    /* 31 */ { pos: [24, 0, 4], floor: 1 },
    // Road Hubs (32..39)
    /* 32 */ { pos: [0, 0, -45], floor: 1 },
    /* 33 */ { pos: [0, 0, -154], floor: 1 },
    /* 34 */ { pos: [0, 0, 45], floor: 1 },
    /* 35 */ { pos: [0, 0, 154], floor: 1 },
    /* 36 */ { pos: [-45, 0, 0], floor: 1 },
    /* 37 */ { pos: [-154, 0, 0], floor: 1 },
    /* 38 */ { pos: [45, 0, 0], floor: 1 },
    /* 39 */ { pos: [154, 0, 0], floor: 1 },
  ];

  // Add 18 house center waypoints (40..57)
  INDEPENDENT_HOUSES.forEach((h) => {
    wpCoords.push({ pos: [h.x, 0, h.z], floor: 1 });
  });

  const adjacency: Record<number, number[]> = {
    0: [1, 30, 31, 32],
    1: [0, 2, 14, 19],
    2: [1, 3, 14, 19],
    3: [2, 4],
    4: [3, 5, 6],
    5: [4, 7, 8],
    6: [4, 7, 11],
    7: [5, 6, 8, 11],
    8: [5, 7, 9],
    9: [8, 10],
    10: [9],
    11: [6, 7, 12],
    12: [11, 13],
    13: [12],
    14: [1, 2, 15, 16],
    15: [14, 16],
    16: [14, 15, 17],
    17: [16, 18],
    18: [17, 23],
    19: [1, 2, 20, 21],
    20: [19, 21],
    21: [19, 20, 22],
    22: [21, 26],
    23: [18, 24],
    24: [23, 25, 26],
    25: [24, 27, 30],
    26: [22, 24, 28, 31],
    27: [25, 29, 30],
    28: [26, 29, 31],
    29: [27, 28, 34],
    30: [0, 25, 27, 36],
    31: [0, 26, 28, 38],
    32: [0, 33, 40, 41, 42],
    33: [32, 37, 39, 40, 41, 48],
    34: [29, 35, 45, 46, 47],
    35: [34, 37, 39, 45, 46, 54],
    36: [30, 37, 43, 42, 47],
    37: [36, 33, 35, 43, 51, 52],
    38: [31, 39, 44, 41, 46],
    39: [38, 33, 35, 44, 56, 57],
  };

  // Link each independent house waypoint back to nearest road hubs + neighbors
  INDEPENDENT_HOUSES.forEach((_, idx) => {
    const wpId = 40 + idx;
    const linked: number[] = [];
    for (let hub = 32; hub <= 39; hub++) {
      if (adjacency[hub]?.includes(wpId)) linked.push(hub);
    }
    if (linked.length === 0) linked.push(33, 35, 37, 39);
    // Also chain adjacent outer houses
    const nextHouse = 40 + ((idx + 1) % INDEPENDENT_HOUSES.length);
    linked.push(nextHouse);
    adjacency[wpId] = linked;
  });

  const waypoints: WaypointNode[] = wpCoords.map((wp, id) => ({
    id,
    pos: new THREE.Vector3(wp.pos[0], wp.pos[1], wp.pos[2]),
    floor: wp.floor,
    neighbors: adjacency[id] || [0],
  }));

  const spawnPoints: THREE.Vector3[] = [
    new THREE.Vector3(0, 0, -24),
    ...INDEPENDENT_HOUSES.map((h) => new THREE.Vector3(h.x, 0, h.z + h.d * 0.5 + 3)),
    new THREE.Vector3(-12, 0, -11),
    new THREE.Vector3(14, 0, -11),
    new THREE.Vector3(0, 0, 12.5),
    new THREE.Vector3(-14, 4.2, -10),
    new THREE.Vector3(14, 4.2, 6),
    new THREE.Vector3(45, 0, -45),
    new THREE.Vector3(-55, 0, 52),
    new THREE.Vector3(90, 0, -48),
    new THREE.Vector3(-92, 0, 48),
    new THREE.Vector3(0, 0, -80),
    new THREE.Vector3(0, 0, 80),
  ];

  // Walkable floor, terrain hills & Villa staircase height evaluation
  const groundHeightAt = (x: number, z: number, currentY: number): number => {
    // Central Villa footprint & staircase
    if (x >= -2.35 && x <= 2.35) {
      if (z >= -6.5 && z <= -1.0) {
        const t = (z - -6.5) / 5.5;
        const rampY = t * 2.1;
        if (currentY <= 2.9) return rampY;
      }
      if (z > -1.0 && z <= 1.5) {
        if (currentY >= 1.1) return 2.1;
      }
      if (z > 1.5 && z <= 6.8) {
        const t = (z - 1.5) / 5.3;
        const rampY = 2.1 + t * 2.1;
        if (currentY >= 1.1) return rampY;
      }
    }

    // Villa 2nd floor slabs (y = 4.2)
    if (currentY >= 3.1 && currentY <= 6.2 && x >= -18 && x <= 18 && z >= -14 && z <= 10) {
      const inStairHole = x > -2.6 && x < 2.6 && z > -7.0 && z < 6.8;
      if (!inStairHole) {
        return 4.2;
      }
    }

    // Swimming pool dip
    if (x > -8.4 && x < 8.4 && z > 15.6 && z < 24.4) {
      return -0.35;
    }

    // Inside central courtyard/villa keep y=0
    if (Math.hypot(x, z) < 46) return 0;

    return islandTerrainHeightAt(x, z);
  };

  const roomNameAt = (x: number, y: number, z: number): { floor: 1 | 2; name: string } => {
    if (y >= 16) {
      return { floor: 2, name: `Gökyüzü · ${Math.round(y)}m İrtifa` };
    }

    if (y >= 3.2 && x >= -18 && x <= 18 && z >= -14 && z <= 10) {
      if (x < -6) return { floor: 2, name: 'Merkez Villa · 2. Kat Geniş Teras' };
      if (x > 6) return { floor: 2, name: 'Merkez Villa · 2. Kat VIP Yatak Odası' };
      return { floor: 2, name: 'Merkez Villa · 2. Kat Asma Balkon' };
    }

    if (x >= -18 && x <= 18 && z >= -14 && z <= 10) {
      if (x < -6 && z < -1) return { floor: 1, name: 'Merkez Villa · Oturma Odası' };
      if (x < -6 && z >= -1) return { floor: 1, name: 'Merkez Villa · Misafir Odası' };
      if (x > 6) return { floor: 1, name: 'Merkez Villa · Mutfak & Yemek' };
      if (x >= -2.6 && x <= 2.6 && z >= -6.5 && z <= 6.8) {
        return { floor: 1, name: 'Merkez Villa · Orta Merdiven' };
      }
      return { floor: 1, name: 'Merkez Villa · Geniş Lobi' };
    }

    if (z > 10 && z <= 31 && x >= -22 && x <= 22) {
      if (x > -8.6 && x < 8.6 && z > 15.4 && z < 24.6) {
        return { floor: 1, name: 'Merkez Villa · Yüzme Havuzu' };
      }
      return { floor: 1, name: 'Merkez Villa · Havuz Güvertesi' };
    }

    if (Math.hypot(x, z) <= 36) {
      return { floor: 1, name: 'Merkez Villa Bahçesi' };
    }

    for (const h of INDEPENDENT_HOUSES) {
      if (Math.abs(x - h.x) <= h.w * 0.65 && Math.abs(z - h.z) <= h.d * 0.65) {
        return { floor: 1, name: h.name };
      }
    }

    if (Math.abs(x) < 6 || Math.abs(z) < 6 || Math.abs(Math.hypot(x, z) - 154) < 6) {
      return { floor: 1, name: 'Ada Asfalt Yolu' };
    }

    if (z < -60) return { floor: 1, name: 'Kuzey Tepeleri · Açık Arena' };
    if (z > 60) return { floor: 1, name: 'Güney Vadisi · Açık Arena' };
    if (x < -60) return { floor: 1, name: 'Batı Ormanı · Açık Arena' };
    return { floor: 1, name: 'Doğu Sahili · Açık Arena' };
  };

  const houses: HouseFootprint[] = INDEPENDENT_HOUSES.map((h) => ({
    x: h.x,
    z: h.z,
    w: h.w,
    d: h.d,
    name: h.name,
  }));

  return {
    group,
    solidColliders,
    bulletBlockers,
    glassPanes,
    crates,
    waypoints,
    spawnPoints,
    houses,
    vehicleSpawns: VEHICLE_SPAWNS,
    poolWaterMesh,
    groundHeightAt,
    roomNameAt,
  };
}
