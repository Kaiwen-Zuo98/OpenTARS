<script setup>
let nextPlayTime = 0; // 记录下一个音频块应该在什么时间播放
let audioSources = []; // 收集当前正在播放的音频节点，用于精准打断
let pingInterval = null;
// 在之前的 nextPlayTime 附近新增这个变量
let leftoverByte = null;
import { ref, onMounted, onUnmounted } from 'vue';
import PCMPlayer from 'pcm-player'; // 引入开源库

const sampleRate = 24000;

// ... 原本的其他变量 ...
let pcmPlayer = null; // 替换原本的 playAudioContext 等变量

// --- 引入本地默认头像 (请确保路径正确，否则会报错) ---
// 如果没有该本地文件，请替换为一个网络图片 URL 字符串
import defaultAvatar from './assets/my-avatar.png'; 

// === 1. 响应式状态 (UI 绑定) ===
const avatarUrl = ref(defaultAvatar);
const transcript = ref('字幕会显示在这里…');
// 将原来的硬编码文案提取为响应式变量，方便后续 WebSocket 更新
const currentMessage = ref('终于等到你啦～今天有没有想我？我刚刚还在想，等你上线后第一句话要说什么才会让你开心一点。');
const affectionLevel = ref(60);

const isRecording = ref(false);
const isSpeaking = ref(false); // 用于记录 AI 是否正在说话
const fileInputRef = ref(null);

// === 2. WebSocket 与音频底层变量 ===
// TODO: 替换为你真实的服务器地址
const WS_URL = 'ws://172.16.29.39:18888/ws'; 
let ws = null;

// 录音相关 (麦克风)
let recordAudioContext = null;
let mediaStream = null;
let scriptProcessor = null;

// 播放相关 (AI 声音)
let playAudioContext = null;
let currentPlaySource = null;

// === 3. UI 交互方法 ===
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

const handleQuickReply = (text) => {
  transcript.value = `用户：${text}`;
  isRecording.value = false;
  // 此处可扩展为通过 WS 发送文本给服务端（如果协议支持）
};

// === 4. WebSocket 初始化与事件处理 ===
const initWebSocket = () => {
  ws = new WebSocket(WS_URL);
  
  ws.onopen = () => {
    console.log('✅ WebSocket 已连接');
    
    // 💡 新增：开启心跳保活，每 8 秒向服务端发送一次 ping
    pingInterval = setInterval(() => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        // 根据标准的 JSON 交互格式，发送一个心跳事件
        ws.send(JSON.stringify({ 
          event: 'client.ping', // 事件名可以根据你后端的实际情况调整
          data: {} 
        }));
        console.log('💓 发送保活心跳');
      }
    }, 8000); // 8秒 < 10秒超时限制
  };

  ws.onerror = (e) => console.error('❌ WebSocket 错误', e);
  
  ws.onclose = () => {
    console.log('⚠️ WebSocket 已断开，尝试重连...');
    
    // 💡 新增：断开连接时，务必清理定时器，防止内存泄漏
    if (pingInterval) {
      clearInterval(pingInterval);
      pingInterval = null;
    }
    
    // 3秒后尝试重连
    setTimeout(initWebSocket, 3000);
  };

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    
    // 💡 新增：如果服务端回复了 pong，可以选择忽略或打印
    if (msg.event === 'server.pong') {
      console.log('💚 收到服务端 pong');
      return; 
    }

    // console.log(msg.event, msg.data.length);

    switch(msg.event) {
      case 'server.input.transcript': 
        transcript.value = msg.data.text;
        break;
      case 'server.response.transcript': 
        currentMessage.value = msg.data.text;
        break;
      case 'server.response.audio': 
        isSpeaking.value = true;
        // 【修改点】：不再依赖服务端的 sample_rate 字段，强制传入 16000
        playBase64PCM(msg.data.data, msg.data.sample_rate);
        break;
      case 'server.tts.sentence.end': 
        isSpeaking.value = false;
        break;
      case 'server.response.audio.interrupt': 
        stopAudioPlayback();
        isSpeaking.value = false;
        break;
    }
  };
};

// === 5. 音频采集与发送 (麦克风 -> PCM -> Base64 -> WS) ===

const startRecording = async () => {
  try {
    // 【修复 1】：趁着用户点击了录音按钮，立刻唤醒并激活播放器！绕过浏览器的静音限制
    if (!playAudioContext) {
      playAudioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (playAudioContext.state === 'suspended') {
      await playAudioContext.resume();
    }
    nextPlayTime = playAudioContext.currentTime; // 同步当前时间

    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ event: 'client.input_audio_buffer.clear', data: {} }));
    }
    stopAudioPlayback(); 

    mediaStream = await navigator.mediaDevices.getUserMedia({ 
      audio: {
        echoCancellation: true,  
        noiseSuppression: true,  
        autoGainControl: true,   
        sampleRate: sampleRate,       
        channelCount: 1          
      } 
    });

    recordAudioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
    const source = recordAudioContext.createMediaStreamSource(mediaStream);
    scriptProcessor = recordAudioContext.createScriptProcessor(4096, 1, 1);
    
    scriptProcessor.onaudioprocess = (e) => {
      if (!isRecording.value) return;
      
      const float32Array = e.inputBuffer.getChannelData(0);
      const int16Array = new Int16Array(float32Array.length);
      
      for (let i = 0; i < float32Array.length; i++) {
        let s = Math.max(-1, Math.min(1, float32Array[i]));
        int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
      }
      
      const buffer = new Uint8Array(int16Array.buffer);
      let binary = '';
      for (let i = 0; i < buffer.byteLength; i++) {
        binary += String.fromCharCode(buffer[i]);
      }
      const base64 = window.btoa(binary);

      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          event: 'client.input.audio.append',
          data: { format: 'pcm', sample_rate: sampleRate, data: base64 }
        }));
      }
    };

    source.connect(scriptProcessor);
    scriptProcessor.connect(recordAudioContext.destination);
    
    isRecording.value = true;
    transcript.value = "正在聆听...";
  } catch (err) {
    console.error("麦克风权限获取或设置失败:", err);
    transcript.value = "请允许麦克风权限";
  }
};

