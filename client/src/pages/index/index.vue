<template>
  <view class="app-container" :class="'theme-' + currentTheme" :style="{ paddingBottom: 'env(safe-area-inset-bottom)' }">
    <!-- Header Area with Safe Area Padding -->
    <view class="header-area" :style="{ paddingTop: headerPadding + 'px' }">
      <view style="display: flex; align-items: center;">
        <text class="app-title">API调试助手</text>
      </view>
      <view class="actions" :style="{ marginRight: menuButtonWidth + 'px' }">
        <view class="header-icon-btn" @click="showFeedbackModal = true" title="反馈">
          <text class="icon-text">💬</text>
        </view>
        <view class="header-icon-btn" @click="showCurlModal = true" title="导入 cURL">
          <text class="icon-text">🔗</text>
        </view>
        <view class="header-icon-btn" @click="toggleTheme" title="切换主题">
          <text v-if="currentTheme === 'dark'" class="icon-text">☀️</text>
          <text v-else class="icon-text">🌙</text>
        </view>
      </view>
    </view>

    <!-- Global Tabs Bar -->
    <view class="global-tabs-bar">
      <scroll-view scroll-x class="global-tabs-scroll" :show-scrollbar="false">
        <view class="global-tabs-container">
          <view 
            v-for="(t, idx) in requestManager.tabs" 
            :key="t.id"
            class="global-tab"
            :class="{ active: activeTabId === t.id }"
            @click="handleTabClick(t)"
          >
            <text class="tab-title">{{ t.name }}</text>
            <view class="close-btn" @click.stop="requestManager.closeTab(idx, t.id)" v-if="requestManager.tabs.length > 1">✕</view>
          </view>
          <!-- Padding block at the end so rightmost tab is fully visible -->
          <view class="add-tab-btn" @click="requestManager.addTab">
            <text class="icon-text">＋</text>
          </view>
        </view>
      </scroll-view>
    </view>

    <!-- Top Bar: Request URL -->
    <view class="request-bar">
      <NbDropdown v-model="requestData.method" />
      
      <view class="url-input-wrapper">
        <input 
          class="url-input" 
          v-model="requestData.url" 
          @input="handleUrlInput"
          placeholder="https://api.example.com/v1/users" 
          placeholder-class="placeholder-dim"
        />
      </view>
      
      <view class="send-btn" :class="{ 'is-loading': uiState.isLoading }" @click="requestManager.send">
        <text v-if="!uiState.isLoading" class="icon-text send-icon" style="font-size: 36rpx; display: inline-block; transform: translateX(2rpx);">➤</text>
        <view v-else class="loader"></view>
      </view>
    </view>

    <!-- Config Panel -->
    <view class="config-panel">
      <!-- Toolbar containing Tabs and Actions -->
      <view class="config-toolbar">
        <NbTabs 
          :tabs="tabs" 
          v-model="uiState.currentTab" 
          style="flex: 1; min-width: 0;"
        />
      </view>

      <!-- Tab Content -->
      <scroll-view scroll-y class="tab-content" :show-scrollbar="false">
        <!-- Params / Headers -->
        <view v-if="uiState.currentTab === 'params' || uiState.currentTab === 'headers'" class="kv-list">
          <view v-if="kvList.length === 0" class="empty-state">
            <text>未定义任何 {{ uiState.currentTab === 'params' ? '参数' : '请求头' }}</text>
          </view>
          
          <view class="kv-row" v-for="(item, index) in kvList" :key="index">
            <view class="input-group">
              <input class="kv-input" v-model="item.key" @input="onKvInput" placeholder="键 (Key)" placeholder-class="placeholder-dim" />
            </view>
            <view class="input-group">
              <input class="kv-input" v-model="item.value" @input="onKvInput" placeholder="值 (Value)" placeholder-class="placeholder-dim" />
            </view>
            <view class="action-btn remove" @click="removeKvRow(index)">
              <text class="icon-text">✕</text>
            </view>
          </view>
          
          <view class="add-btn" @click="addKvRow">
            <text>+ 添加 {{ uiState.currentTab === 'params' ? '参数' : '请求头' }}</text>
          </view>
        </view>

        <!-- Auth -->
        <view v-else-if="uiState.currentTab === 'auth'" class="auth-panel">
          <view class="type-selector">
            <view class="chip" :class="{ active: requestData.auth.type === 'none' }" @click="requestData.auth.type = 'none'">No</view>
            <view class="chip" :class="{ active: requestData.auth.type === 'basic' }" @click="requestData.auth.type = 'basic'">Basic</view>
            <view class="chip" :class="{ active: requestData.auth.type === 'bearer' }" @click="requestData.auth.type = 'bearer'">Bearer</view>
          </view>

          <view class="auth-inputs animate-fade-in" v-if="requestData.auth.type === 'basic'">
            <view class="input-group">
              <text class="input-label">用户名</text>
              <input class="auth-input" v-model="requestData.auth.username" placeholder="请输入用户名" placeholder-class="placeholder-dim" />
            </view>
            <view class="input-group">
              <text class="input-label">密码</text>
              <input class="auth-input" v-model="requestData.auth.password" placeholder="请输入密码" password placeholder-class="placeholder-dim" />
            </view>
          </view>
          
          <view class="auth-inputs animate-fade-in" v-if="requestData.auth.type === 'bearer'">
            <view class="input-group">
              <text class="input-label">Token</text>
              <input class="auth-input" v-model="requestData.auth.token" placeholder="eyJh..." placeholder-class="placeholder-dim" />
            </view>
          </view>
          
          <view v-if="requestData.auth.type === 'none'" class="empty-state">
            <text>此请求不使用任何认证方式。</text>
          </view>
        </view>

        <!-- Body -->
        <view v-else-if="uiState.currentTab === 'body'" class="body-panel">
          <view class="body-toolbar">
             <view class="type-selector body-type-selector">
                <view class="chip" :class="{ active: requestData.bodyType === 'none' }" @click="requestData.bodyType = 'none'">无</view>
                <view class="chip" :class="{ active: requestData.bodyType === 'json' }" @click="requestData.bodyType = 'json'">JSON</view>
                <view class="chip" :class="{ active: requestData.bodyType === 'text' }" @click="requestData.bodyType = 'text'">Text</view>
                <view class="chip" :class="{ active: requestData.bodyType === 'form-data' }" @click="requestData.bodyType = 'form-data'">Form</view>
                <view class="chip" :class="{ active: requestData.bodyType === 'x-www-form-urlencoded' }" @click="requestData.bodyType = 'x-www-form-urlencoded'">UrlEncoded</view>
             </view>
            
            <view style="display:flex; gap:16rpx;">
              <view class="format-btn" @click="showFormImportModal = true" v-if="requestData.bodyType === 'form-data' || requestData.bodyType === 'x-www-form-urlencoded'">
                <text class="icon-text">📝</text> 导入文本
              </view>
              <view class="format-btn" @click="formatBody" v-if="requestData.bodyType === 'json'">
                 <text class="icon-text">✨</text> 格式化
              </view>
            </view>
          </view>

          <view v-if="requestData.bodyType === 'none'" class="empty-state" style="margin-top: 40rpx;">
            <text>此请求不包含请求体。</text>
          </view>

          <textarea 
            v-else-if="requestData.bodyType === 'json' || requestData.bodyType === 'text'"
            class="body-textarea" 
            v-model="requestData.body" 
            :placeholder="requestData.bodyType === 'json' ? '在此处输入 JSON 请求体...' : '在此处输入文本...'"
            placeholder-class="placeholder-dim"
            :maxlength="-1"
          ></textarea>

          <view v-else-if="requestData.bodyType === 'form-data' || requestData.bodyType === 'x-www-form-urlencoded'" class="kv-list">
             <view v-if="bodyKvList.length === 0" class="empty-state">
                <text>未定义任何表单数据。</text>
              </view>
              <view class="kv-row" v-for="(item, index) in bodyKvList" :key="index">
                <view class="input-group">
                  <input class="kv-input" v-model="item.key" placeholder="键 (Key)" placeholder-class="placeholder-dim" />
                </view>
                <view class="input-group">
                  <input class="kv-input" v-model="item.value" placeholder="值 (Value)" placeholder-class="placeholder-dim" />
                </view>
                <view class="action-btn remove" @click="removeBodyKvRow(index)">
                  <text class="icon-text">✕</text>
                </view>
              </view>
              <view class="add-btn" @click="addBodyKvRow">
                <text>+ 添加字段</text>
              </view>
          </view>
        </view>
      </scroll-view>
    </view>

    <!-- Response Drawer Component -->
    <ResponseDrawer :uiState="uiState" :responseData="responseData" />

    <!-- Import cURL Modal -->
    <view class="modal-mask animate-fade-in" v-if="showCurlModal" @click="showCurlModal = false">
      <view class="modal-content animate-slide-up" @click.stop>
        <view class="modal-header">
          <text class="modal-title">导入 cURL/Fetch</text>
          <view class="modal-close" @click="showCurlModal = false">
            <text class="icon-text">✕</text>
          </view>
        </view>
        <textarea 
          class="curl-textarea" 
          v-model="curlInput" 
          placeholder="在此处粘贴您的 cURL 或 Fetch 命令..." 
          placeholder-class="placeholder-dim"
          :maxlength="-1"
        ></textarea>
        <view class="modal-actions">
          <view class="modal-btn secondary" @click="showCurlModal = false">取消</view>
          <view class="modal-btn primary" @click="handleImportCurl">导入</view>
        </view>
      </view>
    </view>

    <!-- Import Form Data Modal -->
    <view class="modal-mask animate-fade-in" v-if="showFormImportModal" @click="showFormImportModal = false">
      <view class="modal-content animate-slide-up" @click.stop>
        <view class="modal-header">
          <text class="modal-title">导入表单数据</text>
          <view class="modal-close" @click="showFormImportModal = false">
            <text class="icon-text">✕</text>
          </view>
        </view>
        <textarea 
          class="curl-textarea" 
          v-model="formImportInput" 
          :placeholder="formImportPlaceholder" 
          placeholder-class="placeholder-dim"
          :maxlength="-1"
        ></textarea>
        <view class="modal-actions">
          <view class="modal-btn secondary" @click="showFormImportModal = false">取消</view>
          <view class="modal-btn primary" @click="handleImportForm">导入</view>
        </view>
      </view>
    </view>

    <!-- Rename Tab Modal -->
    <view class="modal-mask animate-fade-in" v-if="showRenameTabModal" @click="showRenameTabModal = false">
      <view class="modal-content animate-slide-up" @click.stop>
        <view class="modal-header">
          <text class="modal-title">重命名标签</text>
          <view class="modal-close" @click="showRenameTabModal = false">
            <text class="icon-text">✕</text>
          </view>
        </view>
        <input 
          class="kv-input rename-input" 
          v-model="renameTabInput" 
          placeholder="请输入新的标签名" 
          placeholder-class="placeholder-dim"
          @confirm="confirmRenameTab"
        />
        <view class="modal-actions" style="margin-top: 24rpx;">
          <view class="modal-btn secondary" @click="showRenameTabModal = false">取消</view>
          <view class="modal-btn primary" @click="confirmRenameTab">确定</view>
        </view>
      </view>
    </view>

    <!-- Feedback Modal -->
    <view class="modal-mask animate-fade-in" v-if="showFeedbackModal" @click="showFeedbackModal = false">
      <view class="modal-content animate-slide-up" @click.stop>
        <view class="modal-header">
          <text class="modal-title">意见反馈</text>
          <view class="modal-close" @click="showFeedbackModal = false">
            <text class="icon-text">✕</text>
          </view>
        </view>
        
        <input 
          class="kv-input" 
          v-model="feedbackEmail" 
          placeholder="您的邮箱 (选填)" 
          placeholder-class="placeholder-dim"
          style="margin-bottom: 16rpx;"
        />
        
        <textarea 
          class="curl-textarea" 
          v-model="feedbackContent" 
          placeholder="请输入您的建议、Bug反馈或需求..." 
          placeholder-class="placeholder-dim"
          :maxlength="-1"
          style="min-height: 200rpx;"
        ></textarea>
        
        <view class="modal-actions" style="margin-top: 24rpx;">
          <view class="modal-btn secondary" @click="showFeedbackModal = false">取消</view>
          <view class="modal-btn primary" :class="{'is-loading': isSubmittingFeedback}" @click="handleSubmitFeedback">
             <text v-if="!isSubmittingFeedback">提交反馈</text>
             <view v-else class="loader" style="width: 24rpx; height: 24rpx; border-width: 3rpx;"></view>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useTheme } from '../../composables/useTheme';
