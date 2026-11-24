# 🎄 Interactive 3D Particle Christmas Tree

> 基于 **React 18**、**TypeScript**、**Three.js (React Three Fiber)** 与 **MediaPipe Tasks Vision** 打造的 3D 交互式粒子圣诞树 Web 应用。

在深邃星空与柔和光晕之中，由上万枚柔光粒子、螺旋流光丝带、合批彩灯装饰与悬浮拍立得共同构成一棵立体圣诞树。无需鼠标，站在摄像头前即可通过手势控制树体聚散、旋转俯仰，并能像“从树上摘下记忆”一样捏合手势把树上的照片拉到镜头前 3D 放大欣赏。

---

## ✨ 核心特性

- **电影级柔光粒子树**：
  - `Foliage` 采用自定义径向柔光羽化着色器与表面均匀圆锥分布，按树高混入主题渐变色与星尘闪点。
  - 新增 `RibbonParticles` 螺旋流光粒子带与 `TopStar` 立体五角星顶，开场 350ms 自动从粒子星云聚合成树（`CHAOS → FORMED`）。
- **高性能合批渲染**：
  - `FairyLights`（400 盏闪烁彩灯）与 `ChristmasElements`（200 个礼盒、球饰、拐杖糖）均基于 `THREE.InstancedMesh` 合批渲染（分别仅 1 次与 3 次 Draw Calls）。
  - `PhotoOrnaments` 采用双面渲染+镂空相框与克制的自发光强度，避免 Bloom 泛光把照片冲白，并消除 `useFrame` 逐帧对象分配。
- **AI 手势交互 & 防误触**：
  - 支持**张开散开**、**握拳聚合**、**手部左右旋转 / 上下俯仰**（带 `MathUtils.damp` 平滑阻尼），以及**拇指食指捏合 3D 摘取照片、松手平滑飞回树身**。
  - 内置连续帧防抖、迟滞双阈值与强握拳互斥判断，避免握拳聚树时误触发捏合摘图；支持关闭小窗后在后台持续识别。
- **毛玻璃 HUD 与主题工坊**：
  - 页面正中央展示 `Merry Christmas!` 艺术花体标题（捏合摘图时自动淡出让位）。
  - 左上角可折叠 `⚙ 视觉设置` 面板：一键切换 **经典绿金 / 冰雪蓝银 / 暖粉星夜** 3 套主题，实时调节粒子密度（`0.4×–1.5×`）、泛光强度（`0.3–2.2`）与拍立得显示开关。
  - 左下角提供可随时关闭/重开的 `实时手势镜头` 镜像小窗，叠加手部关键点骨骼连线与当前识别状态徽章。
- **零配置照片加载 & 本地优先 WASM**：
  - 通过 `vite.config.ts` 的 `virtual:photos` 插件自动扫描 `public/photos/` 目录下的 `.png` / `.jpg` / `.jpeg` / `.webp` / `.gif` 图片，增删文件无需修改任何代码。
  - MediaPipe WASM 已预置在 `public/mediapipe/wasm/` 优先本地加载（异常时自动回退 CDN）。

---

## 🛠️ 技术栈

- **框架与构建**：React 18、TypeScript 5.6、Vite 5
- **3D 渲染与后处理**：Three.js、`@react-three/fiber`、`@react-three/drei`、`@react-three/postprocessing`
- **AI 手势识别**：`@mediapipe/tasks-vision`（`GestureRecognizer`）

---

## 🚀 快速开始

