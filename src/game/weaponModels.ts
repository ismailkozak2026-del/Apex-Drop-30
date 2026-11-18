import * as THREE from 'three';
import type { WeaponSpec } from '../shared/types';

/**
 * Builds an articulated 4-to-10-part procedural 3D weapon group for each of the 15 weapons.
 * Oriented along -Z (barrel forward) with grip at origin for crisp first-person & third-person mounting.
 */
export function buildWeaponMesh(weapon: WeaponSpec): {
  group: THREE.Group;
  muzzleOffset: THREE.Vector3;
  rotaryBarrels?: THREE.Group;
} {
  const group = new THREE.Group();
  const accentHex = new THREE.Color(weapon.accentColor);

  const gunmetal = new THREE.MeshStandardMaterial({
    color: 0x262b34,
    roughness: 0.32,
    metalness: 0.85,
  });
  const polymer = new THREE.MeshStandardMaterial({
    color: 0x16191f,
    roughness: 0.82,
    metalness: 0.12,
  });
  const accentMat = new THREE.MeshStandardMaterial({
    color: accentHex,
    roughness: 0.28,
    metalness: 0.72,
    emissive:
      weapon.category === 'energy' || weapon.id === 'rail-lance-xr'
        ? accentHex
        : new THREE.Color(0x000000),
    emissiveIntensity:
      weapon.category === 'energy' || weapon.id === 'rail-lance-xr' ? 0.85 : 0,
  });
  const steelMat = new THREE.MeshStandardMaterial({
    color: 0x64748b,
    roughness: 0.25,
    metalness: 0.92,
  });

  // 1. Grip
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.12, 0.055), polymer);
  grip.position.set(0, -0.07, 0.06);
  grip.rotation.x = 0.24;
  group.add(grip);

  let muzzleZ = -0.45;
  let rotaryBarrels: THREE.Group | undefined;

  if (weapon.category === 'pistol') {
    // Frame + slide + barrel + underbarrel rail + front sight
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.044, 0.045, 0.24), polymer);
    frame.position.set(0, -0.005, -0.03);
    group.add(frame);

    const slide = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.046, 0.26), gunmetal);
    slide.position.set(0, 0.03, -0.04);
    group.add(slide);

    const barrel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.012, 0.012, weapon.id === 'prowler-50' ? 0.16 : 0.09, 10),
      steelMat
    );
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.028, -0.2);
    group.add(barrel);

    const accentStrip = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.01, 0.14), accentMat);
    accentStrip.position.set(0, 0.018, -0.05);
    group.add(accentStrip);

    const sight = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.014, 0.015), accentMat);
    sight.position.set(0, 0.058, -0.15);
    group.add(sight);

    muzzleZ = weapon.id === 'prowler-50' ? -0.3 : -0.25;
  } else if (weapon.id === 'vulcan-rotary') {
    // Heavy rotary receiver + carry handle + ammo drum + 6 spinning barrels
    const housing = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.15, 0.34), gunmetal);
    housing.position.set(0, 0.02, -0.04);
    group.add(housing);

    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.24), polymer);
    handle.position.set(0, 0.13, -0.02);
    group.add(handle);

    const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.095, 0.14, 14), accentMat);
    drum.rotation.z = Math.PI / 2;
    drum.position.set(0.08, -0.08, -0.03);
    group.add(drum);

    rotaryBarrels = new THREE.Group();
    rotaryBarrels.position.set(0, 0.02, -0.44);
    for (let i = 0; i < 6; i++) {
      const ang = (i / 6) * Math.PI * 2;
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.52, 8), steelMat);
      b.rotation.x = Math.PI / 2;
      b.position.set(Math.cos(ang) * 0.036, Math.sin(ang) * 0.036, 0);
      rotaryBarrels.add(b);
    }
    const clampRing = new THREE.Mesh(new THREE.CylinderGeometry(0.056, 0.056, 0.03, 14), accentMat);
    clampRing.rotation.x = Math.PI / 2;
    clampRing.position.z = -0.18;
    rotaryBarrels.add(clampRing);
    group.add(rotaryBarrels);

    muzzleZ = -0.72;
  } else if (weapon.category === 'launcher') {
    // Shoulder tube + optic + flared exhaust + protruding warhead
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.058, 0.84, 14), gunmetal);
    tube.rotation.x = Math.PI / 2;
    tube.position.set(0, 0.04, -0.14);
    group.add(tube);

    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.062, 0.09, 14), accentMat);
    collar.rotation.x = Math.PI / 2;
    collar.position.set(0, 0.04, -0.52);
    group.add(collar);

    const warhead = new THREE.Mesh(new THREE.ConeGeometry(0.052, 0.16, 12), accentMat);
    warhead.rotation.x = -Math.PI / 2;
    warhead.position.set(0, 0.04, -0.64);
    group.add(warhead);

    const optic = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.055, 0.11), polymer);
    optic.position.set(0.05, 0.095, -0.12);
    group.add(optic);

    muzzleZ = -0.72;
  } else {
    // Rifles, SMGs, Shotguns, Snipers, LMGs, Energy Rifle
    const isSniper = weapon.category === 'sniper';
    const isSmg = weapon.category === 'smg';
    const isShotgun = weapon.category === 'shotgun';
    const isLmg = weapon.category === 'lmg';

    const bodyLen = isSmg ? 0.28 : isSniper ? 0.44 : 0.36;
    const barrelLen = isSmg ? 0.22 : isSniper ? 0.54 : isShotgun ? 0.42 : 0.36;

    const receiver = new THREE.Mesh(
      new THREE.BoxGeometry(0.058, 0.078, bodyLen),
      gunmetal
    );
    receiver.position.set(0, 0.02, -0.04);
    group.add(receiver);

    const stock = new THREE.Mesh(
      new THREE.BoxGeometry(0.044, 0.085, isSmg ? 0.14 : 0.22),
      polymer
    );
    stock.position.set(0, 0.005, 0.19);
    group.add(stock);

    const handguard = new THREE.Mesh(
      new THREE.BoxGeometry(0.054, 0.062, barrelLen * 0.55),
      polymer
    );
    handguard.position.set(0, 0.02, -0.22 - barrelLen * 0.18);
    group.add(handguard);

    const barrel = new THREE.Mesh(
      new THREE.CylinderGeometry(
        isShotgun ? 0.02 : 0.013,
        isShotgun ? 0.02 : 0.013,
        barrelLen,
        10
      ),
      steelMat
    );
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.026, -0.22 - barrelLen * 0.45);
    group.add(barrel);

    // Suppressor or Muzzle brake or Rail coil
    if (weapon.suppressed) {
      const supp = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.18, 12), polymer);
      supp.rotation.x = Math.PI / 2;
      supp.position.set(0, 0.026, -0.22 - barrelLen - 0.05);
      group.add(supp);
      muzzleZ = -0.22 - barrelLen - 0.14;
    } else if (weapon.category === 'energy' || weapon.id === 'rail-lance-xr') {
      const coil1 = new THREE.Mesh(new THREE.BoxGeometry(0.072, 0.042, 0.22), accentMat);
      coil1.position.set(0, 0.026, -0.44);
      group.add(coil1);
      muzzleZ = -0.22 - barrelLen;
    } else {
      const muzzle = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.032, 0.05), accentMat);
      muzzle.position.set(0, 0.026, -0.22 - barrelLen + 0.02);
      group.add(muzzle);
      muzzleZ = -0.22 - barrelLen;
    }

    // Magazine / Box Mag
    if (isLmg) {
      const boxMag = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.12, 0.13), accentMat);
      boxMag.position.set(0, -0.075, -0.1);
      group.add(boxMag);
    } else if (!isShotgun) {
      const mag = new THREE.Mesh(
        new THREE.BoxGeometry(0.032, isSmg ? 0.16 : 0.14, 0.055),
        accentMat
      );
      mag.position.set(0, -0.08, -0.1);
      mag.rotation.x = weapon.id === 'brimstone-ak9' ? -0.24 : -0.1;
      group.add(mag);
    } else {
      const underTube = new THREE.Mesh(
        new THREE.CylinderGeometry(0.016, 0.016, barrelLen * 0.82, 10),
        accentMat
      );
      underTube.rotation.x = Math.PI / 2;
      underTube.position.set(0, -0.005, -0.2 - barrelLen * 0.35);
      group.add(underTube);
    }

    // Optic / Scope
    if (isSniper) {
      const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.022, 0.26, 12), gunmetal);
      scope.rotation.x = Math.PI / 2;
      scope.position.set(0, 0.09, -0.08);
      group.add(scope);
      const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.023, 0.023, 0.015, 12), accentMat);
      lens.rotation.x = Math.PI / 2;
      lens.position.set(0, 0.09, -0.21);
      group.add(lens);
    } else {
      const holo = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.036, 0.07), polymer);
      holo.position.set(0, 0.076, -0.06);
      group.add(holo);
      const railAccent = new THREE.Mesh(new THREE.BoxGeometry(0.062, 0.012, 0.18), accentMat);
      railAccent.position.set(0, 0.055, -0.06);
      group.add(railAccent);
    }
  }

  return {
    group,
    muzzleOffset: new THREE.Vector3(0, 0.03, muzzleZ),
    rotaryBarrels,
  };
}