import { useRequest } from '../../composables/useRequest';
import { parseCurl } from '../../utils/curlParser';
import NbDropdown from '../../components/NbDropdown/NbDropdown.vue';
import NbTabs from '../../components/NbTabs/NbTabs.vue';
import ResponseDrawer from '../../components/ResponseDrawer/ResponseDrawer.vue';

// System Info for Safe Area & Drawer
const sysInfo = uni.getSystemInfoSync();
const headerPadding = ref(sysInfo.statusBarHeight || 20);
const menuButtonWidth = ref(0);
const windowHeight = sysInfo.windowHeight;

if (typeof uni.getMenuButtonBoundingClientRect === 'function') {
  const menuButtonInfo = uni.getMenuButtonBoundingClientRect();
  if (menuButtonInfo) {
    headerPadding.value = menuButtonInfo.top;
    // Add margin to avoid overlapping with WeChat capsule
    menuButtonWidth.value = sysInfo.windowWidth - menuButtonInfo.left + 10;
  }
} else {
  headerPadding.value += 10;
}

// 1. Theme
const { currentTheme, toggleTheme } = useTheme();

// 2. Request logic
const requestManager = useRequest();

// Extract the ref so template can use it properly for equality checks
const { activeTabId } = requestManager;

// Use computed objects directly from the manager to ensure Vue's deep reactivity translates to the UI fields correctly
const requestData = computed(() => requestManager.activeTab.value.requestData);
const responseData = computed(() => requestManager.activeTab.value.responseData);
const uiState = computed(() => requestManager.activeTab.value.uiState);