### 1. 环境准备
确保已安装 [Node.js](https://nodejs.org/)（建议 v18 或更高版本）。

### 2. 克隆与安装依赖
```bash
git clone https://github.com/Aoxuan-666/Particle-Christmas-Tree.git
cd Particle-Christmas-Tree
npm install
```

### 3. 启动本地开发服务器
```bash
npm run dev
```

> **Windows PowerShell 提示**：若遇到 `无法加载文件 npm.ps1，因为在此系统上禁止运行脚本` 报错，可直接使用 `npm.cmd`：
> ```powershell
> npm.cmd install
> npm.cmd run dev
> ```

启动后在浏览器打开终端提示的 `http://localhost:5173/`，并按提示**允许摄像头权限**。待顶部状态胶囊变为 `AI READY: SHOW HAND` 即可开始互动。

### 4. 其他常用脚本
| 命令 | 说明 |
| --- | --- |
| `npm run build` | TypeScript 类型检查并打包生产版本至 `dist/` |
| `npm run lint` | 运行 ESLint 代码规范检查 |
| `npm run preview` | 本地预览 `dist/` 打包产物 |

---

## 🖐️ 手势与界面控制说明

| 手势 / 操作 | 触发条件 | 效果 |
| --- | --- | --- |
| 🖐 **张开手掌** (`Open_Palm`) | 连续 5 帧识别确认 | 圣诞树散开为漫天粒子星云与悬浮照片（`CHAOS`） |
| ✊ **握紧拳头** (`Closed_Fist`) | 连续 5 帧识别确认 | 所有粒子、彩灯与照片聚合成完整圣诞树（`FORMED`） |
| 👋 **手掌上下 / 左右移动** | 手掌在画面中平移 | 控制圣诞树旋转速度与俯仰视角（带惯性阻尼） |
| 👌 **捏合摘图** (`Pinch`) | 拇指与食指捏合且其余手指伸展（类似 OK 手势） | 从树身或星云中摘取正前方照片至镜头前金色边框 3D 放大，松手自动归位 |
| 🖱️ **鼠标 / 界面按钮** | 无需摄像头也可使用 | 鼠标拖拽旋转/滚轮缩放；右下角支持一键 `Assemble Tree` / `Disperse` 与显示/隐藏左下角镜头小窗 |

---

## 🖼️ 自定义照片与进阶配置

### 添加或替换你自己的照片
直接把图片放入项目根目录下的 `public/photos/` 文件夹即可：
- **支持格式**：`.png`、`.jpg`、`.jpeg`、`.webp`、`.gif`（文件名任意，程序按自然顺序排序并循环挂载到 120 个拍立得相框上）。
- **热更新说明**：在 `public/photos/` 中**新增或删除**图片文件时，Vite 开发服务器会自动刷新页面；若仅用同名文件覆盖原图，手动刷新浏览器即可生效。
- **图片建议**：拍立得画面区域为 `1:1` 正方形，建议选用正方形或近方形图片，单张控制在 1MB 以内以保持流畅加载。

### 进阶参数调整
- **配色主题、粒子数量与树体尺寸**：编辑 `src/config.ts` 中的 `THEMES`、`DEFAULT_SETTINGS` 与 `CONFIG`（默认树叶粒子 `18000`、螺旋光带 `3000`、拍立得 `120`、装饰 `200`、彩灯 `400`）。
- **手势灵敏度与旋转倍率**：编辑 `src/components/GestureController.tsx` 顶部的 `HORIZONTAL_DEADZONE`、`PINCH_ENTER_RATIO`、`PINCH_EXIT_RATIO` 以及水平速度倍率（当前 `0.22`）。

---

## 📁 项目结构

```text
├── index.html                        # 页面入口与艺术字字体引入
├── vite.config.ts                    # Vite 配置与 public/photos 自动扫描虚拟模块
├── public/
│   ├── mediapipe/wasm/               # 本地优先加载的 MediaPipe WASM 运行时
│   └── photos/                       # 圣诞树挂载照片目录（支持自动发现）
└── src/
    ├── App.tsx                       # 3D 场景主入口、阻尼相机控制与状态协调
    ├── config.ts                     # 3 套主题配色、默认视觉参数与粒子/装饰数量配置
    ├── index.css                     # 全屏重置、毛玻璃控件与艺术字渐变样式
    ├── vite-env.d.ts                 # virtual:photos 模块类型声明
    └── components/
        ├── ParticleTree.tsx          # Foliage 柔光粒子、RibbonParticles 螺旋光带、TopStar 树顶星
        ├── TreeDecorations.tsx       # InstancedMesh 彩灯/装饰与 3D 捏合摘取 PhotoOrnaments
        ├── GestureController.tsx     # MediaPipe 手势识别、防误触状态机与左下角实时镜头小窗
        └── HudOverlay.tsx            # 中央艺术字、手势引导条、视觉设置面板与控制按钮
```

---

## 💡 常见问题与离线模型说明

1. **摄像头无法打开**
   - 浏览器限制摄像头仅可在 `http://localhost` 或 `https://` 环境下调用，并需要授予摄像头访问权限。
   - 若页面未检测到摄像头或权限被拒，左下角小窗会提示对应状态，此时仍可使用鼠标拖拽和界面按钮体验全部视觉效果。
2. **关于手势识别模型（`.task`）联网加载**
   - 运行时 MediaPipe WASM 优先从本地 `public/mediapipe/wasm/` 加载；手势模型会先探测本地 `public/mediapipe/gesture_recognizer.task`，若未放置则自动从 Google Storage CDN 拉取。
   - 如需完全离线使用手势识别，可自行下载 `gesture_recognizer.task` 放到 `public/mediapipe/gesture_recognizer.task`：
     `https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task`

---

## 📄 License & 致谢

- 基于 [moleculemmeng020425/christmas-tree](https://github.com/moleculemmeng020425/christmas-tree) 进行性能优化、视觉升级与手势交互重构。
- MIT License. Feel free to use and customize for your own celebrations!
