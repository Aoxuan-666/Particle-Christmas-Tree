import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { MathUtils } from 'three';
import { CONFIG } from '../config';
import type { SceneState, ThemePalette } from '../config';

const GOLDEN_ANGLE = 2.399963229728653;

// Module-level scratch objects reused across frames to guarantee zero per-frame allocations.
const _lightDummy = new THREE.Object3D();
const _lightColor = new THREE.Color();
const _elemDummy = new THREE.Object3D();
const _elemColor = new THREE.Color();
const _lookTarget = new THREE.Vector3();
const _camForward = new THREE.Vector3();
const _worldFocusPos = new THREE.Vector3();
const _localFocusPos = new THREE.Vector3();
const _tmpWorld = new THREE.Vector3();
const _toPhoto = new THREE.Vector3();
const _parentWorldQuat = new THREE.Quaternion();
const _targetLocalQuat = new THREE.Quaternion();

function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface FairyLightItem {
  chaosPos: THREE.Vector3;
  targetPos: THREE.Vector3;
  currentPos: THREE.Vector3;
  colorIndex: number;
  speed: number;
  timeOffset: number;
}

interface ElementItem {
  chaosPos: THREE.Vector3;
  targetPos: THREE.Vector3;
  currentPos: THREE.Vector3;
  rotation: THREE.Euler;
  rotationSpeed: { x: number; y: number; z: number };
  scale: number;
  colorIndex: number;
}

interface PhotoOrnamentItem {
  chaosPos: THREE.Vector3;
  targetPos: THREE.Vector3;
  currentPos: THREE.Vector3;
  chaosRotation: THREE.Euler;
  rotationSpeed: { x: number; y: number; z: number };
  scale: number;
  currentScale: number;
  weight: number;
  textureIndex: number;
  wobbleOffset: number;
  wobbleSpeed: number;
}

function updateElementInstances(
  mesh: THREE.InstancedMesh | null,
  items: ElementItem[],
  isFormed: boolean,
  lerpAlpha: number,
  dt: number
): void {
  if (!mesh) return;
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const target = isFormed ? item.targetPos : item.chaosPos;
    item.currentPos.lerp(target, lerpAlpha);
    item.rotation.x += dt * item.rotationSpeed.x;
    item.rotation.y += dt * item.rotationSpeed.y;
    item.rotation.z += dt * item.rotationSpeed.z;

    _elemDummy.position.copy(item.currentPos);
    _elemDummy.rotation.copy(item.rotation);
    _elemDummy.scale.setScalar(item.scale);
    _elemDummy.updateMatrix();
    mesh.setMatrixAt(i, _elemDummy.matrix);
  }
  mesh.instanceMatrix.needsUpdate = true;
}

function initElementMatrices(
  mesh: THREE.InstancedMesh | null,
  items: ElementItem[]
): void {
  if (!mesh) return;
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    _elemDummy.position.copy(item.currentPos);
    _elemDummy.rotation.copy(item.rotation);
    _elemDummy.scale.setScalar(item.scale);
    _elemDummy.updateMatrix();
    mesh.setMatrixAt(i, _elemDummy.matrix);
  }
  mesh.instanceMatrix.needsUpdate = true;
}

function applyElementColors(
  mesh: THREE.InstancedMesh | null,
  items: ElementItem[],
  palette: readonly string[]
): void {
  if (!mesh || palette.length === 0) return;
  for (let i = 0; i < items.length; i++) {
    const hex = palette[items[i].colorIndex % palette.length];
    _elemColor.set(hex);
    mesh.setColorAt(i, _elemColor);
  }
  if (mesh.instanceColor) {
    mesh.instanceColor.needsUpdate = true;
  }
}