// 3. cURL Import State
const showCurlModal = ref(false);
const curlInput = ref('');

const handleImportCurl = () => {
  const parsed = parseCurl(curlInput.value);
  if (!parsed) {
    uni.showToast({ title: '无效的格式', icon: 'none' });
    return;
  }

  requestData.value.method = parsed.method || 'GET';
  requestData.value.url = parsed.url || '';
  
  requestData.value.headers = [];
  parsed.headers.forEach(h => {
    requestData.value.headers.push({ key: h.key, value: h.value });
  });

  requestData.value.auth = { ...parsed.auth };

  requestData.value.bodyType = parsed.bodyType || 'none';
  if (parsed.bodyType === 'json' || parsed.bodyType === 'text' || parsed.bodyType === 'x-www-form-urlencoded') {
    requestData.value.body = parsed.body;
  }

  requestManager.syncParamsFromUrl();
  requestManager.syncTabNameFromUrl();

  showCurlModal.value = false;
  curlInput.value = '';
  uni.showToast({ title: '导入成功', icon: 'success' });
};


// 4. Computed Tabs config
const tabs = computed(() => {
  let bodyBadge = '';
  if (requestData.value.bodyType === 'json' || requestData.value.bodyType === 'text') {
    bodyBadge = requestData.value.body.trim() ? '•' : '';
  } else if (requestData.value.bodyType === 'form-data') {
    bodyBadge = requestData.value.bodyFormData.filter(i => i.key).length || '';
  } else if (requestData.value.bodyType === 'x-www-form-urlencoded') {
    bodyBadge = requestData.value.bodyUrlEncoded.filter(i => i.key).length || '';
  }

  return [
    { id: 'params', name: 'Params', badge: requestData.value.params.filter(p => p.key).length || '' },
    { id: 'auth', name: 'Auth', badge: requestData.value.auth.type !== 'none' ? '1' : '' },
    { id: 'headers', name: 'Headers', badge: requestData.value.headers.filter(h => h.key).length || '' },
    { id: 'body', name: 'Body', badge: bodyBadge }
  ];
});

