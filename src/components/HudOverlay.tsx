import { useState } from 'react';
import type { CSSProperties } from 'react';
import { CONFIG, THEMES } from '../config';
import type {
  GestureFeedback,
  SceneState,
  ThemePalette,
  VisualSettings,
} from '../config';

interface HudOverlayProps {
  sceneState: SceneState;
  onToggleScene: () => void;
  settings: VisualSettings;
  onUpdateSettings: (patch: Partial<VisualSettings>) => void;
  cameraVisible: boolean;
  onToggleCamera: () => void;
  feedback: GestureFeedback;
  isPhotoPlucked: boolean;
}

type RootStyle = CSSProperties & { '--ui-accent': string };
type RangeStyle = CSSProperties & { '--range-pct': string };

function toPercent(value: number, min: number, max: number): string {
  const clamped = Math.min(max, Math.max(min, value));
  return `${(((clamped - min) / (max - min)) * 100).toFixed(1)}%`;
}

export const HudOverlay = ({
  sceneState,
  onToggleScene,
  settings,
  onUpdateSettings,
  cameraVisible,
  onToggleCamera,
  feedback,
  isPhotoPlucked,
}: HudOverlayProps) => {
  const [drawerOpen, setDrawerOpen] = useState(false);

  const activeTheme: ThemePalette = THEMES[settings.theme];
  const themeList = Object.values(THEMES);

  const foliageCount = Math.max(
    1000,
    Math.floor(CONFIG.counts.foliage * settings.particleDensity)
  );
  const ribbonCount = Math.floor(CONFIG.counts.ribbon * settings.particleDensity);
  const particlesK = Math.round((foliageCount + ribbonCount) / 1000);

  const rootStyle: RootStyle = {
    position: 'fixed',
    inset: 0,
    pointerEvents: 'none',
    zIndex: 20,
    userSelect: 'none',
    '--ui-accent': activeTheme.uiAccent,
  };

  const densityRangeStyle: RangeStyle = {
    '--range-pct': toPercent(settings.particleDensity, 0.4, 1.5),
  };

  const bloomRangeStyle: RangeStyle = {
    '--range-pct': toPercent(settings.bloomIntensity, 0.3, 2.2),
  };

  const guideItems: Array<{
    key: string;
    label: string;
    active: boolean;
  }> = [
    {
      key: 'Open_Palm',
      label: '🖐 张开散开',
      active: feedback.detectedGesture === 'Open_Palm',
    },
    {
      key: 'Closed_Fist',
      label: '✊ 握拳聚合',
      active: feedback.detectedGesture === 'Closed_Fist',
    },
    {
      key: 'Hand_Move',
      label: '👋 移动旋转·俯仰',
      active: feedback.handPresent,
    },
    {
      key: 'Pinch',
      label: '👌 捏合摘图',
      active: feedback.detectedGesture === 'Pinch',
    },
  ];

  return (
    <div style={rootStyle}>
      {/* Center: Artistic Script Title */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 12,
          pointerEvents: 'none',
          textAlign: 'center',
          opacity: isPhotoPlucked ? 0 : 1,
          transition: 'opacity 260ms ease',
        }}
      >
        <h1 className="merry-title">Merry Christmas!</h1>
      </div>

      {/* Top-Left: Collapsible Visual Settings Drawer */}
      <div
        style={{
          position: 'absolute',
          top: '16px',
          left: '16px',
          zIndex: 25,
          pointerEvents: 'auto',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
        }}
      >
        <button
          type="button"
          onClick={() => setDrawerOpen((prev) => !prev)}
          aria-expanded={drawerOpen}
          className="hud-glass hud-btn"
          style={{
            height: '38px',
            padding: '0 14px',
            borderRadius: '11px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '13px',
            fontWeight: 600,
            letterSpacing: '0.03em',
            color: drawerOpen ? activeTheme.uiAccent : 'rgba(255, 255, 255, 0.92)',
            borderColor: drawerOpen
              ? `${activeTheme.uiAccent}88`
              : 'rgba(255, 255, 255, 0.16)',
          }}
        >
          <span>⚙ 视觉设置</span>
          <span style={{ fontSize: '10px', opacity: 0.7 }}>
            {drawerOpen ? '▲' : '▼'}
          </span>
        </button>

        {drawerOpen && (
          <div
            className="hud-glass"
            style={{
              marginTop: '10px',
              width: '276px',
              padding: '16px',
              borderRadius: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
          >
            {/* Theme Selector */}
            <div>
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  letterSpacing: '0.08em',
                  color: 'rgba(255, 255, 255, 0.68)',
                  marginBottom: '8px',
                }}
              >
                主题切换
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '6px',
                }}
              >
                {themeList.map((themeItem) => {
                  const isActive = settings.theme === themeItem.id;
                  return (
                    <button
                      key={themeItem.id}
                      type="button"
                      aria-pressed={isActive}
                      onClick={() => onUpdateSettings({ theme: themeItem.id })}
                      className="hud-btn"
                      style={{
                        padding: '8px 6px',
                        borderRadius: '10px',
                        border: `1px solid ${
                          isActive
                            ? themeItem.uiAccent
                            : 'rgba(255, 255, 255, 0.12)'
                        }`,
                        background: isActive
                          ? `${themeItem.uiAccent}24`
                          : 'rgba(255, 255, 255, 0.04)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '5px',
                        fontSize: '11px',
                        fontWeight: isActive ? 700 : 500,
                        color: isActive ? '#ffffff' : 'rgba(255, 255, 255, 0.78)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <span
                        aria-hidden="true"
                        style={{
                          width: '14px',
                          height: '14px',
                          borderRadius: '50%',
                          background: `linear-gradient(135deg, ${themeItem.uiAccent}, ${themeItem.foliageTip})`,
                          border: '1px solid rgba(255, 255, 255, 0.4)',
                          boxShadow: isActive
                            ? `0 0 10px ${themeItem.uiAccent}`
                            : 'none',
                        }}
                      />
                      <span>{themeItem.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Particle Density Slider */}
            <div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '6px',
                  fontSize: '12px',
                }}
              >
                <span style={{ color: 'rgba(255, 255, 255, 0.85)', fontWeight: 500 }}>
                  粒子密度
                </span>
                <span
                  style={{
                    color: activeTheme.uiAccent,
                    fontVariantNumeric: 'tabular-nums',
                    fontWeight: 700,
                  }}
                >
                  {settings.particleDensity.toFixed(1)}×
                </span>
              </div>
              <input
                type="range"
                aria-label="粒子密度"
                className="hud-range"
                min={0.4}
                max={1.5}
                step={0.1}
                value={settings.particleDensity}
                style={densityRangeStyle}
                onChange={(event) =>
                  onUpdateSettings({
                    particleDensity: Number.parseFloat(event.target.value),
                  })
                }
              />
            </div>

            {/* Bloom Intensity Slider */}
            <div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '6px',
                  fontSize: '12px',
                }}
              >
                <span style={{ color: 'rgba(255, 255, 255, 0.85)', fontWeight: 500 }}>
                  泛光强度
                </span>
                <span
                  style={{
                    color: activeTheme.uiAccent,
                    fontVariantNumeric: 'tabular-nums',
                    fontWeight: 700,
                  }}
                >
                  {settings.bloomIntensity.toFixed(1)}
                </span>
              </div>
              <input
                type="range"
                aria-label="泛光强度"
                className="hud-range"
                min={0.3}
                max={2.2}
                step={0.1}
                value={settings.bloomIntensity}
                style={bloomRangeStyle}
                onChange={(event) =>
                  onUpdateSettings({
                    bloomIntensity: Number.parseFloat(event.target.value),
                  })
                }
              />
            </div>

            {/* Show Polaroids Toggle */}
            <button
              type="button"
              aria-pressed={settings.showPhotos}
              onClick={() =>
                onUpdateSettings({ showPhotos: !settings.showPhotos })
              }
              className="hud-btn"
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '11px',
                border: `1px solid ${
                  settings.showPhotos
                    ? `${activeTheme.uiAccent}77`
                    : 'rgba(255, 255, 255, 0.14)'
                }`,
                background: settings.showPhotos
                  ? `${activeTheme.uiAccent}1a`
                  : 'rgba(255, 255, 255, 0.04)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '12px',
                fontWeight: 600,
              }}
            >
              <span>显示拍立得照片</span>
              <span
                style={{
                  padding: '2px 8px',
                  borderRadius: '999px',
                  fontSize: '10px',
                  fontWeight: 700,
                  letterSpacing: '0.06em',
                  background: settings.showPhotos
                    ? activeTheme.uiAccent
                    : 'rgba(255, 255, 255, 0.14)',
                  color: settings.showPhotos
                    ? '#0a0e14'
                    : 'rgba(255, 255, 255, 0.72)',
                }}
              >
                {settings.showPhotos ? 'ON' : 'OFF'}
              </span>
            </button>
          </div>
        )}
      </div>

      {/* Top-Center: AI Status Pill & Sleek Gesture Guide Strip */}
      <div
        style={{
          position: 'absolute',
          top: '16px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 22,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '7px',
          maxWidth: 'calc(100vw - 320px)',
        }}
      >
        <div
          className={`hud-glass${feedback.isError ? ' hud-glass-error' : ''}`}
          style={{
            padding: '5px 14px',
            borderRadius: '999px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '11px',
            fontWeight: 600,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: feedback.isError
              ? '#ffc5c5'
              : feedback.handPresent
                ? activeTheme.uiAccent
                : 'rgba(255, 255, 255, 0.78)',
            whiteSpace: 'nowrap',
          }}
        >
          <span
            aria-hidden="true"
            style={{
              width: '7px',
              height: '7px',
              borderRadius: '50%',
              background: feedback.isError
                ? '#ff5a5a'
                : feedback.handPresent
                  ? '#4ade80'
                  : activeTheme.uiAccent,
              boxShadow: feedback.isError
                ? '0 0 8px #ff5a5a'
                : feedback.handPresent
                  ? '0 0 8px #4ade80'
                  : `0 0 8px ${activeTheme.uiAccent}`,
            }}
          />
          <span>{feedback.status}</span>
        </div>

        <div
          className="hud-glass"
          style={{
            padding: '4px 6px',
            borderRadius: '999px',
            display: 'flex',
            alignItems: 'center',
            flexWrap: 'wrap',
            justifyContent: 'center',
            gap: '4px',
          }}
        >
          {guideItems.map((item) => (
            <span
              key={item.key}
              style={{
                padding: '3px 9px',
                borderRadius: '999px',
                fontSize: '11px',
                fontWeight: item.active ? 700 : 500,
                letterSpacing: '0.02em',
                whiteSpace: 'nowrap',
                color: item.active ? '#ffffff' : 'rgba(255, 255, 255, 0.66)',
                background: item.active
                  ? `${activeTheme.uiAccent}30`
                  : 'transparent',
                border: `1px solid ${
                  item.active ? `${activeTheme.uiAccent}aa` : 'transparent'
                }`,
                boxShadow: item.active
                  ? `0 0 12px ${activeTheme.uiAccent}33`
                  : 'none',
                transition: 'all 180ms ease',
              }}
            >
              {item.label}
            </span>
          ))}
        </div>
      </div>

      {/* Top-Right: Refined Stats (clear of bottom-left camera widget) */}
      <div
        className="hud-glass"
        style={{
          position: 'absolute',
          top: '16px',
          right: '16px',
          padding: '10px 14px',
          borderRadius: '14px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          minWidth: '166px',
        }}
      >
        <div>
          <div
            style={{
              fontSize: '10px',
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: 'rgba(255, 255, 255, 0.52)',
              marginBottom: '2px',
            }}
          >
            Memories
          </div>
          <div
            style={{
              fontSize: '20px',
              fontWeight: 700,
              lineHeight: 1.15,
              color: settings.showPhotos
                ? activeTheme.uiAccent
                : 'rgba(255, 255, 255, 0.45)',
            }}
          >
            {settings.showPhotos ? (
              <>
                {CONFIG.counts.ornaments.toLocaleString()}{' '}
                <span
                  style={{
                    fontSize: '10px',
                    fontWeight: 500,
                    letterSpacing: '0.12em',
                    color: 'rgba(255, 255, 255, 0.58)',
                  }}
                >
                  POLAROIDS
                </span>
              </>
            ) : (
              <span style={{ fontSize: '15px', letterSpacing: '0.14em' }}>
                HIDDEN
              </span>
            )}
          </div>
        </div>

        <div>
          <div
            style={{
              fontSize: '10px',
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: 'rgba(255, 255, 255, 0.52)',
              marginBottom: '2px',
            }}
          >
            Particles
          </div>
          <div
            style={{
              fontSize: '20px',
              fontWeight: 700,
              lineHeight: 1.15,
              color: '#eef6f3',
            }}
          >
            ~{particlesK}K{' '}
            <span
              style={{
                fontSize: '10px',
                fontWeight: 500,
                letterSpacing: '0.12em',
                color: 'rgba(255, 255, 255, 0.58)',
              }}
            >
              GLOWING NEEDLES
            </span>
          </div>
        </div>
      </div>

      {/* Bottom-Right: Camera Toggle & Assemble / Disperse Controls */}
      <div
        style={{
          position: 'absolute',
          bottom: '24px',
          right: '24px',
          pointerEvents: 'auto',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
        }}
      >
        <button
          type="button"
          onClick={onToggleCamera}
          aria-pressed={cameraVisible}
          className="hud-glass hud-btn"
          style={{
            height: '44px',
            padding: '0 16px',
            borderRadius: '12px',
            fontSize: '12px',
            fontWeight: 700,
            letterSpacing: '0.06em',
            color: cameraVisible ? '#0a0e14' : activeTheme.uiAccent,
            background: cameraVisible ? activeTheme.uiAccent : undefined,
            borderColor: cameraVisible
              ? activeTheme.uiAccent
              : `${activeTheme.uiAccent}66`,
          }}
        >
          {cameraVisible ? '隐藏镜头' : '📷 互动镜头'}
        </button>

        <button
          type="button"
          onClick={onToggleScene}
          className="hud-glass hud-btn"
          style={{
            height: '44px',
            padding: '0 24px',
            borderRadius: '12px',
            fontSize: '13px',
            fontWeight: 700,
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            color: activeTheme.uiAccent,
            borderColor: `${activeTheme.uiAccent}aa`,
            background: `linear-gradient(180deg, ${activeTheme.uiAccent}22, rgba(8, 12, 18, 0.74))`,
            boxShadow: `0 10px 26px rgba(0, 0, 0, 0.45), 0 0 18px ${activeTheme.uiAccent}2b`,
          }}
        >
          {sceneState === 'CHAOS' ? 'Assemble Tree' : 'Disperse'}
        </button>
      </div>
    </div>
  );
};
