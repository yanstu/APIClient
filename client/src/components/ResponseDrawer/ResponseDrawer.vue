<template>
  <view class="response-drawer-container">
    <!-- Mask for clicking outside to close -->
    <view class="drawer-mask" v-if="uiState.isResponseOpen" @click="closeDrawer"></view>
    <view 
      class="response-drawer" 
      :class="{ 'is-open': uiState.isResponseOpen, 'has-data': responseData.status > 0, 'is-dragging': isDragging }"
      :style="{ height: uiState.isResponseOpen ? drawerHeight + 'px' : '100rpx' }"
    >
      <!-- Drag Handle Area -->
      <view 
        class="drawer-header" 
        @touchstart="onDragStart"
        @touchmove.stop.prevent="onDragMove"
        @touchend="onDragEnd"
      >
        <view class="drawer-handle-wrap" @click.stop="toggleDrawer">
          <view class="drawer-handle"></view>
        </view>
        
        <view class="status-bar" v-if="responseData.status || uiState.isLoading">
          <view v-if="uiState.isLoading" class="loading-pulse">发送请求中...</view>
          <block v-else>
            <view class="status-badge" :class="statusColorClass">
              {{ responseData.status }} {{ responseData.statusText }}
            </view>
            <view class="meta-info">
              <view class="meta-item"><text class="icon-text">⏱</text> {{ responseData.time }} ms</view>
              <view class="meta-item"><text class="icon-text">📦</text> {{ responseData.size }}</view>
            </view>
          </block>
        </view>
        <view class="status-bar" v-else @click="toggleDrawer">
          <text class="placeholder-text">响应结果将显示在这里</text>
        </view>
      </view>

      <!-- Drawer Content -->
      <view class="drawer-content-wrapper" v-show="uiState.isResponseOpen">
        <!-- Res Sub Tabs -->
        <view class="res-tabs">
          <text class="res-tab" :class="{active: uiState.resTab === 'body'}" @click="uiState.resTab = 'body'">响应体(Body)</text>
          <text class="res-tab" :class="{active: uiState.resTab === 'headers'}" @click="uiState.resTab = 'headers'">响应头(Headers)</text>
          <view style="flex:1"></view>
          <view class="copy-btn" @click="copyResponse" v-if="responseData.data !== null && responseData.data !== undefined">
             <text class="icon-text">📄</text> 复制
          </view>
        </view>
        
        <scroll-view scroll-y class="drawer-scroll">
          <view v-if="uiState.isLoading" class="skeleton-loader">
             <view class="line w-80"></view>
             <view class="line w-100"></view>
             <view class="line w-60"></view>
          </view>
          
          <block v-else>
            <!-- Body Content (Syntax Highlighted or Media) -->
            <view v-show="uiState.resTab === 'body'" class="code-block" @longpress="!isMedia && copyResponse()">
               <!-- Render Media Check -->
               <view class="media-container" v-if="isMedia">
                 <image v-if="mediaType === 'image'" :src="responseData.data" mode="widthFix" class="media-preview" :show-menu-by-longpress="true"></image>
                 <video v-if="mediaType === 'video'" :src="responseData.data" controls class="media-preview"></video>
               </view>
               <!-- Fallback to JSON Viewer -->
               <NbJsonViewer v-else :data="responseData.data" />
            </view>
            
            <!-- Headers Content -->
            <view v-show="uiState.resTab === 'headers'" class="headers-block">
              <view class="res-header-row" v-for="(val, key) in responseData.headers" :key="key">
                <text class="res-header-key" user-select="true">{{ key }}:</text>
                <text class="res-header-val" user-select="true">{{ val }}</text>
              </view>
              <view v-if="!responseData.headers || Object.keys(responseData.headers).length === 0" class="empty-state">
                <text>无响应头</text>
              </view>
            </view>
          </block>
        </scroll-view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed } from 'vue';
import NbJsonViewer from '../NbJsonViewer/NbJsonViewer.vue';

const props = defineProps({
  uiState: { type: Object, required: true },
  responseData: { type: Object, required: true }
});

