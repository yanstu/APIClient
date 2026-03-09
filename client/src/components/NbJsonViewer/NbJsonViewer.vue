<template>
  <view class="nb-json-viewer">
    <template v-if="parsedJson !== null">
      <NbJsonNode
        :data="parsedJson"
        :colors="colors"
      />
    </template>
    <view v-else>
      <text class="raw-text" user-select="true">{{ fallbackText }}</text>
    </view>
  </view>
</template>

<script setup>
import { computed } from 'vue';
import { useTheme } from '../../composables/useTheme';
import NbJsonNode from './NbJsonNode.vue';

const props = defineProps({
  data: {
    type: [Object, Array, String, Number, Boolean],
    default: null
  }
});

const { currentTheme } = useTheme();

// Colors based on theme context (matching GitHub dark/light dimensions)
const colors = computed(() => {
  const isDark = currentTheme.value === 'dark';
  return {
    key: isDark ? '#79c0ff' : '#0550ae', // blue
    string: isDark ? '#a5d6ff' : '#0a3069', // light blue
    number: isDark ? '#7ee787' : '#116329', // green
    boolean: isDark ? '#ff7b72' : '#cf222e', // red
    null: isDark ? '#8b949e' : '#57606a', // gray
    punctuation: isDark ? '#c9d1d9' : '#24292f' // main text
  };
});

// Try to parse the input data aggressively into a JSON object literal.
const parsedJson = computed(() => {
  if (props.data === null || props.data === undefined) return null;
  if (typeof props.data === 'object') return props.data;
  
  if (typeof props.data === 'string') {
    try {
      const parsed = JSON.parse(props.data);
      if (typeof parsed === 'object' && parsed !== null) {
        return parsed;
      }
    } catch {
      // Not valid object JSON
      return null;
    }
  }
  return null;
});

const fallbackText = computed(() => {
  if (props.data === null || props.data === undefined) return '';
  if (typeof props.data === 'string') return props.data;
  try {
    return JSON.stringify(props.data, null, 2);
  } catch (e) {
    return String(props.data);
  }
});
</script>

<style scoped>
.nb-json-viewer {
  width: 100%;
}
.raw-text {
  font-family: var(--font-code);
  font-size: 24rpx;
  color: var(--text-primary);
  word-break: break-all;
  white-space: pre-wrap;
}
</style>