const kvList = computed(() => {
  return uiState.value.currentTab === 'params' ? requestData.value.params : requestData.value.headers;
});

const bodyKvList = computed(() => {
  return requestData.value.bodyType === 'form-data' ? requestData.value.bodyFormData : requestData.value.bodyUrlEncoded;
});

// 5. Methods
const handleUrlInput = () => {
  requestManager.syncParamsFromUrl();
  requestManager.syncTabNameFromUrl();
};

const onKvInput = () => {
  if (uiState.value.currentTab === 'params') {
    requestManager.syncUrlFromParams();
  }
};

const addKvRow = () => {
  if (uiState.value.currentTab === 'params') requestData.value.params.push({ key: '', value: '' });
  else if (uiState.value.currentTab === 'headers') requestData.value.headers.push({ key: '', value: '' });
};

const removeKvRow = (index) => {
  if (uiState.value.currentTab === 'params') {
    requestData.value.params.splice(index, 1);
    requestManager.syncUrlFromParams();
  }
  else if (uiState.value.currentTab === 'headers') {
    requestData.value.headers.splice(index, 1);
  }
};

const addBodyKvRow = () => {
  if (requestData.value.bodyType === 'form-data') requestData.value.bodyFormData.push({ key: '', value: '' });
  else if (requestData.value.bodyType === 'x-www-form-urlencoded') requestData.value.bodyUrlEncoded.push({ key: '', value: '' });
}

