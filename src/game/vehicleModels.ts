import * as THREE from 'three';

export type VehicleStyle = 'sport' | 'sedan' | 'offroad';

export interface VehicleRig {
  root: THREE.Group;
  bodyMesh: THREE.Mesh;
  wheels: THREE.Mesh[];
  frontSteerPivots: THREE.Group[];
  headlights: THREE.Mesh[];
}

export interface TransportPlaneRig {
  root: THREE.Group;
  propellers: THREE.Group[];
}

export interface GrenadeMeshRig {
  root: THREE.Group;
  ledMesh: THREE.Mesh;
}

const _tireMat = new THREE.MeshStandardMaterial({
  color: 0x18181b,
  roughness: 0.85,
  metalness: 0.1,
});

const _rimMat = new THREE.MeshStandardMaterial({
  color: 0xd4d4d8,
  roughness: 0.25,
  metalness: 0.85,
});

const _glassMat = new THREE.MeshPhysicalMaterial({
  color: 0x0f172a,
  roughness: 0.08,
  metalness: 0.25,
  clearcoat: 1.0,
});

const _chassisMat = new THREE.MeshStandardMaterial({
  color: 0x1e293b,
  roughness: 0.72,
  metalness: 0.45,
});

const _headlightMat = new THREE.MeshStandardMaterial({
  color: 0xfef08a,
  emissive: 0xfef08a,
  emissiveIntensity: 0.85,
  roughness: 0.2,
});

const _taillightMat = new THREE.MeshStandardMaterial({
  color: 0xef4444,
  emissive: 0xef4444,
  emissiveIntensity: 0.75,
  roughness: 0.2,
});

