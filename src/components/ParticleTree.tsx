import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Float } from '@react-three/drei';
import * as THREE from 'three';
import { MathUtils } from 'three';
import { CONFIG } from '../config';
import type { SceneState, ThemePalette } from '../config';

const _starScale = new THREE.Vector3();

function fillSpherePoint(out: Float32Array, index: number, radius: number): void {
  const u = Math.random() * 2 - 1;
  const theta = Math.random() * Math.PI * 2;
  const sinPhi = Math.sqrt(Math.max(0, 1 - u * u));
  const r = radius * Math.cbrt(Math.random());
  const offset = index * 3;
  out[offset] = r * sinPhi * Math.cos(theta);
  out[offset + 1] = r * u;
  out[offset + 2] = r * sinPhi * Math.sin(theta);
}

const FOLIAGE_VERTEX_SHADER = /* glsl */ `
  uniform float uTime;
  uniform float uProgress;
  uniform float uPixelRatio;

  attribute vec3 aTargetPos;
  attribute float aRandom;
  attribute float aHeight;
  attribute float aSparkle;

  varying float vMix;
  varying float vHeight;
  varying float vSparkle;
  varying float vRandom;

  float cubicInOut(float t) {
    return t < 0.5 ? 4.0 * t * t * t : 0.5 * pow(2.0 * t - 2.0, 3.0) + 1.0;
  }

  void main() {
    float t = cubicInOut(clamp(uProgress, 0.0, 1.0));
    float phase = aRandom * 6.2831853;

    vec3 chaosDrift = vec3(
      sin(uTime * 0.55 + phase + position.y * 0.12),
      cos(uTime * 0.45 + phase + position.x * 0.12),
      sin(uTime * 0.50 + phase + position.z * 0.12)
    ) * 0.35;

    vec3 treeSway = vec3(
      sin(uTime * 1.4 + aTargetPos.y * 0.45 + phase),
      cos(uTime * 1.1 + aTargetPos.x * 0.45 + phase) * 0.6,
      sin(uTime * 1.3 + aTargetPos.z * 0.45 + phase)
    ) * (0.08 + 0.05 * aHeight);

    vec3 startPos = position + chaosDrift;
    vec3 endPos = aTargetPos + treeSway;

    float arc = sin(t * 3.14159265);
    float swirlAngle = arc * (1.1 + aRandom * 0.8) * (1.0 - t);
    float c = cos(swirlAngle);
    float s = sin(swirlAngle);
    vec3 mixed = mix(startPos, endPos, t);
    vec3 finalPos = vec3(
      mixed.x * c - mixed.z * s,
      mixed.y + arc * (aRandom - 0.5) * 1.4,
      mixed.x * s + mixed.z * c
    );

    vec4 mvPosition = modelViewMatrix * vec4(finalPos, 1.0);
    float sizeScale = 115.0 * (0.65 + aRandom * 0.7 + aSparkle * 0.45);
    gl_PointSize = clamp((sizeScale * uPixelRatio) / max(-mvPosition.z, 1.0), 1.5, 32.0);
    gl_Position = projectionMatrix * mvPosition;

    vMix = t;
    vHeight = aHeight;
    vSparkle = aSparkle;
    vRandom = aRandom;
  }
`;

const FOLIAGE_FRAGMENT_SHADER = /* glsl */ `
  uniform float uTime;
  uniform vec3 uBaseColor;
  uniform vec3 uTipColor;
  uniform vec3 uAccentColor;

  varying float vMix;
  varying float vHeight;
  varying float vSparkle;
  varying float vRandom;

  void main() {
    float r = length(gl_PointCoord - vec2(0.5));
    float glow = exp(-r * r * 7.0) * smoothstep(0.5, 0.12, r);

    float heightFactor = clamp(vHeight * 0.85 + vRandom * 0.15, 0.0, 1.0);
    vec3 bodyColor = mix(uBaseColor, uTipColor, heightFactor);

    float shimmer = 0.5 + 0.5 * sin(uTime * (1.8 + vRandom * 2.8) + vRandom * 43.0);
    float sparkleWeight = vSparkle * (0.45 + 0.55 * shimmer);
    vec3 accentBoost = uAccentColor * (1.15 + 0.55 * shimmer);
    vec3 color = mix(bodyColor, accentBoost, clamp(sparkleWeight, 0.0, 0.92));

    float stateAlpha = mix(0.32, 0.48, vMix);
    float alpha = glow * (stateAlpha + sparkleWeight * 0.36);
    gl_FragColor = vec4(color, alpha);
  }
`;