const removeBodyKvRow = (index) => {
  if (requestData.value.bodyType === 'form-data') requestData.value.bodyFormData.splice(index, 1);
  else if (requestData.value.bodyType === 'x-www-form-urlencoded') requestData.value.bodyUrlEncoded.splice(index, 1);
}

const formatBody = () => {
  if (!requestData.value.body) return;
  try {
    const parsed = JSON.parse(requestData.value.body);
    requestData.value.body = JSON.stringify(parsed, null, 2);
    uni.showToast({ title: '已格式化', icon: 'none', duration: 1000 });
  } catch (e) {
    uni.showToast({ title: 'JSON 格式错误', icon: 'none' });
  }
};

// Form Import Feature
const showFormImportModal = ref(false);
const formImportInput = ref('');
const formImportPlaceholder = '示例格式（每行一个键值对）：\nusername: admin\npassword: 123456\nkeyword: test';

const handleImportForm = () => {
  if (!formImportInput.value) return;
  const lines = formImportInput.value.split('\n');
  const targetList = requestData.value.bodyType === 'form-data' ? requestData.value.bodyFormData : requestData.value.bodyUrlEncoded;
  
  lines.forEach(line => {
    // support "key: value"
    const splitIdx = line.indexOf(':');
    if (splitIdx > 0) {
      const key = line.slice(0, splitIdx).trim();
      let value = line.slice(splitIdx + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      targetList.push({ key, value });
    }
  });

  showFormImportModal.value = false;
  formImportInput.value = '';
  uni.showToast({ title: '导入成功', icon: 'success' });
};

// Rename Tab Feature
const showRenameTabModal = ref(false);
const renameTabInput = ref('');
const renameTargetId = ref('');

const openRenameModal = (id, currentName) => {
  renameTargetId.value = id;
  renameTabInput.value = currentName === 'New Request' ? '' : currentName;
  showRenameTabModal.value = true;
};

let tapTimer = 0;
const handleTabClick = (t) => {
  const now = Date.now();
  if (now - tapTimer < 300) {
    // Double tap detected
    openRenameModal(t.id, t.name);
    tapTimer = 0;
  } else {
    // Single tap detected
    requestManager.setActiveTab(t.id);
    tapTimer = now;
  }
};

const confirmRenameTab = () => {
  if (renameTabInput.value.trim()) {
    requestManager.renameTab(renameTargetId.value, renameTabInput.value.trim());
  }
  showRenameTabModal.value = false;
};

// Feedback Feature
const showFeedbackModal = ref(false);
const feedbackEmail = ref('');
const feedbackContent = ref('');
const isSubmittingFeedback = ref(false);

const handleSubmitFeedback = () => {
  if (!feedbackContent.value.trim()) {
    uni.showToast({ title: '建议内容不能为空', icon: 'none' });
    return;
  }
  
  isSubmittingFeedback.value = true;
  
  const proxyBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
  
  uni.request({
    url: `${proxyBaseUrl}/api/feedback`,
    method: 'POST',
    data: {
      email: feedbackEmail.value.trim(),
      content: feedbackContent.value.trim()
    },
    success: (res) => {
      if (res.data && res.data.success) {
        uni.showToast({ title: '提交成功，感谢反馈', icon: 'success' });
        showFeedbackModal.value = false;
        feedbackEmail.value = '';
        feedbackContent.value = '';
      } else {
        uni.showToast({ title: res.data?.message || '提交失败', icon: 'none' });
      }
    },
    fail: () => {
      uni.showToast({ title: '网络请求失败', icon: 'none' });
    },
    complete: () => {
      isSubmittingFeedback.value = false;
    }
  });
};
</script>

<style scoped>
/* Hidden scrollbar purely aesthetic globally inside our views */
::-webkit-scrollbar {
  display: none;
  width: 0;
  height: 0;
}

/* Page Layout */
.app-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background-color: var(--bg-app);
  color: var(--text-primary);
  overflow: hidden;
  position: relative;
}

