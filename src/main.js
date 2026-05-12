import { createApp } from 'vue'
import App from './App.vue'

const style = document.createElement('style')
style.textContent = `
  * { margin: 0; padding: 0; box-sizing: border-box; font-family: 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif; }
  body { overflow: hidden; background-color: #e2e8f0; }
  button { outline: none; border: none; background: none; cursor: pointer; }
`
document.head.appendChild(style)

createApp(App).mount('#app')