export function buildVehicleRig(colorHex: number, style: VehicleStyle): VehicleRig {
  const root = new THREE.Group();

  const paintMat = new THREE.MeshPhysicalMaterial({
    color: colorHex,
    roughness: 0.22,
    metalness: 0.65,
    clearcoat: 0.9,
    clearcoatRoughness: 0.12,
  });

  const isOffroad = style === 'offroad';
  const isSport = style === 'sport';
  const bodyW = isOffroad ? 2.25 : 2.05;
  const bodyL = isOffroad ? 4.65 : 4.45;
  const clearance = isOffroad ? 0.56 : 0.4;

  // Underbody chassis
  const underbody = new THREE.Mesh(
    new THREE.BoxGeometry(bodyW - 0.12, 0.22, bodyL - 0.2),
    _chassisMat
  );
  underbody.position.set(0, clearance, 0);
  root.add(underbody);

  // Primary body hull
  const bodyH = isOffroad ? 0.82 : isSport ? 0.62 : 0.72;
  const bodyMesh = new THREE.Mesh(
    new THREE.BoxGeometry(bodyW, bodyH, bodyL),
    paintMat
  );
  bodyMesh.position.set(0, clearance + bodyH / 2 + 0.04, 0);
  bodyMesh.castShadow = true;
  bodyMesh.receiveShadow = true;
  root.add(bodyMesh);

  // Cabin upper structure
  const cabinH = isOffroad ? 0.68 : isSport ? 0.48 : 0.58;
  const cabinL = isOffroad ? 2.6 : isSport ? 1.95 : 2.3;
  const cabinZ = isSport ? 0.18 : 0.05;
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(bodyW - 0.24, cabinH, cabinL),
    paintMat
  );
  cabin.position.set(0, clearance + bodyH + cabinH / 2, cabinZ);
  cabin.castShadow = true;
  root.add(cabin);

  // Windshield & rear glass
  const glassStrip = new THREE.Mesh(
    new THREE.BoxGeometry(bodyW - 0.28, cabinH * 0.72, cabinL + 0.06),
    _glassMat
  );
  glassStrip.position.set(0, clearance + bodyH + cabinH * 0.48, cabinZ);
  root.add(glassStrip);

  // Side glass
  const sideGlass = new THREE.Mesh(
    new THREE.BoxGeometry(bodyW - 0.18, cabinH * 0.68, cabinL - 0.35),
    _glassMat
  );
  sideGlass.position.set(0, clearance + bodyH + cabinH * 0.48, cabinZ);
  root.add(sideGlass);

  // Sport rear wing OR Offroad roof rack
  if (isSport) {
    const wing = new THREE.Mesh(
      new THREE.BoxGeometry(bodyW - 0.1, 0.08, 0.34),
      _chassisMat
    );
    wing.position.set(0, clearance + bodyH + 0.26, bodyL / 2 - 0.22);
    root.add(wing);
  } else if (isOffroad) {
    const rack = new THREE.Mesh(
      new THREE.BoxGeometry(bodyW - 0.4, 0.1, cabinL - 0.3),
      _chassisMat
    );
    rack.position.set(0, clearance + bodyH + cabinH + 0.06, cabinZ);
    root.add(rack);
  }

  // Front grille + bumpers
  const frontBumper = new THREE.Mesh(
    new THREE.BoxGeometry(bodyW + 0.04, 0.24, 0.18),
    _chassisMat
  );
  frontBumper.position.set(0, clearance + 0.12, -bodyL / 2 - 0.04);
  root.add(frontBumper);

  const rearBumper = new THREE.Mesh(
    new THREE.BoxGeometry(bodyW + 0.04, 0.24, 0.18),
    _chassisMat
  );
  rearBumper.position.set(0, clearance + 0.12, bodyL / 2 + 0.04);
  root.add(rearBumper);

  // Headlights (-Z forward) & Taillights (+Z rear)
  const headlights: THREE.Mesh[] = [];
  for (const sx of [-1, 1]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.16, 0.08), _headlightMat);
    hl.position.set(sx * (bodyW * 0.33), clearance + bodyH * 0.56, -bodyL / 2 - 0.02);
    root.add(hl);
    headlights.push(hl);

    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.14, 0.08), _taillightMat);
    tl.position.set(sx * (bodyW * 0.33), clearance + bodyH * 0.6, bodyL / 2 + 0.02);
    root.add(tl);
  }

  // 4 Wheels grounded at y = 0
  const wheelR = isOffroad ? 0.45 : 0.38;
  const wheelW = isOffroad ? 0.32 : 0.26;
  const tireGeo = new THREE.CylinderGeometry(wheelR, wheelR, wheelW, 14);
  tireGeo.rotateZ(Math.PI / 2);
  const rimGeo = new THREE.CylinderGeometry(wheelR * 0.56, wheelR * 0.56, wheelW + 0.02, 10);
  rimGeo.rotateZ(Math.PI / 2);

  const wheels: THREE.Mesh[] = [];
  const frontSteerPivots: THREE.Group[] = [];
  const axleX = bodyW * 0.48;
  const frontZ = -bodyL * 0.32;
  const rearZ = bodyL * 0.32;

  const wheelCoords: Array<{ x: number; z: number; isFront: boolean }> = [
    { x: -axleX, z: frontZ, isFront: true },
    { x: axleX, z: frontZ, isFront: true },
    { x: -axleX, z: rearZ, isFront: false },
    { x: axleX, z: rearZ, isFront: false },
  ];

  for (const wc of wheelCoords) {
    const pivot = new THREE.Group();
    pivot.position.set(wc.x, wheelR, wc.z);
    const tire = new THREE.Mesh(tireGeo, _tireMat);
    tire.castShadow = true;
    const rim = new THREE.Mesh(rimGeo, _rimMat);
    tire.add(rim);
    pivot.add(tire);
    root.add(pivot);
    wheels.push(tire);
    if (wc.isFront) {
      frontSteerPivots.push(pivot);
    }
  }

  return { root, bodyMesh, wheels, frontSteerPivots, headlights };
}

