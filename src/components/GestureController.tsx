import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import {
  DrawingUtils,
  FilesetResolver,
  GestureRecognizer,
} from '@mediapipe/tasks-vision';
import type { GestureRecognizerResult } from '@mediapipe/tasks-vision';
import type { GestureFeedback, SceneState } from '../config';

interface GestureControllerProps {
  onGesture: (state: SceneState) => void;
  onMove: (speed: number) => void;
  onPitch: (pitch: number) => void;
  onPinchChange: (pinching: boolean) => void;
  onFeedback: (feedback: GestureFeedback) => void;
  cameraVisible: boolean;
  onToggleCamera: () => void;
  accentColor: string;
}

const LOCAL_WASM_PATH = '/mediapipe/wasm';
const CDN_WASM_PATH =
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22-rc.20250304/wasm';
const LOCAL_MODEL_PATH = '/mediapipe/gesture_recognizer.task';
const CDN_MODEL_PATH =
  'https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task';

const GESTURE_SCORE_THRESHOLD = 0.45;
const CONSECUTIVE_FRAMES_REQUIRED = 5;
const HORIZONTAL_DEADZONE = 0.012;
const PITCH_DEADZONE = 0.08;
const PITCH_MAX = 0.35;
const PINCH_ENTER_RATIO = 0.35;
const PINCH_EXIT_RATIO = 0.48;
const PINCH_FRAMES_REQUIRED = 3;

const NON_PINCH_FINGER_PAIRS: ReadonlyArray<readonly [number, number]> = [
  [10, 12],
  [14, 16],
  [18, 20],
];

async function resolveVisionFileset() {
  try {
    const probe = await fetch(`${LOCAL_WASM_PATH}/vision_wasm_internal.js`, {
      method: 'HEAD',
    });
    const contentType = (probe.headers.get('content-type') ?? '').toLowerCase();
    if (probe.ok && !contentType.includes('text/html')) {
      return await FilesetResolver.forVisionTasks(LOCAL_WASM_PATH);
    }
  } catch {
    // Fall back to CDN WASM
  }
  return await FilesetResolver.forVisionTasks(CDN_WASM_PATH);
}

async function resolveModelAssetPath(): Promise<string> {
  try {
    const res = await fetch(LOCAL_MODEL_PATH, { method: 'HEAD' });
    const contentLength = Number(res.headers.get('content-length') ?? 0);
    const contentType = (res.headers.get('content-type') ?? '').toLowerCase();
    if (
      res.ok &&
      contentLength > 100000 &&
      !contentType.includes('text/html')
    ) {
      return LOCAL_MODEL_PATH;
    }
  } catch {
    // Fall back to CDN model asset
  }
  return CDN_MODEL_PATH;
}

function formatSetupError(err: unknown): string {
  if (err instanceof DOMException) {
    if (
      err.name === 'NotAllowedError' ||
      err.name === 'PermissionDeniedError'
    ) {
      return 'CAMERA PERMISSION DENIED';
    }
    if (
      err.name === 'NotFoundError' ||
      err.name === 'DevicesNotFoundError'
    ) {
      return 'NO CAMERA DETECTED';
    }
    return `ERROR: ${err.message || err.name}`;
  }
  if (err instanceof Error) {
    return `ERROR: ${err.message || 'MODEL FAILED'}`;
  }
  return 'ERROR: MODEL FAILED';
}

