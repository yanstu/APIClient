<template>
  <view class="nb-json-viewer">
    <!-- rich-text supports user-select since base library 2.22.1 -->
    <rich-text v-if="formattedHtml" :nodes="formattedHtml" class="rich-json" user-select="true"></rich-text>
    <text v-else class="raw-text" user-select="true">{{ fallbackText }}</text>
  </view>
</template>

<script setup>
import { computed } from 'vue';
import { useTheme } from '../../composables/useTheme';

const props = defineProps({
  data: {
    type: [Object, Array, String, Number, Boolean],
    default: null
  }
});

const { currentTheme } = useTheme();

// Colors based on theme context (using inline styles for rich-text)
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

const fallbackText = computed(() => {
  if (props.data === null || props.data === undefined) return '';
  if (typeof props.data === 'string') return props.data;
  try {
    return JSON.stringify(props.data, null, 2);
  } catch (e) {
    return String(props.data);
  }
});

const formattedHtml = computed(() => {
  if (props.data === null || props.data === undefined) return '';
  if (typeof props.data === 'string') {
    // If it's just a string, try to parse it, else return formatted string
    try {
      const parsed = JSON.parse(props.data);
      return `<div style="white-space:pre-wrap; word-break:break-all; font-family:monospace; line-height:1.5; font-size:12px;">${highlight(JSON.stringify(parsed, null, 2))}</div>`;
    } catch {
      return `<div style="color:${colors.value.string}; white-space:pre-wrap; word-break:break-all;">${escapeHtml(props.data)}</div>`;
    }
  }
  try {
    const jsonStr = JSON.stringify(props.data, null, 2);
    return `<div style="white-space:pre-wrap; word-break:break-all; font-family:monospace; line-height:1.5; font-size:12px;">${highlight(jsonStr)}</div>`;
  } catch (e) {
    return `<div style="color:${colors.value.string}; white-space:pre-wrap; word-break:break-all;">${escapeHtml(String(props.data))}</div>`;
  }
});

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function highlight(jsonStr) {
  let str = escapeHtml(jsonStr);
  
  // Syntax highlighting regex
  const regex = /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g;
  
  return str.replace(regex, (match) => {
    let color = colors.value.number;
    if (/^"/.test(match)) {
      if (/:$/.test(match)) {
        // It's a key
        color = colors.value.key;
        // Keep the colon colored as punctuation
        const key = match.replace(/:$/, '');
        return `<span style="color:${color}">${key}</span><span style="color:${colors.value.punctuation}">:</span>`;
      } else {
        // It's a string
        color = colors.value.string;
      }
    } else if (/true|false/.test(match)) {
      color = colors.value.boolean;
    } else if (/null/.test(match)) {
      color = colors.value.null;
    }
    return `<span style="color:${color}">${match}</span>`;
  }).replace(/([{}\[\],])/g, `<span style="color:${colors.value.punctuation}">$1</span>`);
}
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
}
</style>
