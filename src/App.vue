<script setup>
import { ref } from 'vue';

// --- Reactive State ---

// 1. Avatar URL
import defaultAvatar from './assets/my-avatar.png';
const avatarUrl = ref(defaultAvatar);
// 2. Transcipt Area content
const transcript = ref('字幕会显示在这里…');

// 3. Affection Level (0-100)
const affectionLevel = ref(60);

// 4. Recording State for animation and simulation
const isRecording = ref(false);

// Ref for hidden file input
const fileInputRef = ref(null);

// --- Methods ---

const handleUploadClick = () => {
  if (fileInputRef.value) {
    fileInputRef.value.click();
  }
};

const handleFileChange = (e) => {
  const file = e.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = (event) => {
      avatarUrl.value = event.target.result;
    };
    reader.readAsDataURL(file);
  }
};

const toggleRecording = () => {
  isRecording.value = !isRecording.value;
  
  if (isRecording.value) {
    transcript.value = '正在聆听您的心声...';
  } else {
    simulateTranscription();
  }
};

const handleQuickReply = (text) => {
  transcript.value = `用户：${text}`;
  isRecording.value = false;
};

const simulateTranscription = () => {
  setTimeout(() => {
    const dummyInputs = [
      '今天在外面看到一朵很像你的云☁️',
      '工作有点累了，求安慰😔',
      '你今天过得开心吗？'
    ];
    transcript.value = `用户：${dummyInputs[Math.floor(Math.random() * dummyInputs.length)]}`;
  }, 1000);
};
</script>

<template>
  <div class="app-wrapper">
    <div class="pc-container glass-bg">
      
      <header class="top-bar">
        <button class="back-btn">&#10094;</button>
        
        <div class="progress-container glass">
          <span class="progress-label">好感进度</span>
          <div class="progress-track">
            <div class="progress-fill" :style="{ width: affectionLevel + '%' }"></div>
          </div>
          <span class="progress-percent">{{ affectionLevel }}%</span>
        </div>

        <img :src="avatarUrl" alt="User Avatar" class="header-avatar glass-border" />
      </header>

      <main class="main-content-area">
        
        <div class="avatar-section">
          <div class="avatar-view">
            <img :src="avatarUrl" alt="AI Companion" class="main-avatar" />
            <input type="file" accept="image/*" ref="fileInputRef" class="hidden-input" @change="handleFileChange" />
            <button class="change-avatar-btn glass" @click="handleUploadClick">
              &#8634; 更换形象
            </button>
          </div>

          <div class="ai-chat-bubble glass">
            <p>终于等到你啦～今天有没有想我？我刚刚还在想，等你上线后第一句话要说什么才会让你开心一点。</p>
          </div>
        </div>

        <section class="transcript-area">
          <div class="user-transcript-card glass-dark">
            {{ transcript }}
          </div>
        </section>

        <section class="quick-actions">
          <button class="action-btn glass" @click="handleQuickReply('想你了')">💕 想你了</button>
          <button class="action-btn glass" @click="handleQuickReply('今天累了')">😓 今天累了</button>
          <button class="action-btn glass" @click="handleQuickReply('哄我睡觉')">🌙 哄我睡觉</button>
          <button class="action-btn glass" @click="handleQuickReply('夸夸我')">✨ 夸夸我</button>
        </section>

      </main> <footer class="bottom-input-area">
        <div class="input-controls glass">
          <button class="icon-btn keyboard-btn">&#9000;</button>
          
          <button class="speak-btn-main" :class="{ 'recording': isRecording }" @click="toggleRecording">
            <template v-if="!isRecording">
              <span class="mic-icon">🎤</span>
              <span class="speak-text">按住说话</span>
            </template>
            <template v-else>
              <div class="waveform">
                <span class="bar" style="animation-delay: 0.0s;"></span>
                <span class="bar" style="animation-delay: 0.1s;"></span>
                <span class="bar" style="animation-delay: 0.2s;"></span>
                <span class="bar" style="animation-delay: 0.3s;"></span>
                <span class="bar" style="animation-delay: 0.1s;"></span>
                <span class="bar" style="animation-delay: 0.0s;"></span>
              </div>
              <span class="speak-text recording-text">正在录音...</span>
            </template>
          </button>

          <button class="icon-btn send-btn">&#10095;</button>
        </div>
        <div class="footer-note">AI 生成</div>
      </footer>

    </div>
  </div>
</template>

<style scoped>
/* 基础设置 */
.hidden-input { display: none; }

.app-wrapper {
  width: 100vw;
  height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
  background: linear-gradient(120deg, #e0f2fe 0%, #fce7f3 50%, #f3e8ff 100%);
}

.pc-container {
  width: 100%;
  max-width: 900px;
  height: 95vh;
  border-radius: 32px;
  box-shadow: 0 30px 60px rgba(0,0,0,0.1);
  /* 关键布局设置：纵向排列 */
  display: flex;
  flex-direction: column;
  position: relative;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.7);
}