export const GestureController = ({
  onGesture,
  onMove,
  onPitch,
  onPinchChange,
  onFeedback,
  cameraVisible,
  onToggleCamera,
  accentColor,
}: GestureControllerProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [cameraReady, setCameraReady] = useState(false);
  const [cameraHint, setCameraHint] = useState('正在加载 AI 模型...');
  const [liveBadge, setLiveBadge] = useState('等待手势入画');

  const cameraVisibleRef = useRef<boolean>(cameraVisible);
  const callbacksRef = useRef({
    onGesture,
    onMove,
    onPitch,
    onPinchChange,
    onFeedback,
  });
  const lastFeedbackRef = useRef<GestureFeedback | null>(null);

  useEffect(() => {
    cameraVisibleRef.current = cameraVisible;
    if (!cameraVisible && canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx && canvasRef.current.width > 0 && canvasRef.current.height > 0) {
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
    }
  }, [cameraVisible]);

  useEffect(() => {
    callbacksRef.current = {
      onGesture,
      onMove,
      onPitch,
      onPinchChange,
      onFeedback,
    };
  }, [onGesture, onMove, onPitch, onPinchChange, onFeedback]);

  useEffect(() => {
    let cancelled = false;
    let gestureRecognizer: GestureRecognizer | null = null;
    let activeStream: MediaStream | null = null;
    let requestRef = 0;

    const videoElement = videoRef.current;
    const canvasElement = canvasRef.current;

    let drawingUtils: DrawingUtils | null = null;
    let lastVideoTimestamp = -1;
    let candidateGesture: 'Open_Palm' | 'Closed_Fist' | null = null;
    let consecutiveFrames = 0;
    let pinchActive = false;
    let pinchEnterFrames = 0;
    let pinchExitFrames = 0;
    let currentBadge = '等待手势入画';

    const updateLiveBadge = (nextBadge: string) => {
      if (cancelled || nextBadge === currentBadge) return;
      currentBadge = nextBadge;
      setLiveBadge(nextBadge);
    };

    const emitFeedback = (next: GestureFeedback) => {
      if (cancelled) return;
      const prev = lastFeedbackRef.current;
      if (
        prev &&
        prev.status === next.status &&
        prev.detectedGesture === next.detectedGesture &&
        prev.handPresent === next.handPresent &&
        prev.isError === next.isError
      ) {
        return;
      }
      lastFeedbackRef.current = next;
      callbacksRef.current.onFeedback(next);
    };

    const predictWebcam = () => {
      if (cancelled) return;

      const recognizer = gestureRecognizer;
      if (recognizer && videoElement && canvasElement) {
        if (
          videoElement.readyState >= 2 &&
          videoElement.videoWidth > 0 &&
          videoElement.videoHeight > 0
        ) {
          const rawTimestamp = Math.floor(performance.now());
          const timestamp =
            rawTimestamp > lastVideoTimestamp
              ? rawTimestamp
              : lastVideoTimestamp + 1;
          lastVideoTimestamp = timestamp;

          let results: GestureRecognizerResult | null = null;
          try {
            results = recognizer.recognizeForVideo(videoElement, timestamp);
          } catch {
            results = null;
          }

          if (results) {
            const ctx = canvasElement.getContext('2d');
            if (ctx) {
              if (cameraVisibleRef.current) {
                if (
                  canvasElement.width !== videoElement.videoWidth ||
                  canvasElement.height !== videoElement.videoHeight
                ) {
                  canvasElement.width = videoElement.videoWidth;
                  canvasElement.height = videoElement.videoHeight;
                } else {
                  ctx.clearRect(
                    0,
                    0,
                    canvasElement.width,
                    canvasElement.height
                  );
                }

                if (!drawingUtils) {
                  drawingUtils = new DrawingUtils(ctx);
                }

                for (const landmarks of results.landmarks) {
                  drawingUtils.drawConnectors(
                    landmarks,
                    GestureRecognizer.HAND_CONNECTIONS,
                    { color: '#FFD700', lineWidth: 2 }
                  );
                  drawingUtils.drawLandmarks(landmarks, {
                    color: '#FF4D4D',
                    lineWidth: 1,
                    radius: 3,
                  });
                }
              } else if (canvasElement.width > 0 && canvasElement.height > 0) {
                ctx.clearRect(
                  0,
                  0,
                  canvasElement.width,
                  canvasElement.height
                );
              }
            }

            const landmarks = results.landmarks[0];
            if (landmarks && landmarks.length >= 21) {
              const wrist = landmarks[0];
              const middleMcp = landmarks[9];
              const thumbTip = landmarks[4];
              const indexTip = landmarks[8];

              const palmSize = Math.max(
                0.05,
                Math.hypot(wrist.x - middleMcp.x, wrist.y - middleMcp.y)
              );
              const pinchRatio =
                Math.hypot(thumbTip.x - indexTip.x, thumbTip.y - indexTip.y) /
                palmSize;

              let extendedOtherFingers = 0;
              for (const [pipIdx, tipIdx] of NON_PINCH_FINGER_PAIRS) {
                const pip = landmarks[pipIdx];
                const tip = landmarks[tipIdx];
                const pipDist = Math.hypot(pip.x - wrist.x, pip.y - wrist.y);
                const tipDist = Math.hypot(tip.x - wrist.x, tip.y - wrist.y);
                if (tipDist > pipDist * 1.08) {
                  extendedOtherFingers += 1;
                }
              }

              const topCategory = results.gestures[0]?.[0];
              const categoryName = topCategory?.categoryName;
              const score = topCategory?.score ?? 0;
              const isStrongFist =
                categoryName === 'Closed_Fist' && score > 0.5;

              const wantsPinch =
                !isStrongFist &&
                pinchRatio < PINCH_ENTER_RATIO &&
                extendedOtherFingers >= 1;
              const wantsRelease =
                isStrongFist || pinchRatio > PINCH_EXIT_RATIO;

              if (!pinchActive) {
                if (wantsPinch) {
                  pinchEnterFrames += 1;
                  if (pinchEnterFrames >= PINCH_FRAMES_REQUIRED) {
                    pinchActive = true;
                    pinchEnterFrames = 0;
                    pinchExitFrames = 0;
                    candidateGesture = null;
                    consecutiveFrames = 0;
                    callbacksRef.current.onPinchChange(true);
                  }
                } else {
                  pinchEnterFrames = 0;
                }
              } else if (wantsRelease) {
                pinchExitFrames += 1;
                if (pinchExitFrames >= PINCH_FRAMES_REQUIRED) {
                  pinchActive = false;
                  pinchExitFrames = 0;
                  pinchEnterFrames = 0;
                  callbacksRef.current.onPinchChange(false);
                }
              } else {
                pinchExitFrames = 0;
              }

              if (pinchActive) {
                callbacksRef.current.onMove(0);
                callbacksRef.current.onPitch(0);
                updateLiveBadge('👌 捏合 · 摘取照片');
                emitFeedback({
                  status: 'GESTURE: PINCH PLUCK',
                  detectedGesture: 'Pinch',
                  handPresent: true,
                  isError: false,
                });
              } else {
                const rawMove = (0.5 - wrist.x) * 0.22;
                const moveSpeed =
                  Math.abs(rawMove) > HORIZONTAL_DEADZONE ? rawMove : 0;
                callbacksRef.current.onMove(moveSpeed);

                const rawPitch = (middleMcp.y - 0.5) * 0.6;
                const pitch =
                  Math.abs(rawPitch) > PITCH_DEADZONE
                    ? Math.max(-PITCH_MAX, Math.min(PITCH_MAX, rawPitch))
                    : 0;
                callbacksRef.current.onPitch(pitch);

                let confirmedGesture: GestureFeedback['detectedGesture'] = null;
                if (
                  score > GESTURE_SCORE_THRESHOLD &&
                  (categoryName === 'Open_Palm' ||
                    categoryName === 'Closed_Fist')
                ) {
                  if (candidateGesture === categoryName) {
                    consecutiveFrames += 1;
                  } else {
                    candidateGesture = categoryName;
                    consecutiveFrames = 1;
                  }

                  if (consecutiveFrames === CONSECUTIVE_FRAMES_REQUIRED) {
                    callbacksRef.current.onGesture(
                      categoryName === 'Open_Palm' ? 'CHAOS' : 'FORMED'
                    );
                  }
                  if (consecutiveFrames >= CONSECUTIVE_FRAMES_REQUIRED) {
                    confirmedGesture = categoryName;
                  }
                } else {
                  candidateGesture = null;
                  consecutiveFrames = 0;
                }

                const statusText =
                  confirmedGesture === 'Open_Palm'
                    ? 'GESTURE: OPEN PALM'
                    : confirmedGesture === 'Closed_Fist'
                      ? 'GESTURE: CLOSED FIST'
                      : 'HAND TRACKING';

                const nextBadge =
                  confirmedGesture === 'Open_Palm'
                    ? '🖐 张开 · 散开'
                    : confirmedGesture === 'Closed_Fist'
                      ? '✊ 握拳 · 聚合'
                      : moveSpeed !== 0 || pitch !== 0
                        ? '👋 移动 · 旋转俯仰'
                        : '✋ 已识别手部';
                updateLiveBadge(nextBadge);

                emitFeedback({
                  status: statusText,
                  detectedGesture: confirmedGesture,
                  handPresent: true,
                  isError: false,
                });
              }
            } else {
              candidateGesture = null;
              consecutiveFrames = 0;
              pinchEnterFrames = 0;
              pinchExitFrames = 0;
              if (pinchActive) {
                pinchActive = false;
                callbacksRef.current.onPinchChange(false);
              }
              callbacksRef.current.onMove(0);
              callbacksRef.current.onPitch(0);
              updateLiveBadge('等待手势入画');
              emitFeedback({
                status: 'AI READY: SHOW HAND',
                detectedGesture: null,
                handPresent: false,
                isError: false,
              });
            }
          }
        }
      }

      if (!cancelled) {
        requestRef = requestAnimationFrame(predictWebcam);
      }
    };

    const setup = async () => {
      emitFeedback({
        status: 'DOWNLOADING AI...',
        detectedGesture: null,
        handPresent: false,
        isError: false,
      });

      try {
        const [vision, modelAssetPath] = await Promise.all([
          resolveVisionFileset(),
          resolveModelAssetPath(),
        ]);
        if (cancelled) return;

        const recognizer = await GestureRecognizer.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath,
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          numHands: 1,
        });

        if (cancelled) {
          recognizer.close();
          return;
        }
        gestureRecognizer = recognizer;

        setCameraHint('正在请求摄像头权限...');
        emitFeedback({
          status: 'REQUESTING CAMERA...',
          detectedGesture: null,
          handPresent: false,
          isError: false,
        });

        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          setCameraHint('当前环境不支持摄像头');
          emitFeedback({
            status: 'ERROR: CAMERA UNAVAILABLE',
            detectedGesture: null,
            handPresent: false,
            isError: true,
          });
          return;
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        activeStream = stream;

        if (!videoElement) {
          stream.getTracks().forEach((track) => track.stop());
          activeStream = null;
          return;
        }

        videoElement.srcObject = stream;
        await videoElement.play();
        if (cancelled) return;

        setCameraReady(true);
        emitFeedback({
          status: 'AI READY: SHOW HAND',
          detectedGesture: null,
          handPresent: false,
          isError: false,
        });

        requestRef = requestAnimationFrame(predictWebcam);
      } catch (err: unknown) {
        if (cancelled) return;
        const msg = formatSetupError(err);
        setCameraHint(
          msg === 'CAMERA PERMISSION DENIED'
            ? '摄像头权限被拒绝'
            : msg === 'NO CAMERA DETECTED'
              ? '未检测到摄像头'
              : '摄像头或模型未就绪'
        );
        emitFeedback({
          status: msg,
          detectedGesture: null,
          handPresent: false,
          isError: true,
        });
      }
    };

    void setup();

    return () => {
      cancelled = true;
      if (pinchActive) {
        pinchActive = false;
        callbacksRef.current.onPinchChange(false);
      }
      if (requestRef !== 0) {
        cancelAnimationFrame(requestRef);
      }
      if (activeStream) {
        activeStream.getTracks().forEach((track) => track.stop());
        activeStream = null;
      }
      if (videoElement) {
        videoElement.srcObject = null;
      }
      if (gestureRecognizer) {
        try {
          gestureRecognizer.close();
        } catch {
          // Ignore close errors during unmount
        }
        gestureRecognizer = null;
      }
    };
  }, []);

  const containerStyle: CSSProperties = cameraVisible
    ? {
        position: 'fixed',
        bottom: '24px',
        left: '24px',
        width: '228px',
        borderRadius: '14px',
        overflow: 'hidden',
        zIndex: 24,
        border: `1px solid ${accentColor}55`,
        pointerEvents: 'auto',
      }
    : {
        position: 'fixed',
        bottom: '-10px',
        left: '-10px',
        width: '1px',
        height: '1px',
        overflow: 'hidden',
        opacity: 0,
        zIndex: -1,
        pointerEvents: 'none',
      };

  const mediaStyle: CSSProperties = cameraVisible
    ? {
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        transform: 'scaleX(-1)',
        pointerEvents: 'none',
      }
    : {
        width: '1px',
        height: '1px',
        opacity: 0,
        pointerEvents: 'none',
        transform: 'scaleX(-1)',
      };

  return (
    <>
      <div
        className={cameraVisible ? 'hud-glass' : undefined}
        style={containerStyle}
        aria-label="实时手势摄像头预览"
      >
        {cameraVisible && (
          <div
            style={{
              height: '30px',
              padding: '0 10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
              backgroundColor: 'rgba(8, 12, 18, 0.8)',
              fontSize: '11px',
              fontWeight: 600,
              letterSpacing: '0.04em',
              color: 'rgba(255, 255, 255, 0.88)',
            }}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <span
                aria-hidden="true"
                style={{
                  width: '7px',
                  height: '7px',
                  borderRadius: '50%',
                  backgroundColor: cameraReady ? '#4ade80' : accentColor,
                  boxShadow: cameraReady
                    ? '0 0 8px #4ade80'
                    : `0 0 8px ${accentColor}`,
                }}
              />
              <span>实时手势镜头</span>
            </span>
            <button
              type="button"
              onClick={onToggleCamera}
              aria-label="关闭摄像头小窗"
              title="关闭摄像头小窗"
              style={{
                width: '22px',
                height: '22px',
                borderRadius: '6px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '15px',
                lineHeight: 1,
                color: 'rgba(255, 255, 255, 0.72)',
                backgroundColor: 'rgba(255, 255, 255, 0.06)',
              }}
            >
              ×
            </button>
          </div>
        )}

        <div
          style={
            cameraVisible
              ? {
                  position: 'relative',
                  width: '100%',
                  height: '156px',
                  backgroundColor: 'rgba(6, 10, 16, 0.9)',
                }
              : { width: '1px', height: '1px' }
          }
        >
          <video
            ref={videoRef}
            style={mediaStyle}
            playsInline
            muted
            autoPlay
          />
          <canvas ref={canvasRef} style={mediaStyle} />

          {cameraVisible && !cameraReady && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '12px',
                textAlign: 'center',
                fontSize: '11px',
                lineHeight: 1.5,
                color: 'rgba(255, 255, 255, 0.72)',
              }}
            >
              {cameraHint}
            </div>
          )}

          {cameraVisible && cameraReady && (
            <div
              style={{
                position: 'absolute',
                left: '8px',
                bottom: '8px',
                padding: '3px 9px',
                borderRadius: '999px',
                backgroundColor: 'rgba(6, 10, 16, 0.72)',
                border: `1px solid ${accentColor}55`,
                backdropFilter: 'blur(6px)',
                fontSize: '11px',
                fontWeight: 600,
                color: '#ffffff',
                pointerEvents: 'none',
              }}
            >
              {liveBadge}
            </div>
          )}
        </div>
      </div>

      {!cameraVisible && (
        <button
          type="button"
          onClick={onToggleCamera}
          className="hud-glass hud-btn"
          style={{
            position: 'fixed',
            bottom: '24px',
            left: '24px',
            zIndex: 24,
            height: '40px',
            padding: '0 14px',
            borderRadius: '12px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '12px',
            fontWeight: 600,
            color: accentColor,
            borderColor: `${accentColor}66`,
            pointerEvents: 'auto',
          }}
        >
          <span>📷 开启互动镜头</span>
        </button>
      )}
    </>
  );
};