const RIBBON_VERTEX_SHADER = /* glsl */ `
  uniform float uTime;
  uniform float uProgress;
  uniform float uPixelRatio;

  attribute vec3 aTargetPos;
  attribute float aRibbonT;
  attribute float aRandom;

  varying float vMix;
  varying float vRibbonT;
  varying float vRandom;

  float cubicInOut(float t) {
    return t < 0.5 ? 4.0 * t * t * t : 0.5 * pow(2.0 * t - 2.0, 3.0) + 1.0;
  }

  void main() {
    float t = cubicInOut(clamp(uProgress, 0.0, 1.0));
    float phase = aRandom * 6.2831853;

    vec3 chaosDrift = vec3(
      sin(uTime * 0.4 + phase + position.z * 0.1),
      cos(uTime * 0.35 + phase + position.x * 0.1),
      sin(uTime * 0.45 + phase + position.y * 0.1)
    ) * 0.55;

    float ribbonWave = sin(aRibbonT * 20.0 - uTime * 2.4 + phase) * 0.12;
    vec3 ribbonEnd = aTargetPos + vec3(
      cos(aRibbonT * 34.5575) * ribbonWave,
      sin(uTime * 1.6 + aRibbonT * 18.0) * 0.08,
      sin(aRibbonT * 34.5575) * ribbonWave
    );

    vec3 mixed = mix(position + chaosDrift, ribbonEnd, t);
    float arc = sin(t * 3.14159265);
    float swirlAngle = arc * 2.2 * (1.0 - t);
    float c = cos(swirlAngle);
    float s = sin(swirlAngle);
    vec3 finalPos = vec3(
      mixed.x * c - mixed.z * s,
      mixed.y,
      mixed.x * s + mixed.z * c
    );

    vec4 mvPosition = modelViewMatrix * vec4(finalPos, 1.0);
    float pulseSize = 0.8 + 0.35 * sin(aRibbonT * 26.0 - uTime * 3.0 + phase);
    gl_PointSize = clamp((135.0 * (0.65 + aRandom * 0.6) * pulseSize * uPixelRatio) / max(-mvPosition.z, 1.0), 1.8, 34.0);
    gl_Position = projectionMatrix * mvPosition;

    vMix = t;
    vRibbonT = aRibbonT;
    vRandom = aRandom;
  }
`;

const RIBBON_FRAGMENT_SHADER = /* glsl */ `
  uniform float uTime;
  uniform vec3 uColor;
  uniform vec3 uAccentColor;

  varying float vMix;
  varying float vRibbonT;
  varying float vRandom;

  void main() {
    float r = length(gl_PointCoord - vec2(0.5));
    float glow = exp(-r * r * 6.5) * smoothstep(0.5, 0.1, r);

    float wave1 = 0.5 + 0.5 * sin(vRibbonT * 28.0 - uTime * 3.2);
    float wave2 = 0.5 + 0.5 * sin(vRibbonT * 11.0 - uTime * 1.6 + vRandom * 6.2831);
    float pulse = pow(wave1, 2.2) * 0.75 + pow(wave2, 3.0) * 0.35;

    vec3 color = mix(uColor, uAccentColor * 1.35, clamp(pulse * 0.7, 0.0, 1.0));
    float alpha = glow * mix(0.28, 0.56 + pulse * 0.42, vMix);
    gl_FragColor = vec4(color, alpha);
  }
`;

interface FoliageProps {
  state: SceneState;
  theme: ThemePalette;
  density: number;
}