export const FairyLights = ({
  state,
  theme,
}: {
  state: SceneState;
  theme: ThemePalette;
}) => {
  const count = CONFIG.counts.lights;
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const formedMixRef = useRef(state === 'FORMED' ? 1 : 0);

  const data = useMemo<FairyLightItem[]>(() => {
    const rand = createSeededRandom(1024);
    const h = CONFIG.tree.height;
    const rBase = CONFIG.tree.radius;
    const items: FairyLightItem[] = [];

    for (let i = 0; i < count; i++) {
      const chaosPos = new THREE.Vector3(
        (rand() - 0.5) * 60,
        (rand() - 0.5) * 60,
        (rand() - 0.5) * 60
      );
      const normalizedY = 1 - Math.sqrt(rand());
      const y = normalizedY * h - h / 2;
      const currentRadius = rBase * (1 - normalizedY) + 0.35;
      const theta = i * GOLDEN_ANGLE + (rand() - 0.5) * 0.55;
      const targetPos = new THREE.Vector3(
        currentRadius * Math.cos(theta),
        y,
        currentRadius * Math.sin(theta)
      );

      items.push({
        chaosPos,
        targetPos,
        currentPos: chaosPos.clone(),
        colorIndex: i,
        speed: 2 + rand() * 3,
        timeOffset: rand() * 100,
      });
    }
    return items;
  }, [count]);

  const paletteColors = useMemo(() => {
    const source = theme.lights.length > 0 ? theme.lights : ['#ffd700'];
    return source.map((hex) => new THREE.Color(hex));
  }, [theme.lights]);

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    for (let i = 0; i < data.length; i++) {
      _lightDummy.position.copy(data[i].currentPos);
      _lightDummy.scale.setScalar(0.85);
      _lightDummy.updateMatrix();
      mesh.setMatrixAt(i, _lightDummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }, [data]);

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    for (let i = 0; i < data.length; i++) {
      const baseColor = paletteColors[data[i].colorIndex % paletteColors.length];
      _lightColor.copy(baseColor).multiplyScalar(1.4);
      mesh.setColorAt(i, _lightColor);
    }
    if (mesh.instanceColor) {
      mesh.instanceColor.needsUpdate = true;
    }
  }, [data, paletteColors]);

  useFrame((rootState, delta) => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const dt = Math.min(delta, 0.05);
    const lerpAlpha = Math.min(dt * 2.0, 1);
    const isFormed = state === 'FORMED';
    const time = rootState.clock.elapsedTime;

    formedMixRef.current = MathUtils.damp(
      formedMixRef.current,
      isFormed ? 1 : 0,
      2.2,
      dt
    );
    const formedMix = formedMixRef.current;

    for (let i = 0; i < data.length; i++) {
      const item = data[i];
      item.currentPos.lerp(isFormed ? item.targetPos : item.chaosPos, lerpAlpha);

      const twinkle = (Math.sin(time * item.speed + item.timeOffset) + 1) * 0.5;
      const bulbScale = (0.72 + twinkle * 0.55) * (0.85 + 0.15 * formedMix);

      _lightDummy.position.copy(item.currentPos);
      _lightDummy.scale.setScalar(bulbScale);
      _lightDummy.updateMatrix();
      mesh.setMatrixAt(i, _lightDummy.matrix);

      const brightness = MathUtils.lerp(
        0.65 + twinkle * 0.45,
        1.4 + twinkle * 3.2,
        formedMix
      );
      const baseColor = paletteColors[item.colorIndex % paletteColors.length];
      _lightColor.copy(baseColor).multiplyScalar(brightness);
      mesh.setColorAt(i, _lightColor);
    }

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) {
      mesh.instanceColor.needsUpdate = true;
    }
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, count]}
      frustumCulled={false}
    >
      <sphereGeometry args={[0.13, 10, 10]} />
      <meshBasicMaterial color="#ffffff" toneMapped={false} />
    </instancedMesh>
  );
};

