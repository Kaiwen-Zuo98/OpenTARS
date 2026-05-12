# 🌟 OpenTARS - AI 恋爱数字人 (前端交互终端)

![Vue.js](https://img.shields.io/badge/Vue.js-3.0-4FC08D?style=for-the-badge&logo=vuedotjs&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-5.0-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![WebAudio](https://img.shields.io/badge/Web_Audio_API-Enabled-FF6600?style=for-the-badge)
![WebSocket](https://img.shields.io/badge/WebSocket-RealTime-000000?style=for-the-badge)

OpenTARS 是一个沉浸式 AI 恋爱数字人的 Web 前端终端。本项目致力于提供极低延迟、极其自然的“人机全双工语音交互”体验。

摒弃了传统冰冷的文字聊天框，本项目采用了绝美的 **Glassmorphism (玻璃拟态)** UI 设计，并深度对接底层音频流，让你可以与 AI 伴侣进行如真人视频通话般的实时语音连线。

---

## ✨ 核心特性 (Features)

* **🎙️ 实时全双工语音 (Full-Duplex)**：基于 WebSocket 长连接，实现真正的“边听边说”。支持精准的**智能打断 (Interrupt)**，用户随时开口，AI 瞬间停止输出并倾听。
* **🔊 原生流式音频解码 (PCM Player)**：
  * 完美适配后端吐出的 `16-bit 16000Hz PCM` 裸流数据。
  * 彻底摒弃传统 Base64 URL 播放的延迟感，引入 `pcm-player` 开源库进行 `Float32` 转化与底层 AudioContext 挂载。
  * 内置 **Jitter Buffer (防抖缓冲)**，完美解决网络抖动带来的电流音、机械音与撕裂感。
* **🎤 专业级录音采集**：严格按照 `16000Hz` 单声道标准采集用户麦克风，底层强制唤起浏览器的 **AEC (回声消除)** 与 **ANS (噪音抑制)** 算法，防止扬声器声音回采导致的“无限套娃”。
* **🎨 纯手工玻璃拟态 UI**：零第三方 UI 组件库（无 Element / 无 Tailwind），极度轻量。所有的毛玻璃滤镜 (`backdrop-filter`)、光影渐变、以及根据 AI 说话状态联动的“呼吸仿生动画”均由原生 CSS 匠心打磨。
* **💕 沉浸式交互反馈**：好感度动态进度条、实时语音转写字幕、以及快捷情话一键发送。

---

## 📂 项目结构 (Structure)

```text
my-vue-chat/
├── public/                 # 静态资源 (Favicon等)
├── src/
│   ├── assets/             # 图片、全局 CSS (包含玻璃拟态样式)
│   │   └── my-avatar.png   # 默认数字人头像
│   ├── App.vue             # 核心应用逻辑 (WebSocket, PCM流处理, UI绑定)
│   └── main.js             # Vue 实例入口
├── index.html              # HTML 骨架
├── package.json            # 依赖配置 (包含 pcm-player, vue)
└── vite.config.js          # Vite 构建配置