export function Foliage({ state, theme, density }: FoliageProps) {
  const count = Math.max(1000, Math.floor(CONFIG.counts.foliage * density));

  const geometry = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const targetPositions = new Float32Array(count * 3);
    const randoms = new Float32Array(count);
    const heights = new Float32Array(count);
    const sparkles = new Float32Array(count);

    const h = CONFIG.tree.height;
    const rBase = CONFIG.tree.radius;

    for (let i = 0; i < count; i++) {
      fillSpherePoint(positions, i, 25);

      const normalizedY = 1 - Math.sqrt(Math.random());
      const y = normalizedY * h - h / 2;
      const currentRadius = rBase * (1 - normalizedY);
      const theta = Math.random() * Math.PI * 2;
      const r = Math.pow(Math.random(), 0.45) * currentRadius;

      const offset = i * 3;
      targetPositions[offset] = r * Math.cos(theta);
      targetPositions[offset + 1] = y;
      targetPositions[offset + 2] = r * Math.sin(theta);

      randoms[i] = Math.random();
      heights[i] = normalizedY;
      sparkles[i] = Math.random() < 0.13 ? 0.45 + Math.random() * 0.55 : 0;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aTargetPos', new THREE.BufferAttribute(targetPositions, 3));
    geo.setAttribute('aRandom', new THREE.BufferAttribute(randoms, 1));
    geo.setAttribute('aHeight', new THREE.BufferAttribute(heights, 1));
    geo.setAttribute('aSparkle', new THREE.BufferAttribute(sparkles, 1));
    return geo;
  }, [count]);

  useEffect(() => {
    return () => {
      geometry.dispose();
    };
  }, [geometry]);

  const { material, uniforms } = useMemo(() => {
    const shaderUniforms = {
      uTime: { value: 0 },
      uProgress: { value: 0 },
      uBaseColor: { value: new THREE.Color() },
      uTipColor: { value: new THREE.Color() },
      uAccentColor: { value: new THREE.Color() },
      uPixelRatio: { value: 1 },
    };

    const shaderMaterial = new THREE.ShaderMaterial({
      uniforms: shaderUniforms,
      vertexShader: FOLIAGE_VERTEX_SHADER,
      fragmentShader: FOLIAGE_FRAGMENT_SHADER,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    return { material: shaderMaterial, uniforms: shaderUniforms };
  }, []);

  useEffect(() => {
    uniforms.uBaseColor.value.set(theme.foliageBase);
    uniforms.uTipColor.value.set(theme.foliageTip);
    uniforms.uAccentColor.value.set(theme.foliageAccent);
  }, [uniforms, theme.foliageBase, theme.foliageTip, theme.foliageAccent]);

  useEffect(() => {
    return () => {
      material.dispose();
    };
  }, [material]);

  useFrame((rootState, delta) => {
    uniforms.uTime.value = rootState.clock.elapsedTime;
    uniforms.uPixelRatio.value = rootState.gl.getPixelRatio();
    const targetProgress = state === 'FORMED' ? 1 : 0;
    uniforms.uProgress.value = MathUtils.damp(uniforms.uProgress.value, targetProgress, 1.5, delta);
  });

  return <points geometry={geometry} material={material} frustumCulled={false} dispose={null} />;
}

interface RibbonParticlesProps {
  state: SceneState;
  theme: ThemePalette;
  density: number;
}

export function RibbonParticles({ state, theme, density }: RibbonParticlesProps) {
  const count = Math.max(300, Math.floor(CONFIG.counts.ribbon * density));

  const geometry = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const targetPositions = new Float32Array(count * 3);
    const ribbonTs = new Float32Array(count);
    const randoms = new Float32Array(count);

    const h = CONFIG.tree.height;
    const rBase = CONFIG.tree.radius;
    const turns = 5.5;

    for (let i = 0; i < count; i++) {
      fillSpherePoint(positions, i, 30);

      const t = Math.min(1, Math.max(0, (i + Math.random() * 0.7) / count));
      const normalizedY = 0.02 + t * 0.96;
      const y = normalizedY * h - h / 2 + (Math.random() - 0.5) * 0.42;
      const currentRadius = rBase * (1 - normalizedY);
      const radius = currentRadius + 0.35 + (Math.random() - 0.5) * 0.24;
      const angle = t * turns * Math.PI * 2 + (Math.random() - 0.5) * 0.16;

      const offset = i * 3;
      targetPositions[offset] = radius * Math.cos(angle);
      targetPositions[offset + 1] = y;
      targetPositions[offset + 2] = radius * Math.sin(angle);

      ribbonTs[i] = t;
      randoms[i] = Math.random();
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aTargetPos', new THREE.BufferAttribute(targetPositions, 3));
    geo.setAttribute('aRibbonT', new THREE.BufferAttribute(ribbonTs, 1));
    geo.setAttribute('aRandom', new THREE.BufferAttribute(randoms, 1));
    return geo;
  }, [count]);

  useEffect(() => {
    return () => {
      geometry.dispose();
    };
  }, [geometry]);

  const { material, uniforms } = useMemo(() => {
    const shaderUniforms = {
      uTime: { value: 0 },
      uProgress: { value: 0 },
      uColor: { value: new THREE.Color() },
      uAccentColor: { value: new THREE.Color() },
      uPixelRatio: { value: 1 },
    };

    const shaderMaterial = new THREE.ShaderMaterial({
      uniforms: shaderUniforms,
      vertexShader: RIBBON_VERTEX_SHADER,
      fragmentShader: RIBBON_FRAGMENT_SHADER,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    return { material: shaderMaterial, uniforms: shaderUniforms };
  }, []);

  useEffect(() => {
    uniforms.uColor.value.set(theme.ribbon);
    uniforms.uAccentColor.value.set(theme.foliageAccent);
  }, [uniforms, theme.ribbon, theme.foliageAccent]);

  useEffect(() => {
    return () => {
      material.dispose();
    };
  }, [material]);

  useFrame((rootState, delta) => {
    uniforms.uTime.value = rootState.clock.elapsedTime;
    uniforms.uPixelRatio.value = rootState.gl.getPixelRatio();
    const targetProgress = state === 'FORMED' ? 1 : 0;
    uniforms.uProgress.value = MathUtils.damp(uniforms.uProgress.value, targetProgress, 1.4, delta);
  });

  return <points geometry={geometry} material={material} frustumCulled={false} dispose={null} />;
}

interface TopStarProps {
  state: SceneState;
  theme: ThemePalette;
}

export function TopStar({ state, theme }: TopStarProps) {
  const groupRef = useRef<THREE.Group>(null);

  const starGeometry = useMemo(() => {
    const shape = new THREE.Shape();
    const outerRadius = 1.35;
    const innerRadius = 0.58;
    const points = 5;

    for (let i = 0; i < points * 2; i++) {
      const radius = i % 2 === 0 ? outerRadius : innerRadius;
      const angle = (i / (points * 2)) * Math.PI * 2 + Math.PI / 2;
      const x = radius * Math.cos(angle);
      const y = radius * Math.sin(angle);
      if (i === 0) {
        shape.moveTo(x, y);
      } else {
        shape.lineTo(x, y);
      }
    }
    shape.closePath();

    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth: 0.36,
      bevelEnabled: true,
      bevelThickness: 0.1,
      bevelSize: 0.09,
      bevelSegments: 3,
    });
    geometry.center();
    return geometry;
  }, []);

  useEffect(() => {
    return () => {
      starGeometry.dispose();
    };
  }, [starGeometry]);

  const starMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        roughness: 0.14,
        metalness: 0.92,
        emissiveIntensity: 1.45,
      }),
    [],
  );

  useEffect(() => {
    starMaterial.color.set(theme.star);
    starMaterial.emissive.set(theme.star);
  }, [starMaterial, theme.star]);

  useEffect(() => {
    return () => {
      starMaterial.dispose();
    };
  }, [starMaterial]);

  useEffect(() => {
    groupRef.current?.scale.setScalar(0);
  }, []);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    groupRef.current.rotation.y += delta * 0.5;
    const targetScale = state === 'FORMED' ? 1 : 0;
    _starScale.set(targetScale, targetScale, targetScale);
    groupRef.current.scale.lerp(_starScale, Math.min(1, delta * 3));
  });

  return (
    <group ref={groupRef} position={[0, CONFIG.tree.height / 2 + 1.8, 0]}>
      <Float speed={2} rotationIntensity={0.2} floatIntensity={0.2}>
        <mesh geometry={starGeometry} material={starMaterial} dispose={null} />
      </Float>
    </group>
  );
}