/* Fallback icons using text/emoji since SVG mask failed on some miniprogram environments */
.icon-text {
  font-size: 32rpx;
  line-height: 1;
}

.placeholder-dim {
  color: var(--text-muted);
}

.empty-state {
  padding: 40rpx;
  text-align: center;
  color: var(--text-secondary);
  font-size: 26rpx;
  font-style: italic;
}

/* Header Area */
.header-area {
  padding: 0 32rpx 10rpx;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background-color: var(--bg-app);
}
.app-title {
  font-size: 36rpx;
  font-weight: 800;
  color: var(--text-primary);
  letter-spacing: 1rpx;
}
.actions {
  display: flex;
  align-items: center;
  gap: 8rpx;
}
.header-icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 12rpx;
  color: var(--text-secondary);
  transition: opacity 0.2s;
  border-radius: var(--radius-sm);
}
.header-icon-btn:active {
  opacity: 0.8;
  background-color: rgba(0,0,0,0.05);
}

/* Global Tabs Bar */
.global-tabs-bar {
  background-color: var(--bg-app);
  padding: 0 32rpx;
  margin-top: 10rpx; /* Add slight distance from the capsule */
}
.global-tabs-scroll {
  width: 100%;
}
.global-tabs-container {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding-bottom: 8rpx;
}
.global-tab {
  display: inline-flex;
  align-items: center;
  gap: 16rpx;
  padding: 12rpx 24rpx;
  background-color: var(--bg-panel);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
  opacity: 0.7;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}