.glass-bg {
  background: rgba(255, 255, 255, 0.3);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
}
.glass {
  background: rgba(255, 255, 255, 0.75);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.8);
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.03);
}
.glass-dark {
  background: rgba(0, 0, 0, 0.1);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

/* 1. 顶部栏 */
.top-bar {
  /* 防止被压缩 */
  flex-shrink: 0; 
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 30px;
  z-index: 10;
}
.back-btn {
  background: rgba(255,255,255,0.6); border: none; width: 45px; height: 45px;
  border-radius: 50%; font-size: 20px; color: #777; cursor: pointer;
  display: flex; align-items: center; justify-content: center; transition: background 0.2s;
}
.back-btn:hover { background: rgba(255,255,255,0.9); }
.progress-container {
  display: flex; align-items: center; padding: 10px 20px;
  border-radius: 25px; font-size: 14px; color: #f472b6; font-weight: 500;
}
.progress-track {
  width: 120px; height: 8px; background: rgba(255,255,255,0.6);
  border-radius: 4px; margin: 0 12px; overflow: hidden;
}
.progress-fill {
  height: 100%; background: linear-gradient(90deg, #f472b6, #c084fc);
  border-radius: 4px; transition: width 0.3s ease-out;
}
.header-avatar {
  width: 50px; height: 50px; border-radius: 50%; object-fit: cover;
  border: 3px solid rgba(255,255,255,0.9); box-shadow: 0 5px 15px rgba(0,0,0,0.1);
}

/* 2. 中间主要内容区 (关键) */
.main-content-area {
  /* 撑满剩余空间，内容过多时可以滚动，保证不挤压顶部和底部 */
  flex: 1; 
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  /* 隐藏滚动条但保留功能 */
  scrollbar-width: none; 
}
.main-content-area::-webkit-scrollbar { display: none; }

.avatar-section {
  display: flex; flex-direction: column; align-items: center; width: 100%;
}
.avatar-view {
  position: relative; width: 350px; height: 350px; display: flex; justify-content: center;
}
.main-avatar {
  width: 100%; height: 100%; object-fit: contain;
  mask-image: linear-gradient(to bottom, black 85%, transparent 100%);
  -webkit-mask-image: linear-gradient(to bottom, black 85%, transparent 100%);
}
.change-avatar-btn {
  position: absolute; top: 10px; right: -20px; padding: 8px 16px;
  border-radius: 20px; font-size: 13px; color: #555; cursor: pointer; transition: transform 0.2s;
}
.change-avatar-btn:hover { transform: scale(1.05); }

.ai-chat-bubble {
  position: relative; margin-top: -30px; width: 85%; max-width: 550px;
  padding: 25px; border-radius: 28px; border-top-left-radius: 6px;
  color: #444; font-size: 16px; line-height: 1.7; z-index: 5;
}

.transcript-area { width: 100%; display: flex; justify-content: center; margin-top: 15px; }
.user-transcript-card {
  width: 85%; max-width: 550px; padding: 15px 25px; border-radius: 20px;
  color: rgba(255,255,255,0.85); font-size: 14px; font-style: italic; text-align: center;
}

.quick-actions {
  display: flex; justify-content: center; gap: 12px; margin-top: 20px;
  padding: 0 30px; flex-wrap: wrap; margin-bottom: 20px; /* 留点底部边距 */
}
.action-btn {
  padding: 10px 20px; border-radius: 25px; font-size: 14px; color: #666;
  cursor: pointer; display: flex; align-items: center; gap: 8px; transition: all 0.2s;
}
.action-btn:hover { background: rgba(255,255,255,0.95); transform: translateY(-2px); }

/* 3. 底部输入区 (关键) */
.bottom-input-area {
  /* 防止被压缩，固定在容器最底端 */
  flex-shrink: 0; 
  width: 100%;
  padding: 20px 30px 25px 30px; /* 调整内边距 */
  display: flex;
  flex-direction: column;
  align-items: center;
  /* 加一个微弱的渐变背景，如果内容滚动可以起到遮罩效果 */
  background: linear-gradient(to bottom, transparent, rgba(255,255,255,0.4) 30%);
}

.input-controls {
  width: 90%; max-width: 600px; height: 70px; border-radius: 35px;
  display: flex; align-items: center; justify-content: space-between;
  padding: 0 15px; position: relative;
}

.icon-btn {
  background: transparent; border: none; width: 50px; height: 50px;
  font-size: 24px; color: #999; cursor: pointer; display: flex;
  align-items: center; justify-content: center; border-radius: 50%; transition: color 0.2s;
}
.icon-btn:hover { color: #f472b6; }
.send-btn { color: #f472b6; }

.speak-btn-main {
  position: absolute; left: 50%; transform: translateX(-50%);
  background: #f472b6; border: none; width: 160px; height: 50px;
  border-radius: 25px; color: white; display: flex; align-items: center;
  justify-content: center; gap: 10px; cursor: pointer;
  box-shadow: 0 5px 15px rgba(244,114,182,0.3); transition: all 0.3s ease;
}
.speak-btn-main:hover { background: #f06292; box-shadow: 0 8px 20px rgba(244,114,182,0.4); }
.speak-btn-main.recording {
  background: #db2777; width: 170px; box-shadow: 0 0 20px rgba(219,39,119,0.5);
}

.mic-icon { font-size: 20px; }
.speak-text { font-size: 15px; font-weight: 500; }
.recording-text { color: rgba(255,255,255,0.8); }

.waveform { display: flex; align-items: center; gap: 3px; height: 20px; }
.bar {
  width: 3px; height: 100%; background-color: white; border-radius: 2px;
  animation: pulse 0.8s infinite ease-in-out;
}
@keyframes pulse {
  0%, 100% { transform: scaleY(0.4); opacity: 0.6; }
  50% { transform: scaleY(1.1); opacity: 1; }
}

.footer-note { margin-top: 10px; font-size: 12px; color: #adb5bd; }
</style>