const sysInfo = uni.getSystemInfoSync();
const windowHeight = sysInfo.windowHeight;

const MIN_DRAWER_HEIGHT = uni.upx2px(100);
const MAX_DRAWER_HEIGHT = windowHeight * 0.85;
const drawerHeight = ref(MAX_DRAWER_HEIGHT);
const isDragging = ref(false);

let startY = 0;
let startHeight = 0;

const statusColorClass = computed(() => {
  const s = props.responseData.status;
  if (!s) return '';
  if (s >= 200 && s < 300) return 'is-success';
  if (s >= 300 && s < 400) return 'is-redirect';
  if (s >= 400 && s < 500) return 'is-warning';
  return 'is-error';
});

const isMedia = computed(() => {
  return typeof props.responseData.data === 'string' && props.responseData.data.startsWith('data:');
});
const mediaType = computed(() => {
  if (!isMedia.value) return null;
  if (props.responseData.data.startsWith('data:image/')) return 'image';
  if (props.responseData.data.startsWith('data:video/')) return 'video';
  return null;
});

const toggleDrawer = () => {
  if (props.responseData.status > 0 || props.uiState.isLoading) {
    props.uiState.isResponseOpen = !props.uiState.isResponseOpen;
    if (props.uiState.isResponseOpen) {
      drawerHeight.value = MAX_DRAWER_HEIGHT;
    }
  }
};

const closeDrawer = () => {
  props.uiState.isResponseOpen = false;
};

const onDragStart = (e) => {
  if (!props.uiState.isResponseOpen) return;
  isDragging.value = true;
  startY = e.touches[0].clientY;
  startHeight = drawerHeight.value;
};

const onDragMove = (e) => {
  if (!props.uiState.isResponseOpen || !isDragging.value) return;
  const currentY = e.touches[0].clientY;
  const deltaY = startY - currentY; // positive means dragging up
  
  let newHeight = startHeight + deltaY;
  
  if (newHeight > MAX_DRAWER_HEIGHT) newHeight = MAX_DRAWER_HEIGHT;
  if (newHeight < MIN_DRAWER_HEIGHT) newHeight = MIN_DRAWER_HEIGHT;
  
  drawerHeight.value = newHeight;
};

const onDragEnd = () => {
  if (!props.uiState.isResponseOpen) return;
  isDragging.value = false;
  // If dragged down enough, close it
  if (drawerHeight.value < windowHeight * 0.3) {
    closeDrawer();
    drawerHeight.value = MAX_DRAWER_HEIGHT; // reset for next open
  } else {
    // Snap back to full height
    drawerHeight.value = MAX_DRAWER_HEIGHT;
  }
};

const copyResponse = () => {
  if (props.responseData.data === null || props.responseData.data === undefined) return;
  const str = typeof props.responseData.data === 'string' ? props.responseData.data : JSON.stringify(props.responseData.data, null, 2);
  uni.setClipboardData({
    data: str,
    success: () => {
      uni.showToast({ title: '已复制到剪贴板', icon: 'none' });
    }
  });
};
</script>

<style scoped>
.response-drawer-container {
  width: 100%;
}

.drawer-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: transparent;
  z-index: 90;
}

.response-drawer {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background-color: var(--bg-panel);
  border-top: 1px solid var(--border-light);
  border-radius: 32rpx 32rpx 0 0;
  transition: height 0.4s cubic-bezier(0.2, 0.8, 0.2, 1);
  display: flex;
  flex-direction: column;
  z-index: 100;
  box-shadow: 0 -20rpx 60rpx rgba(0, 0, 0, 0.4);
}

.response-drawer.is-dragging {
  /* Disable transition during drag to prevent sluggishness/stuttering */
  transition: none;
}

.response-drawer.has-data:not(.is-open) {
  cursor: pointer;
}

.drawer-header {
  padding: 0 32rpx 20rpx;
}

.drawer-handle-wrap {
  height: 40rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.drawer-handle {
  width: 100rpx;
  height: 10rpx;
  background-color: var(--border-light);
  border-radius: 5rpx;
}

.status-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 48rpx;
}