.global-tab.active {
  opacity: 1;
  background-color: var(--bg-input);
  border-bottom: 2px solid var(--accent-blue);
  box-shadow: 0 4rpx 10rpx rgba(0,0,0,0.05);
}
.tab-title {
  font-size: 24rpx;
  color: var(--text-primary);
  font-weight: 500;
  max-width: 240rpx;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: block;
}
.close-btn {
  font-size: 20rpx;
  color: var(--text-muted);
  width: 36rpx;
  height: 36rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  margin-left: 8rpx;
}
.close-btn:hover {
  background-color: rgba(255, 0, 0, 0.1);
  color: var(--accent-red);
}
.add-tab-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 60rpx;
  height: 60rpx;
  border-radius: var(--radius-md);
  background-color: transparent;
  border: 1px dashed var(--text-muted);
  color: var(--text-muted);
  cursor: pointer;
  flex-shrink: 0;
}
.add-tab-btn:active {
  background-color: rgba(0,0,0,0.05);
}

/* Top Request Bar */
.request-bar {
  display: flex;
  align-items: center;
  padding: 16rpx 32rpx;
  gap: 16rpx;
  z-index: 10;
}
.url-input-wrapper {
  flex: 1;
  position: relative;
}
.url-input {
  height: 80rpx;
  background-color: var(--bg-input);
  border-radius: var(--radius-md);
  padding: 0 24rpx;
  font-family: var(--font-code);
  font-size: 26rpx;
  color: var(--text-primary);
  border: 1px solid var(--border-light);
  transition: border-color 0.3s ease;
  width: 100%;
}
.url-input:focus {
  border-color: var(--border-focus);
}
.send-btn {
  height: 80rpx;
  width: 90rpx;
  background-color: var(--accent-blue);
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: opacity 0.2s, transform 0.1s;
}
.send-btn:active:not(.is-loading) {
  transform: scale(0.95);
  opacity: 0.9;
}
.send-btn.is-loading {
  background-color: var(--bg-panel);
  border: 1px solid var(--border-light);
}
.send-icon {
  color: #ffffff;
}
.loader {
  width: 32rpx;
  height: 32rpx;
  border: 4rpx solid var(--text-secondary);
  border-bottom-color: var(--accent-blue);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}
@keyframes spin { 100% { transform: rotate(360deg); } }

/* Config Panel */
.config-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  margin: 16rpx 32rpx;
  background-color: var(--bg-panel);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-light);
}

.config-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--border-light);
  background-color: var(--bg-panel);
  overflow: hidden;
}

.tab-content {
  flex: 1;
}

/* KV List */
.kv-list {
  padding: 24rpx;
}
.kv-row {
  display: flex;
  gap: 16rpx;
  margin-bottom: 16rpx;
  align-items: center;
  animation: slideInRight 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
}
@keyframes slideInRight {
  from { opacity: 0; transform: translateX(20rpx); }
  to { opacity: 1; transform: translateX(0); }
}

.input-group {
  flex: 1;
}
.kv-input, .auth-input {
  height: 72rpx;
  background-color: var(--bg-input);
  border-radius: var(--radius-md);
  padding: 0 24rpx;
  font-size: 26rpx;
  color: var(--text-primary);
  border: 1px solid var(--border-light);
  font-family: var(--font-code);
  transition: border-color 0.3s;
  width: 100%;
}
.kv-input:focus, .auth-input:focus {
  border-color: var(--accent-blue);
}
.action-btn {
  width: 72rpx;
  height: 72rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-md);
  background-color: var(--bg-input);
  border: 1px solid var(--border-light);
  cursor: pointer;
  transition: all 0.2s;
}
.action-btn.remove {
  color: var(--text-secondary);
}
.action-btn.remove:active {
  color: var(--accent-red);
  border-color: var(--accent-red);
  background-color: rgba(218, 54, 51, 0.1);
}
.add-btn {
  height: 72rpx;
  border: 1px dashed var(--text-muted);
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
  font-size: 26rpx;
  cursor: pointer;
  margin-top: 24rpx;
  transition: all 0.2s;
}
.add-btn:active {
  border-color: var(--accent-blue);
  color: var(--accent-blue);
  background-color: rgba(47, 129, 247, 0.05);
}

