import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import type { ComponentRef, MutableRefObject } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import {
  Environment,
  Lightformer,
  OrbitControls,
  PerspectiveCamera,
  Sparkles,
  Stars,
} from '@react-three/drei';
import { Bloom, EffectComposer, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';
import { MathUtils } from 'three';
import { BODY_PHOTO_PATHS, DEFAULT_SETTINGS, THEMES } from './config';
import type {
  GestureFeedback,
  SceneState,
  ThemePalette,
  VisualSettings,
} from './config';
import {
  Foliage,
  RibbonParticles,
  TopStar,
} from './components/ParticleTree';
import {
  ChristmasElements,
  FairyLights,
  PhotoOrnaments,
} from './components/TreeDecorations';
import { GestureController } from './components/GestureController';
import { HudOverlay } from './components/HudOverlay';

interface ExperienceProps {
  sceneState: SceneState;
  theme: ThemePalette;
  settings: VisualSettings;
  isPinching: boolean;
  rotationSpeedRef: MutableRefObject<number>;
  pitchOffsetRef: MutableRefObject<number>;
}

const BASE_POLAR_ANGLE = Math.PI / 2.25;

const Experience = ({
  sceneState,
  theme,
  settings,
  isPinching,
  rotationSpeedRef,
  pitchOffsetRef,
}: ExperienceProps) => {
  const controlsRef = useRef<ComponentRef<typeof OrbitControls>>(null);
  const dampedSpeedRef = useRef(0);
  const dampedPitchRef = useRef(0);

  useFrame((_, delta) => {
    const controls = controlsRef.current;
    if (!controls) return;

    const dt = Math.min(delta, 0.1);
    dampedSpeedRef.current = MathUtils.damp(
      dampedSpeedRef.current,
      rotationSpeedRef.current,
      8.5,
      dt
    );
    dampedPitchRef.current = MathUtils.damp(
      dampedPitchRef.current,
      pitchOffsetRef.current,
      5,
      dt
    );

    const hasHandSpin =
      Math.abs(dampedSpeedRef.current) > 0.0005 ||
      Math.abs(rotationSpeedRef.current) > 0.0005;

    const hasPhotos = settings.showPhotos && BODY_PHOTO_PATHS.length > 0;
    controls.autoRotate =
      sceneState === 'FORMED' &&
      !hasHandSpin &&
      !(isPinching && hasPhotos);

    if (Math.abs(dampedSpeedRef.current) > 0.0005) {
      controls.setAzimuthalAngle(
        controls.getAzimuthalAngle() + dampedSpeedRef.current * dt * 60
      );
    }

    if (Math.abs(dampedPitchRef.current) > 0.005) {
      const targetPolar = MathUtils.clamp(
        BASE_POLAR_ANGLE + dampedPitchRef.current,
        0.45,
        Math.PI / 1.75
      );
      const nextPolar = MathUtils.damp(
        controls.getPolarAngle(),
        targetPolar,
        5,
        dt
      );
      controls.setPolarAngle(nextPolar);
    }
  });

  return (
    <>
      <PerspectiveCamera makeDefault position={[0, 8, 60]} fov={45} />
      <OrbitControls
        ref={controlsRef}
        enablePan={false}
        enableZoom={true}
        enableDamping={true}
        dampingFactor={0.05}
        minDistance={28}
        maxDistance={120}
        autoRotate={sceneState === 'FORMED'}
        autoRotateSpeed={0.35}
        minPolarAngle={0.35}
        maxPolarAngle={Math.PI / 1.7}
      />

      <color attach="background" args={[theme.background]} />
      <Stars
        radius={100}
        depth={50}
        count={4500}
        factor={4}
        saturation={0}
        fade
        speed={1}
      />
      <Environment key={theme.id} resolution={256} frames={1} background={false}>
        <Lightformer
          form="ring"
          intensity={2.2}
          color={theme.star}
          scale={[20, 20, 1]}
          position={[0, 18, 0]}
          rotation={[Math.PI / 2, 0, 0]}
        />
        <Lightformer
          form="rect"
          intensity={1.4}
          color={theme.ribbon}
          scale={[18, 8, 1]}
          position={[16, 4, 14]}
          rotation={[0, -Math.PI / 4, 0]}
        />
        <Lightformer
          form="rect"
          intensity={1.0}
          color="#dbeafe"
          scale={[18, 10, 1]}
          position={[-16, -2, -14]}
          rotation={[0, (3 * Math.PI) / 4, 0]}
        />
      </Environment>

      <ambientLight intensity={0.45} color={theme.ambient} />
      <pointLight position={[30, 30, 30]} intensity={90} color={theme.star} />
      <pointLight
        position={[-30, 10, -30]}
        intensity={50}
        color={theme.ribbon}
      />
      <pointLight position={[0, -20, 10]} intensity={28} color="#ffffff" />

      <group position={[0, -6, 0]}>
        <Foliage
          state={sceneState}
          theme={theme}
          density={settings.particleDensity}
        />
        <RibbonParticles
          state={sceneState}
          theme={theme}
          density={settings.particleDensity}
        />
        <Suspense fallback={null}>
          {BODY_PHOTO_PATHS.length > 0 && (
            <PhotoOrnaments
              state={sceneState}
              theme={theme}
              visible={settings.showPhotos}
              isPinching={isPinching}
            />
          )}
          <ChristmasElements state={sceneState} theme={theme} />
          <FairyLights state={sceneState} theme={theme} />
          <TopStar state={sceneState} theme={theme} />
        </Suspense>
        <Sparkles
          count={450}
          scale={48}
          size={6}
          speed={0.35}
          opacity={0.45}
          color={theme.star}
        />
      </group>

      <EffectComposer>
        <Bloom
          luminanceThreshold={0.85}
          luminanceSmoothing={0.15}
          intensity={settings.bloomIntensity}
          radius={0.55}
          mipmapBlur
        />
        <Vignette eskil={false} offset={0.1} darkness={1.15} />
      </EffectComposer>
    </>
  );
};

export default function GrandTreeApp() {
  const [sceneState, setSceneState] = useState<SceneState>('CHAOS');
  const [settings, setSettings] = useState<VisualSettings>(DEFAULT_SETTINGS);
  const [cameraVisible, setCameraVisible] = useState(true);
  const [isPinching, setIsPinching] = useState(false);
  const [feedback, setFeedback] = useState<GestureFeedback>({
    status: 'INITIALIZING AI...',
    detectedGesture: null,
    handPresent: false,
    isError: false,
  });

  const manualOverrideRef = useRef(false);
  const rotationSpeedRef = useRef(0);
  const pitchOffsetRef = useRef(0);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (!manualOverrideRef.current) {
        setSceneState('FORMED');
      }
    }, 350);
    return () => window.clearTimeout(timer);
  }, []);

  const handleToggleScene = useCallback(() => {
    manualOverrideRef.current = true;
    setSceneState((prev) => (prev === 'CHAOS' ? 'FORMED' : 'CHAOS'));
  }, []);

  const handleGesture = useCallback((nextState: SceneState) => {
    manualOverrideRef.current = true;
    setSceneState(nextState);
  }, []);

  const handleMove = useCallback((speed: number) => {
    rotationSpeedRef.current = speed;
  }, []);

  const handlePitch = useCallback((pitch: number) => {
    pitchOffsetRef.current = pitch;
  }, []);

  const handleFeedback = useCallback((nextFeedback: GestureFeedback) => {
    setFeedback(nextFeedback);
  }, []);

  const handleUpdateSettings = useCallback(
    (patch: Partial<VisualSettings>) => {
      setSettings((prev) => ({ ...prev, ...patch }));
    },
    []
  );

  const handleToggleCamera = useCallback(() => {
    setCameraVisible((prev) => !prev);
  }, []);

  const handlePinchChange = useCallback((pinching: boolean) => {
    setIsPinching(pinching);
  }, []);

  const theme = THEMES[settings.theme];

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        backgroundColor: theme.background,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          width: '100%',
          height: '100%',
          position: 'absolute',
          inset: 0,
          zIndex: 1,
        }}
      >
        <Canvas
          dpr={[1, 2]}
          gl={{ toneMapping: THREE.ReinhardToneMapping }}
          shadows
        >
          <Experience
            sceneState={sceneState}
            theme={theme}
            settings={settings}
            isPinching={isPinching}
            rotationSpeedRef={rotationSpeedRef}
            pitchOffsetRef={pitchOffsetRef}
          />
        </Canvas>
      </div>

      <GestureController
        onGesture={handleGesture}
        onMove={handleMove}
        onPitch={handlePitch}
        onPinchChange={handlePinchChange}
        onFeedback={handleFeedback}
        cameraVisible={cameraVisible}
        onToggleCamera={handleToggleCamera}
        accentColor={theme.uiAccent}
      />

      <HudOverlay
        sceneState={sceneState}
        onToggleScene={handleToggleScene}
        settings={settings}
        onUpdateSettings={handleUpdateSettings}
        cameraVisible={cameraVisible}
        onToggleCamera={handleToggleCamera}
        feedback={feedback}
        isPhotoPlucked={
          isPinching && settings.showPhotos && BODY_PHOTO_PATHS.length > 0
        }
      />
    </div>
  );
}
