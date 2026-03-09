<template>
  <view class="nb-icon-container" :style="{ width: size + 'rpx', height: size + 'rpx' }">
    <image :src="dataUri" class="nb-icon-img" :style="{ width: size + 'rpx', height: size + 'rpx' }" mode="aspectFit"></image>
  </view>
</template>

<script setup>
import { computed } from 'vue';
import { useTheme } from '../../composables/useTheme';

const props = defineProps({
  name: {
    type: String,
    required: true
  },
  size: {
    type: [Number, String],
    default: 32
  },
  color: {
    type: String,
    default: ''
  }
});

const { currentTheme } = useTheme();

const icons = {
  'send': 'M2.01 21L23 12L2.01 3L2 10l15 2l-15 2z',
  'sun': 'M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1zM5.99 4.58a.996.996 0 00-1.41 0 .996.996 0 000 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41L5.99 4.58zm12.37 12.37a.996.996 0 00-1.41 0 .996.996 0 000 1.41l1.06 1.06c.39.39 1.03.39 1.41 0a.996.996 0 000-1.41l-1.06-1.06zm1.06-10.96a.996.996 0 000-1.41.996.996 0 00-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06zM7.05 18.36a.996.996 0 000-1.41.996.996 0 00-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06z',
  'moon': 'M9.37 5.51c-.18.64-.27 1.31-.27 1.99 0 4.08 3.32 7.4 7.4 7.4.68 0 1.35-.09 1.99-.27C17.45 17.19 14.93 19 12 19c-3.86 0-7-3.14-7-7 0-2.93 1.81-5.45 4.37-6.49zM12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9 9-4.03 9-9c0-.46-.04-.92-.1-1.36-.98 1.37-2.58 2.26-4.4 2.26-2.98 0-5.4-2.42-5.4-5.4 0-1.81.89-3.42 2.26-4.4-.44-.06-.9-.1-1.36-.1z',
  'arrow-down': 'M7 10l5 5 5-5z',
  'check': 'M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z',
  'copy': 'M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z',
  'clock': 'M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z',
  'package': 'M12 2L2 7l10 5 10-5-10-5zM2 9v6l10 5 10-5V9l-10 5-10-5z',
  'close': 'M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z',
  'magic': 'M7.5 5.6L5 7l5.4 5.4L7 19l8-10-4.4-1.2L13 5l-1.5 2.5L7.5 5.6zM2 13l2-1.5L5.5 13 4 15 2 13zm16-4l2-1.5 1.5 1.5-1.5 2L18 9zM19 19l2-1.5 1.5 1.5-1.5 2-2-2z'
};

const dataUri = computed(() => {
  const path = icons[props.name] || 'M4 4h16v16H4z';
  
  // Resolve actual hex color
  let finalColor = props.color;
  if (!finalColor || finalColor === 'currentColor') {
    finalColor = currentTheme.value === 'dark' ? '#8b949e' : '#57606a'; // default text-secondary
  }
  
  const svgString = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="${path}" fill="${finalColor}"/></svg>`;
  
  // base64 encode safely for unicode (though we only use ascii here)
  const base64Str = btoa(svgString);
  return `data:image/svg+xml;base64,${base64Str}`;
});
</script>

<style scoped>
.nb-icon-container {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-family: "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif;
}
.nb-icon-img {
  display: block;
}
</style>
