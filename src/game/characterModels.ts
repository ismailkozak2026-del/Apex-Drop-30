import * as THREE from 'three';

export interface CharacterModelRig {
  root: THREE.Group;
  bodyMesh: THREE.Mesh;
  headMesh: THREE.Mesh;
  leftLeg: THREE.Mesh;
  rightLeg: THREE.Mesh;
  weaponMount: THREE.Group;
  hitFlashMaterials: THREE.MeshStandardMaterial[];
}

const BOT_ARMOR_PALETTE = [
  0x334155,
  0x1e3a5f,
  0x4c1d95,
  0x7c2d12,
  0x065f46,
  0x3f3f46,
  0x701a75,
  0x1e293b,
];

const BOT_VISOR_PALETTE = [
  0x38bdf8,
  0xf59e0b,
  0xf43f5e,
  0x22d3ee,
  0xa3e635,
  0xfb923c,
];

export function buildCharacterRig(seedIndex: number): CharacterModelRig {
  const root = new THREE.Group();
  const armorColor = BOT_ARMOR_PALETTE[seedIndex % BOT_ARMOR_PALETTE.length];
  const visorColor = BOT_VISOR_PALETTE[seedIndex % BOT_VISOR_PALETTE.length];

  const armorMat = new THREE.MeshStandardMaterial({
    color: armorColor,
    roughness: 0.48,
    metalness: 0.35,
  });
  const darkFabricMat = new THREE.MeshStandardMaterial({
    color: 0x111827,
    roughness: 0.85,
    metalness: 0.08,
  });
  const helmetMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.35,
    metalness: 0.55,
  });
  const visorMat = new THREE.MeshStandardMaterial({
    color: visorColor,
    roughness: 0.15,
    metalness: 0.8,
    emissive: visorColor,
    emissiveIntensity: 0.45,
  });

  // Legs (grounded at y = 0)
  const legGeo = new THREE.BoxGeometry(0.18, 0.78, 0.2);
  const leftLeg = new THREE.Mesh(legGeo, darkFabricMat);
  leftLeg.position.set(-0.14, 0.39, 0);
  leftLeg.castShadow = true;
  root.add(leftLeg);

  const rightLeg = new THREE.Mesh(legGeo, darkFabricMat);
  rightLeg.position.set(0.14, 0.39, 0);
  rightLeg.castShadow = true;
  root.add(rightLeg);

  // Torso (primary body hitbox)
  const bodyMesh = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.66, 0.28), armorMat);
  bodyMesh.position.set(0, 1.11, 0);
  bodyMesh.castShadow = true;
  bodyMesh.receiveShadow = true;
  root.add(bodyMesh);

  // Chest tactical rig plate
  const chestPlate = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.36, 0.32), darkFabricMat);
  chestPlate.position.set(0, 1.15, 0);
  root.add(chestPlate);

  // Shoulder pads
  const padGeo = new THREE.BoxGeometry(0.14, 0.16, 0.24);
  const leftPad = new THREE.Mesh(padGeo, armorMat);
  leftPad.position.set(-0.32, 1.34, 0);
  root.add(leftPad);

  const rightPad = new THREE.Mesh(padGeo, armorMat);
  rightPad.position.set(0.32, 1.34, 0);
  root.add(rightPad);

  // Arms
  const armGeo = new THREE.BoxGeometry(0.14, 0.48, 0.14);
  const leftArm = new THREE.Mesh(armGeo, darkFabricMat);
  leftArm.position.set(-0.31, 1.08, -0.12);
  leftArm.rotation.x = 0.65;
  root.add(leftArm);

  const rightArm = new THREE.Mesh(armGeo, darkFabricMat);
  rightArm.position.set(0.31, 1.08, -0.14);
  rightArm.rotation.x = 0.75;
  root.add(rightArm);

  // Head + Helmet (headshot hitbox!)
  const headMesh = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.32, 0.3), helmetMat);
  headMesh.position.set(0, 1.62, 0);
  headMesh.castShadow = true;
  root.add(headMesh);

  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.1, 0.05), visorMat);
  visor.position.set(0, 1.64, -0.145);
  root.add(visor);

  // Weapon mount
  const weaponMount = new THREE.Group();
  weaponMount.position.set(0.24, 1.14, -0.22);
  root.add(weaponMount);

  return {
    root,
    bodyMesh,
    headMesh,
    leftLeg,
    rightLeg,
    weaponMount,
    hitFlashMaterials: [armorMat, helmetMat],
  };
}