.status-badge {
  font-size: 26rpx;
  font-weight: 700;
  font-family: var(--font-code);
  padding: 4rpx 16rpx;
  border-radius: var(--radius-sm);
  background-color: var(--bg-hover);
}

.status-badge.is-success { color: var(--accent-green); }
.status-badge.is-error { color: var(--accent-red); }
.status-badge.is-warning { color: var(--accent-orange); }
.status-badge.is-redirect { color: var(--accent-blue); }

.meta-info {
  display: flex;
  gap: 24rpx;
}

.meta-item {
  color: var(--text-secondary);
  font-size: 24rpx;
  font-family: var(--font-code);
  display: flex;
  align-items: center;
  gap: 8rpx;
}

.placeholder-text {
  color: var(--text-muted);
  font-size: 24rpx;
  width: 100%;
  text-align: center;
}

.loading-pulse {
  color: var(--accent-blue);
  font-size: 24rpx;
  animation: pulse 1.5s infinite;
}

@keyframes pulse { 0% { opacity: 0.6; } 50% { opacity: 1; } 100% { opacity: 0.6; } }

.drawer-content-wrapper {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-top: 1px solid var(--border-light);
  height: 0; /* Important for flex child in uni-app to not expand infinitely */
}

.res-tabs {
  display: flex;
  padding: 16rpx 32rpx;
  gap: 32rpx;
  background-color: var(--bg-app);
  border-bottom: 1px solid var(--border-light);
}

.res-tab {
  font-size: 24rpx;
  color: var(--text-secondary);
  cursor: pointer;
  transition: color 0.3s;
}

.res-tab.active {
  color: var(--accent-blue);
  font-weight: 600;
}

.copy-btn {
  font-size: 24rpx;
  color: var(--text-secondary);
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8rpx;
  transition: color 0.2s;
}

.copy-btn:hover {
  color: var(--text-primary);
}

.drawer-scroll {
  flex: 1;
  height: 100%;
  padding: 32rpx;
  padding-bottom: calc(32rpx + env(safe-area-inset-bottom));
  background-color: var(--bg-app);
  box-sizing: border-box;
}

.code-block {
  background-color: var(--bg-input);
  border-radius: var(--radius-md);
  padding: 24rpx;
  border: 1px solid var(--border-light);
}

.media-container {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 200rpx;
  padding: 20rpx;
  background: repeating-conic-gradient(var(--border-light) 0% 25%, transparent 0% 50%) 50% / 20px 20px;
  border-radius: var(--radius-sm);
}

.media-preview {
  max-width: 100%;
  max-height: 600rpx;
  border-radius: var(--radius-sm);
  box-shadow: 0 4rpx 16rpx rgba(0,0,0,0.1);
}

.res-header-row {
  display: flex;
  margin-bottom: 16rpx;
  font-family: var(--font-code);
  font-size: 24rpx;
  border-bottom: 1px dashed var(--border-light);
  padding-bottom: 8rpx;
}

.res-header-key {
  color: var(--accent-purple);
  width: 200rpx;
  flex-shrink: 0;
}

.res-header-val {
  color: var(--text-primary);
  flex: 1;
  word-break: break-all;
}

.skeleton-loader {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.line {
  height: 24rpx;
  background-color: var(--bg-hover);
  border-radius: 4rpx;
  animation: skeleton-pulse 1.5s infinite;
}

.w-80 { width: 80%; }
.w-100 { width: 100%; }
.w-60 { width: 60%; }

@keyframes skeleton-pulse {
  0% { background-color: var(--bg-hover); }
  50% { background-color: var(--border-light); }
  100% { background-color: var(--bg-hover); }
}

.empty-state {
  padding: 40rpx;
  text-align: center;
  color: var(--text-secondary);
  font-size: 26rpx;
  font-style: italic;
}

.icon-text {
  font-size: 32rpx;
  line-height: 1;
  font-family: "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif;
}
</style>
