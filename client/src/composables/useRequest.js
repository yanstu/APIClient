import { reactive, ref, computed } from 'vue';

const generateId = () => Math.random().toString(36).substr(2, 9);

const createNewTab = (name = 'New Request') => {
  return {
    id: generateId(),
    name,
    isNameCustomized: false, // Track if user manually renamed
    requestData: {
      method: 'GET',
      url: '',
      params: [],
      headers: [
        { key: 'Content-Type', value: 'application/json' },
        { key: 'Accept', value: '*/*' }
      ],
      auth: { type: 'none', username: '', password: '', token: '' },
      bodyType: 'json', // none, json, text, form-data, x-www-form-urlencoded
      body: '',
      bodyFormData: [],
      bodyUrlEncoded: []
    },
    responseData: {
      status: 0,
      statusText: '',
      time: 0,
      size: '0 B',
      data: null,
      headers: null
    },
    uiState: {
      currentTab: 'params',
      resTab: 'body',
      isResponseOpen: false,
      isLoading: false
    }
  };
};

const tabs = reactive([createNewTab()]);
const activeTabId = ref(tabs[0].id);

export function useRequest() {
  const activeTab = computed(() => {
    return tabs.find(t => t.id === activeTabId.value) || tabs[0];
  });

  const formatSize = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const syncUrlFromParams = () => {
    try {
      const requestData = activeTab.value.requestData;
      if (!requestData.url) return;
      const baseUrl = requestData.url.split('?')[0];
      const validParams = requestData.params.filter(p => p.key.trim() !== '');
      if (validParams.length === 0) {
        requestData.url = baseUrl;
        return;
      }
      const queryString = validParams.map(p => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`).join('&');
      requestData.url = `${baseUrl}?${queryString}`;
    } catch (e) { }
  };

  const syncParamsFromUrl = () => {
    try {
      const requestData = activeTab.value.requestData;
      const urlString = requestData.url;

      if (!urlString.includes('?')) return;
      const queryString = urlString.split('?')[1];
      if (!queryString) return;

      const pairs = queryString.split('&');
      const newParams = [];

      pairs.forEach(pair => {
        const [key, value] = pair.split('=');
        if (key) {
          newParams.push({ key: decodeURIComponent(key), value: value ? decodeURIComponent(value) : '' });
        }
      });
      if (newParams.length > 0) {
        requestData.params = newParams;
      }
    } catch (e) { }
  };

  const send = () => {
    const requestData = activeTab.value.requestData;
    const responseData = activeTab.value.responseData;
    const uiState = activeTab.value.uiState;

    if (!requestData.url) {
      uni.showToast({ title: 'Enter a valid URL', icon: 'none' });
      return;
    }

    syncUrlFromParams();
    let finalUrl = requestData.url;
    if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) {
      finalUrl = 'http://' + finalUrl;
    }

    const headersObj = {};
    requestData.headers.forEach(h => {
      if (h.key.trim() !== '') headersObj[h.key] = h.value;
    });

    let finalBody = undefined;
    if (requestData.method !== 'GET' && requestData.method !== 'HEAD') {
      if (requestData.bodyType === 'json' || requestData.bodyType === 'text') {
        finalBody = requestData.body;
        if (requestData.bodyType === 'json' && typeof requestData.body === 'string') {
          try { finalBody = JSON.parse(requestData.body); } catch (e) { }
        }
      } else if (requestData.bodyType === 'form-data') {
        finalBody = requestData.bodyFormData.filter(item => item.key.trim() !== '');
      } else if (requestData.bodyType === 'x-www-form-urlencoded') {
        finalBody = requestData.bodyUrlEncoded.filter(item => item.key.trim() !== '');
      }
    }

    uiState.isLoading = true;
    uiState.isResponseOpen = true;
    uiState.resTab = 'body';

    // Using Vite env variables for proxy base URL
    const proxyBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
    const proxyUrl = `${proxyBaseUrl}/api/proxy`;

    uni.request({
      url: proxyUrl,
      method: 'POST',
      data: {
        method: requestData.method,
        url: finalUrl,
        headers: headersObj,
        bodyType: requestData.bodyType,
        body: finalBody,
        auth: requestData.auth.type !== 'none' ? requestData.auth : undefined
      },
      success: (res) => {
        uiState.isLoading = false;
        const proxyResponse = res.data;

        if (proxyResponse && proxyResponse.success && proxyResponse.data) {
          const data = proxyResponse.data;
          responseData.status = data.status;
          responseData.statusText = data.statusText;
          responseData.time = data.duration;
          responseData.data = data.data;
          responseData.headers = data.headers;

          let sizeBytes = 0;
          try {
            sizeBytes = unescape(encodeURIComponent(JSON.stringify(data.data))).length;
          } catch (e) {
            sizeBytes = JSON.stringify(data.data || '').length;
          }
          responseData.size = formatSize(sizeBytes);
        } else {
          responseData.status = 500;
          responseData.statusText = 'Proxy Error';
          responseData.data = proxyResponse ? proxyResponse.message : 'Unknown Error';
          responseData.headers = {};
          responseData.time = 0;
          responseData.size = '0 B';
        }
      },
      fail: (err) => {
        uiState.isLoading = false;
        responseData.status = 0;
        responseData.statusText = 'Network Error';
        responseData.data = err.errMsg || 'Could not reach proxy';
        responseData.headers = {};
        responseData.time = 0;
        responseData.size = '0 B';
      }
    });
  };

  const addTab = () => {
    const newTab = createNewTab(`Request ${tabs.length + 1}`);
    tabs.push(newTab);
    activeTabId.value = newTab.id;
  };

  const closeTab = (index, tabId) => {
    if (tabs.length === 1) return; // don't close the last one

    tabs.splice(index, 1);

    if (activeTabId.value === tabId) {
      const nextIndex = Math.max(0, index - 1);
      activeTabId.value = tabs[nextIndex].id;
    }
  };

  const setActiveTab = (id) => {
    activeTabId.value = id;
  };

  const renameTab = (id, newName) => {
    const tabToRename = tabs.find(t => t.id === id);
    if (tabToRename) {
      tabToRename.name = newName || 'Unnamed Request';
      tabToRename.isNameCustomized = !!newName;
    }
  };

  const syncTabNameFromUrl = () => {
    const currentUrl = activeTab.value.requestData.url;
    if (!activeTab.value.isNameCustomized) {
      if (currentUrl) {
        let displayUrl = currentUrl.replace(/^https?:\/\//, '');
        activeTab.value.name = displayUrl.substring(0, 30) + (displayUrl.length > 30 ? '...' : '');
      } else {
        activeTab.value.name = 'New Request';
      }
    }
  };

  return {
    tabs,
    activeTabId,
    activeTab,
    syncUrlFromParams,
    syncParamsFromUrl,
    send,
    addTab,
    closeTab,
    setActiveTab,
    renameTab,
    syncTabNameFromUrl
  };
}