export function buildTransportPlane(): TransportPlaneRig {
  const root = new THREE.Group();
  const hullMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.38,
    metalness: 0.65,
  });
  const stripeMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    roughness: 0.32,
    metalness: 0.4,
  });
  const cockpitMat = new THREE.MeshPhysicalMaterial({
    color: 0x38bdf8,
    roughness: 0.1,
    metalness: 0.2,
    emissive: 0x0284c7,
    emissiveIntensity: 0.35,
  });

  // Main cargo fuselage oriented along -Z forward
  const fuselage = new THREE.Mesh(
    new THREE.CylinderGeometry(1.9, 2.2, 18, 12),
    hullMat
  );
  fuselage.rotation.x = Math.PI / 2;
  root.add(fuselage);

  // Nose cone
  const nose = new THREE.Mesh(new THREE.ConeGeometry(1.9, 4.4, 12), hullMat);
  nose.rotation.x = -Math.PI / 2;
  nose.position.z = -11.2;
  root.add(nose);

  // Cockpit visor
  const visor = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.75, 1.8), cockpitMat);
  visor.position.set(0, 0.95, -9.2);
  root.add(visor);

  // Swept main wings
  const wing = new THREE.Mesh(new THREE.BoxGeometry(24, 0.38, 4.2), hullMat);
  wing.position.set(0, 1.15, -1.2);
  root.add(wing);

  // Amber tactical wing stripes
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(22.5, 0.42, 0.75), stripeMat);
  stripe.position.set(0, 1.18, -2.5);
  root.add(stripe);

  // Tail fin & horizontal stabilizers
  const tailFin = new THREE.Mesh(new THREE.BoxGeometry(0.42, 4.6, 3.2), stripeMat);
  tailFin.position.set(0, 3.2, 7.6);
  root.add(tailFin);

  const tailHoriz = new THREE.Mesh(new THREE.BoxGeometry(9.2, 0.28, 2.2), hullMat);
  tailHoriz.position.set(0, 1.6, 8.0);
  root.add(tailHoriz);

  // 4 Turboprop engines & spinning propellers
  const propellers: THREE.Group[] = [];
  const engineXs = [-8.2, -4.4, 4.4, 8.2];
  for (const ex of engineXs) {
    const nacelle = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 2.2, 8), _chassisMat);
    nacelle.rotation.x = Math.PI / 2;
    nacelle.position.set(ex, 0.9, -2.8);
    root.add(nacelle);

    const propGroup = new THREE.Group();
    propGroup.position.set(ex, 0.9, -4.0);
    const blade1 = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.16, 0.08), _rimMat);
    const blade2 = new THREE.Mesh(new THREE.BoxGeometry(0.16, 2.1, 0.08), _rimMat);
    propGroup.add(blade1, blade2);
    root.add(propGroup);
    propellers.push(propGroup);
  }

  // Open rear drop ramp beacon
  const rampGlow = new THREE.Mesh(
    new THREE.BoxGeometry(2.2, 1.2, 0.6),
    new THREE.MeshBasicMaterial({ color: 0x22d3ee })
  );
  rampGlow.position.set(0, -0.4, 9.1);
  root.add(rampGlow);

  return { root, propellers };
}

export function buildParachuteRig(): THREE.Group {
  const root = new THREE.Group();

  const canopyGeo = new THREE.SphereGeometry(2.3, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.48);
  canopyGeo.scale(1.25, 0.65, 0.9);
  const canopyMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    roughness: 0.65,
    side: THREE.DoubleSide,
  });
  const canopy = new THREE.Mesh(canopyGeo, canopyMat);
  canopy.position.y = 3.2;
  root.add(canopy);

  const trimCanopy = new THREE.Mesh(
    new THREE.BoxGeometry(4.8, 0.16, 0.55),
    new THREE.MeshStandardMaterial({ color: 0x06b6d4, roughness: 0.5 })
  );
  trimCanopy.position.y = 3.85;
  root.add(trimCanopy);

  const cordMat = new THREE.MeshBasicMaterial({ color: 0xe2e8f0 });
  const cordGeo = new THREE.CylinderGeometry(0.015, 0.015, 2.5, 4);
  for (const [cx, cz] of [
    [-1.4, -0.9],
    [1.4, -0.9],
    [-1.4, 0.9],
    [1.4, 0.9],
  ]) {
    const cord = new THREE.Mesh(cordGeo, cordMat);
    cord.position.set(cx * 0.55, 2.1, cz * 0.55);
    cord.lookAt(0, 1.0, 0);
    cord.rotateX(Math.PI / 2);
    root.add(cord);
  }

  return root;
}

export function buildGrenadeMesh(): GrenadeMeshRig {
  const root = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.DodecahedronGeometry(0.14, 0),
    new THREE.MeshStandardMaterial({
      color: 0x3f6212,
      roughness: 0.52,
      metalness: 0.45,
    })
  );
  root.add(body);

  const collar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.06, 0.08, 8),
    _rimMat
  );
  collar.position.y = 0.15;
  root.add(collar);

  const ledMesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.045, 6, 6),
    new THREE.MeshBasicMaterial({ color: 0xef4444 })
  );
  ledMesh.position.y = 0.2;
  root.add(ledMesh);

  return { root, ledMesh };
}
