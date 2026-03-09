// src/composables/useTheme.js
import { ref, watch } from 'vue';

const currentTheme = ref('light'); // 'dark' | 'light'

export function useTheme() {
  const toggleTheme = () => {
    currentTheme.value = currentTheme.value === 'dark' ? 'light' : 'dark';
    // Sync with uni system if needed
    if (typeof uni !== 'undefined') {
      uni.setStorageSync('nebula_theme', currentTheme.value);
    }
  };

  const initTheme = () => {
    if (typeof uni !== 'undefined') {
      const savedTheme = uni.getStorageSync('nebula_theme');
      if (savedTheme) {
        currentTheme.value = savedTheme;
      } else {
        const sysInfo = uni.getSystemInfoSync();
        if (sysInfo.theme) {
          currentTheme.value = sysInfo.theme;
        }
      }
    }
  };

  return {
    currentTheme,
    toggleTheme,
    initTheme
  };
}