export const ChristmasElements = ({
  state,
  theme,
}: {
  state: SceneState;
  theme: ThemePalette;
}) => {
  const boxMeshRef = useRef<THREE.InstancedMesh>(null);
  const sphereMeshRef = useRef<THREE.InstancedMesh>(null);
  const caneMeshRef = useRef<THREE.InstancedMesh>(null);

  const { boxes, spheres, canes } = useMemo(() => {
    const rand = createSeededRandom(2048);
    const total = CONFIG.counts.elements;
    const h = CONFIG.tree.height;
    const rBase = CONFIG.tree.radius;

    const boxItems: ElementItem[] = [];
    const sphereItems: ElementItem[] = [];
    const caneItems: ElementItem[] = [];

    for (let i = 0; i < total; i++) {
      const chaosPos = new THREE.Vector3(
        (rand() - 0.5) * 60,
        (rand() - 0.5) * 60,
        (rand() - 0.5) * 60
      );
      const normalizedY = 1 - Math.sqrt(0.002 + 0.998 * rand());
      const y = normalizedY * h - h / 2;
      const currentRadius = rBase * (1 - normalizedY) * 0.92 + 0.15;
      const theta = i * GOLDEN_ANGLE + (rand() - 0.5) * 0.6;
      const targetPos = new THREE.Vector3(
        currentRadius * Math.cos(theta),
        y,
        currentRadius * Math.sin(theta)
      );

      const rotation = new THREE.Euler(
        rand() * Math.PI,
        rand() * Math.PI,
        rand() * Math.PI
      );
      const rotationSpeed = {
        x: (rand() - 0.5) * 2.0,
        y: (rand() - 0.5) * 2.0,
        z: (rand() - 0.5) * 2.0,
      };

      const type = i % 3;
      if (type === 0) {
        boxItems.push({
          chaosPos,
          targetPos,
          currentPos: chaosPos.clone(),
          rotation,
          rotationSpeed,
          scale: 0.8 + rand() * 0.4,
          colorIndex: boxItems.length,
        });
      } else if (type === 1) {
        sphereItems.push({
          chaosPos,
          targetPos,
          currentPos: chaosPos.clone(),
          rotation,
          rotationSpeed,
          scale: 0.6 + rand() * 0.4,
          colorIndex: sphereItems.length,
        });
      } else {
        caneItems.push({
          chaosPos,
          targetPos,
          currentPos: chaosPos.clone(),
          rotation,
          rotationSpeed,
          scale: 0.7 + rand() * 0.3,
          colorIndex: caneItems.length,
        });
      }
    }

    return { boxes: boxItems, spheres: sphereItems, canes: caneItems };
  }, []);

  useLayoutEffect(() => {
    initElementMatrices(boxMeshRef.current, boxes);
    initElementMatrices(sphereMeshRef.current, spheres);
    initElementMatrices(caneMeshRef.current, canes);
  }, [boxes, spheres, canes]);

  useLayoutEffect(() => {
    applyElementColors(boxMeshRef.current, boxes, theme.giftColors);
    applyElementColors(sphereMeshRef.current, spheres, theme.giftColors);
    applyElementColors(caneMeshRef.current, canes, theme.candyColors);
  }, [boxes, spheres, canes, theme.giftColors, theme.candyColors]);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const lerpAlpha = Math.min(dt * 1.5, 1);
    const isFormed = state === 'FORMED';

    updateElementInstances(boxMeshRef.current, boxes, isFormed, lerpAlpha, dt);
    updateElementInstances(
      sphereMeshRef.current,
      spheres,
      isFormed,
      lerpAlpha,
      dt
    );
    updateElementInstances(caneMeshRef.current, canes, isFormed, lerpAlpha, dt);
  });

  return (
    <group>
      <instancedMesh
        ref={boxMeshRef}
        args={[undefined, undefined, boxes.length]}
        frustumCulled={false}
      >
        <boxGeometry args={[0.8, 0.8, 0.8]} />
        <meshStandardMaterial color="#ffffff" roughness={0.32} metalness={0.22} />
      </instancedMesh>
      <instancedMesh
        ref={sphereMeshRef}
        args={[undefined, undefined, spheres.length]}
        frustumCulled={false}
      >
        <sphereGeometry args={[0.5, 16, 16]} />
        <meshStandardMaterial color="#ffffff" roughness={0.18} metalness={0.45} />
      </instancedMesh>
      <instancedMesh
        ref={caneMeshRef}
        args={[undefined, undefined, canes.length]}
        frustumCulled={false}
      >
        <cylinderGeometry args={[0.15, 0.15, 1.2, 10]} />
        <meshStandardMaterial color="#ffffff" roughness={0.24} metalness={0.16} />
      </instancedMesh>
    </group>
  );
};