const stopRecording = () => {
  isRecording.value = false;
  if (scriptProcessor) scriptProcessor.disconnect();
  if (mediaStream) mediaStream.getTracks().forEach(track => track.stop());
  if (recordAudioContext) recordAudioContext.close();
  transcript.value = "录音已结束"; // 临时显示，等服务端推送 server.input.transcript 覆盖
};

const toggleRecording = () => {
  if (isRecording.value) stopRecording();
  else startRecording();
};

const sendMessage = () => {
  // 可以在这里拓展手动发送逻辑
  if (isRecording.value) stopRecording();
};

// === 6. 音频播放解码 (Base64 -> PCM -> AudioContext) ===
// === 6. 音频播放解码 (使用开源库 pcm-player) ===

const playBase64PCM = (base64Data, sample_rate) => {
  // 1. 初始化或恢复播放器
  if (!pcmPlayer) {
    pcmPlayer = new PCMPlayer({
      inputCodec: 'Int16',   // 声明服务端传来的是 16位 PCM
      channels: 1,           // 单声道
      sampleRate: sample_rate,     // 目标采样率 24000Hz
      flushTime: 100         // 【内置防抖缓冲】：每 100ms 作为一个播放块，彻底解决卡顿和撕裂音
    });
    console.log("🔊 PCM Player 初始化完成！");
  }

  // 2. Base64 字符串解码与跨包错位处理（这点开源库不管，需要业务保留）
  const binary = window.atob(base64Data);
  let bytesArray = [];
  if (leftoverByte !== null) {
    bytesArray.push(leftoverByte);
    leftoverByte = null;
  }
  for (let i = 0; i < binary.length; i++) {
    bytesArray.push(binary.charCodeAt(i));
  }
  
  if (bytesArray.length % 2 !== 0) {
    leftoverByte = bytesArray.pop(); // 抠出奇数字节给下一个包
  }
  
  if (bytesArray.length === 0) return;

  const bytes = new Uint8Array(bytesArray);

  // 3. 喂给开源库！(它内部会自动转 Float32 并严格按时间轴排队播放)
  pcmPlayer.feed(bytes);

  // 4. 模拟播放完成反馈 (pcm-player 是合并流，不提供单个分片的 onended 事件)
  // 我们通过公式计算出这个分片的准确播放时长，用 setTimeout 来发送 played 回调
  // 公式: 时长(毫秒) = (字节数 / 2 (16位占2字节) / 24000 (采样率)) * 1000
  const durationMs = (bytes.length / 2 / sample_rate) * 1000;
  
  setTimeout(() => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        event: 'client.response.audio.feedback',
        data: { event: 'played' }
      }));
    }
  }, durationMs);
};

// 完善打断机制
const stopAudioPlayback = () => {
  if (pcmPlayer) {
    pcmPlayer.destroy(); // 直接销毁实例，清空所有排队的音频
    pcmPlayer = null;
  }
  leftoverByte = null; // 清空残留字节
};


// === 7. 生命周期挂载 ===
onMounted(() => {
  initWebSocket();
});

onUnmounted(() => {
  if (pingInterval) clearInterval(pingInterval);
  if (ws) ws.close();
  stopRecording();
  stopAudioPlayback();
});
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
            <img :src="avatarUrl" alt="AI Companion" class="main-avatar" :class="{'speaking': isSpeaking}" />
            <input type="file" accept="image/*" ref="fileInputRef" class="hidden-input" @change="handleFileChange" />
            <button class="change-avatar-btn glass" @click="handleUploadClick">
              &#8634; 更换形象
            </button>
          </div>

          <div class="ai-chat-bubble glass">
            <p>{{ currentMessage }}</p>
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

      </main> 

      <footer class="bottom-input-area">
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

          <button class="icon-btn send-btn" @click="sendMessage">&#10095;</button>
        </div>
        <div class="footer-note">AI 生成</div>
      </footer>

    </div>
  </div>
</template>

<style scoped>
/* =========== 保留你原本的所有绝美 CSS =========== */

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

/* 2. 中间主要内容区 */
.main-content-area {
  flex: 1; 
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  align-items: center;
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
  transition: transform 0.3s ease;
}
.main-avatar.speaking {
  /* 当 AI 说话时，稍微放大，增加呼吸/互动感 */
  transform: scale(1.02);
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
  padding: 0 30px; flex-wrap: wrap; margin-bottom: 20px; 
}
.action-btn {
  padding: 10px 20px; border-radius: 25px; font-size: 14px; color: #666;
  cursor: pointer; display: flex; align-items: center; gap: 8px; transition: all 0.2s;
}
.action-btn:hover { background: rgba(255,255,255,0.95); transform: translateY(-2px); }

/* 3. 底部输入区 */
.bottom-input-area {
  flex-shrink: 0; 
  width: 100%;
  padding: 20px 30px 25px 30px; 
  display: flex;
  flex-direction: column;
  align-items: center;
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