/* Shared Type Selector */
.type-selector {
  display: flex;
  background-color: var(--bg-input);
  border-radius: var(--radius-md);
  padding: 8rpx;
  border: 1px solid var(--border-light);
  overflow-x: auto;
  white-space: nowrap;
}
.chip {
  flex: 1;
  text-align: center;
  padding: 12rpx 16rpx;
  font-size: 24rpx;
  color: var(--text-secondary);
  border-radius: var(--radius-sm);
  transition: all 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
}
.chip.active {
  background-color: var(--bg-hover);
  color: var(--text-primary);
  font-weight: 600;
  box-shadow: 0 4rpx 12rpx rgba(0,0,0,0.1);
}
.body-type-selector .chip {
  font-size: 22rpx;
  flex: none;
  min-width: 100rpx;
}

/* Auth Panel */
.auth-panel {
  padding: 24rpx;
}
.auth-inputs {
  display: flex;
  flex-direction: column;
  gap: 24rpx;
  margin-top: 32rpx;
}
.input-label {
  font-size: 24rpx;
  color: var(--text-secondary);
  margin-bottom: 12rpx;
  display: block;
}
.animate-fade-in {
  animation: fadeIn 0.4s cubic-bezier(0.2, 0.8, 0.2, 1);
}
@keyframes fadeIn { from { opacity: 0; transform: translateY(10rpx); } to { opacity: 1; transform: translateY(0); } }

/* Body Panel */
.body-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
}
.body-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16rpx 24rpx;
  border-bottom: 1px solid var(--border-light);
  background-color: var(--bg-hover);
  gap: 16rpx;
}
.body-type-selector {
  flex: 1;
}
.format-btn {
  font-size: 22rpx;
  color: var(--accent-blue);
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8rpx;
  padding: 12rpx 16rpx;
  background-color: rgba(47, 129, 247, 0.1);
  border-radius: var(--radius-sm);
  transition: opacity 0.2s;
}
.format-btn:active {
  opacity: 0.8;
}
.body-textarea {
  flex: 1;
  width: 100%;
  background-color: transparent;
  padding: 24rpx;
  font-size: 26rpx;
  color: var(--text-primary);
  border: none;
  font-family: var(--font-code);
  line-height: 1.5;
}



/* Modal */
.modal-mask {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background-color: rgba(0,0,0,0.6);
  z-index: 999;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32rpx;
  padding-bottom: env(safe-area-inset-bottom);
}
.animate-slide-up {
  animation: slideUp 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
}
@keyframes slideUp {
  from { opacity: 0; transform: translateY(40rpx); }
  to { opacity: 1; transform: translateY(0); }
}

.modal-content {
  background-color: var(--bg-panel);
  border-radius: var(--radius-lg);
  width: 100%;
  max-width: 600rpx;
  padding: 32rpx;
  border: 1px solid var(--border-light);
  box-shadow: 0 20rpx 40rpx rgba(0,0,0,0.4);
}
.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24rpx;
}
.modal-title {
  font-size: 32rpx;
  font-weight: 700;
  color: var(--text-primary);
}
.modal-close {
  color: var(--text-secondary);
  cursor: pointer;
}
.curl-textarea {
  width: 100%;
  height: 300rpx;
  background-color: var(--bg-input);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
  padding: 16rpx;
  font-family: var(--font-code);
  font-size: 24rpx;
  color: var(--text-primary);
  margin-bottom: 24rpx;
  box-sizing: border-box;
}
.curl-textarea:focus {
  border-color: var(--accent-blue);
}
.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 16rpx;
}
.modal-btn {
  padding: 16rpx 32rpx;
  border-radius: var(--radius-md);
  font-size: 26rpx;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.2s;
}
.modal-btn:active {
  opacity: 0.8;
}
.modal-btn.secondary {
  background-color: var(--bg-input);
  color: var(--text-secondary);
  border: 1px solid var(--border-light);
}
.modal-btn.primary {
  background-color: var(--accent-blue);
  color: #fff;
}
.rename-input {
  margin-top: 10rpx;
}
</style>