export const PhotoOrnaments = ({
  state,
  theme,
  visible,
  isPinching,
}: {
  state: SceneState;
  theme: ThemePalette;
  visible: boolean;
  isPinching: boolean;
}) => {
  const photoUrls = useMemo(() => [...CONFIG.photos.body], []);
  const textures = useTexture(photoUrls);
  const count = CONFIG.counts.ornaments;
  const groupRef = useRef<THREE.Group>(null);
  const [pluckedIndex, setPluckedIndex] = useState<number | null>(null);
  const pluckedIndexRef = useRef<number | null>(null);
  const prevPinchingRef = useRef(false);
  const recentTexturesRef = useRef<number[]>([]);
  const lastPluckedIdxRef = useRef(-1);

  const photoGeometry = useMemo(() => new THREE.PlaneGeometry(1, 1), []);

  // Polaroid cutout frame (1.2 x 1.5 outer with 0.99 x 0.99 center window) so both faces stay unoccluded.
  const borderGeometry = useMemo(() => {
    const outer = new THREE.Shape();
    outer.moveTo(-0.6, -0.9);
    outer.lineTo(0.6, -0.9);
    outer.lineTo(0.6, 0.6);
    outer.lineTo(-0.6, 0.6);
    outer.closePath();

    const hole = new THREE.Path();
    hole.moveTo(-0.495, -0.495);
    hole.lineTo(-0.495, 0.495);
    hole.lineTo(0.495, 0.495);
    hole.lineTo(0.495, -0.495);
    hole.closePath();
    outer.holes.push(hole);

    return new THREE.ShapeGeometry(outer);
  }, []);

  useEffect(() => {
    return () => {
      photoGeometry.dispose();
      borderGeometry.dispose();
    };
  }, [photoGeometry, borderGeometry]);

  useLayoutEffect(() => {
    for (let i = 0; i < textures.length; i++) {
      const tex = textures[i];
      if (tex.colorSpace !== THREE.SRGBColorSpace) {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.needsUpdate = true;
      }
    }
  }, [textures]);

  const photoMaterials = useMemo(() => {
    return textures.map(
      (tex) =>
        new THREE.MeshStandardMaterial({
          map: tex,
          roughness: 0.55,
          metalness: 0,
          emissive: '#ffffff',
          emissiveMap: tex,
          emissiveIntensity: 0.32,
          toneMapped: true,
          side: THREE.DoubleSide,
        })
    );
  }, [textures]);

  useEffect(() => {
    return () => {
      photoMaterials.forEach((mat) => mat.dispose());
    };
  }, [photoMaterials]);

  const borderMaterials = useMemo(() => {
    const palette = theme.borders.length > 0 ? theme.borders : ['#fffaf0'];
    return palette.map(
      (hex) =>
        new THREE.MeshStandardMaterial({
          color: hex,
          roughness: 0.85,
          metalness: 0,
          side: THREE.DoubleSide,
        })
    );
  }, [theme.borders]);

  useEffect(() => {
    return () => {
      borderMaterials.forEach((mat) => mat.dispose());
    };
  }, [borderMaterials]);

  const pluckedBorderMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: theme.star,
        emissive: theme.star,
        emissiveIntensity: 0.72,
        roughness: 0.22,
        metalness: 0.85,
        side: THREE.DoubleSide,
      }),
    [theme.star]
  );

  useEffect(() => {
    return () => {
      pluckedBorderMaterial.dispose();
    };
  }, [pluckedBorderMaterial]);

  const data = useMemo<PhotoOrnamentItem[]>(() => {
    const rand = createSeededRandom(4096);
    const h = CONFIG.tree.height;
    const rBase = CONFIG.tree.radius;
    const textureCount = Math.max(1, textures.length);
    const items: PhotoOrnamentItem[] = [];

    for (let i = 0; i < count; i++) {
      const chaosPos = new THREE.Vector3(
        (rand() - 0.5) * 70,
        (rand() - 0.5) * 70,
        (rand() - 0.5) * 70
      );
      const normalizedY = 1 - Math.sqrt(0.003 + 0.997 * rand());
      const y = normalizedY * h - h / 2;
      const currentRadius = rBase * (1 - normalizedY) + 0.55;
      const theta = i * GOLDEN_ANGLE + (rand() - 0.5) * 0.55;
      const targetPos = new THREE.Vector3(
        currentRadius * Math.cos(theta),
        y,
        currentRadius * Math.sin(theta)
      );

      const isBig = rand() < 0.2;
      const scale = isBig ? 2.15 : 0.85 + rand() * 0.55;
      const weight = 0.8 + rand() * 1.2;

      items.push({
        chaosPos,
        targetPos,
        currentPos: chaosPos.clone(),
        chaosRotation: new THREE.Euler(
          rand() * Math.PI,
          rand() * Math.PI,
          rand() * Math.PI
        ),
        rotationSpeed: {
          x: (rand() - 0.5) * 1.0,
          y: (rand() - 0.5) * 1.0,
          z: (rand() - 0.5) * 1.0,
        },
        scale,
        currentScale: scale,
        weight,
        textureIndex: i % textureCount,
        wobbleOffset: rand() * 10,
        wobbleSpeed: 0.5 + rand() * 0.5,
      });
    }

    return items;
  }, [textures.length, count]);

  useLayoutEffect(() => {
    const root = groupRef.current;
    if (!root) return;
    const children = root.children;
    for (let i = 0; i < children.length; i++) {
      const item = data[i];
      if (!item) continue;
      children[i].position.copy(item.currentPos);
      children[i].rotation.copy(item.chaosRotation);
      children[i].scale.setScalar(item.currentScale);
    }
  }, [data]);

  useFrame((rootState, delta) => {
    const root = groupRef.current;
    if (!root) return;

    const activePinch = isPinching && visible;
    const camera = rootState.camera;

    if (activePinch) {
      camera.getWorldDirection(_camForward);
    }

    if (activePinch && !prevPinchingRef.current) {
      let bestFreshIdx = -1;
      let bestFreshScore = -Infinity;
      let bestAnyIdx = -1;
      let bestAnyScore = -Infinity;
      const recent = recentTexturesRef.current;
      const maxRecent = textures.length > 1 ? Math.min(8, textures.length - 1) : 0;

      for (let i = 0; i < data.length; i++) {
        const item = data[i];
        _tmpWorld.copy(item.currentPos);
        root.localToWorld(_tmpWorld);
        const dist = _tmpWorld.distanceTo(camera.position);
        _toPhoto.subVectors(_tmpWorld, camera.position).normalize();
        const dot = _toPhoto.dot(_camForward);
        const score = dot * 10 - dist * 0.06 + (dot > 0.65 ? 2 : 0);

        if (score > bestAnyScore) {
          bestAnyScore = score;
          bestAnyIdx = i;
        }
        if (
          maxRecent > 0 &&
          !recent.includes(item.textureIndex) &&
          score > bestFreshScore
        ) {
          bestFreshScore = score;
          bestFreshIdx = i;
        }
      }

      const fallbackIdx =
        data.length > 0 ? (lastPluckedIdxRef.current + 1) % data.length : 0;
      const chosenIdx =
        bestFreshIdx >= 0
          ? bestFreshIdx
          : bestAnyIdx >= 0
            ? bestAnyIdx
            : fallbackIdx;

      if (data[chosenIdx]) {
        pluckedIndexRef.current = chosenIdx;
        lastPluckedIdxRef.current = chosenIdx;
        if (maxRecent > 0) {
          recent.push(data[chosenIdx].textureIndex);
          while (recent.length > maxRecent) {
            recent.shift();
          }
        }
        setPluckedIndex(chosenIdx);
      }
    } else if (!activePinch && prevPinchingRef.current) {
      pluckedIndexRef.current = null;
      setPluckedIndex(null);
    }
    prevPinchingRef.current = activePinch;

    if (!visible) return;

    const dt = Math.min(delta, 0.05);
    const isFormed = state === 'FORMED';
    const time = rootState.clock.elapsedTime;
    const children = root.children;
    const activePlucked = pluckedIndexRef.current;

    if (activePlucked !== null) {
      camera.getWorldDirection(_camForward);
      _worldFocusPos
        .copy(camera.position)
        .addScaledVector(_camForward, 18);
      _worldFocusPos.y += Math.sin(time * 2.2) * 0.14;
      _localFocusPos.copy(_worldFocusPos);
      root.worldToLocal(_localFocusPos);

      root.getWorldQuaternion(_parentWorldQuat).invert();
      _targetLocalQuat.multiplyQuaternions(_parentWorldQuat, camera.quaternion);
    }

    const focusAlpha = 1 - Math.exp(-9 * dt);
    const returnAlpha = 1 - Math.exp(-5.5 * dt);

    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      const objData = data[i];
      if (!objData) continue;

      if (i === activePlucked) {
        objData.currentPos.lerp(_localFocusPos, focusAlpha);
        child.position.copy(objData.currentPos);
        child.quaternion.slerp(_targetLocalQuat, focusAlpha);
        objData.currentScale = MathUtils.damp(objData.currentScale, 5.4, 9, dt);
        child.scale.setScalar(objData.currentScale);
        child.renderOrder = 20;
      } else {
        const isReturning = objData.currentScale > objData.scale * 1.05;
        const target = isFormed ? objData.targetPos : objData.chaosPos;
        const lerpAlpha = isReturning
          ? returnAlpha
          : Math.min(dt * (isFormed ? 0.8 * objData.weight : 0.5), 1);
        objData.currentPos.lerp(target, lerpAlpha);
        child.position.copy(objData.currentPos);
        objData.currentScale = MathUtils.damp(
          objData.currentScale,
          objData.scale,
          7,
          dt
        );
        child.scale.setScalar(objData.currentScale);
        child.renderOrder = 0;

        if (isFormed) {
          _lookTarget.set(
            child.position.x * 2,
            child.position.y + 0.5,
            child.position.z * 2
          );
          child.lookAt(_lookTarget);

          const wobbleX =
            Math.sin(time * objData.wobbleSpeed + objData.wobbleOffset) * 0.05;
          const wobbleZ =
            Math.cos(time * objData.wobbleSpeed * 0.8 + objData.wobbleOffset) *
            0.05;
          child.rotation.x += wobbleX;
          child.rotation.z += wobbleZ;
        } else {
          child.rotation.x += dt * objData.rotationSpeed.x;
          child.rotation.y += dt * objData.rotationSpeed.y;
          child.rotation.z += dt * objData.rotationSpeed.z;
        }
      }
    }
  });

  return (
    <group ref={groupRef} visible={visible}>
      {data.map((obj, i) => (
        <group key={i}>
          <mesh
            geometry={photoGeometry}
            material={photoMaterials[obj.textureIndex]}
          />
          <mesh
            geometry={borderGeometry}
            material={
              pluckedIndex === i
                ? pluckedBorderMaterial
                : borderMaterials[i % borderMaterials.length]
            }
            position={[0, 0, -0.006]}
          />
        </group>
      ))}
    </group>
  );
};
