<script setup>
import { onLaunch, onShow } from '@dcloudio/uni-app';
import { useTheme } from './composables/useTheme';
import { watch } from 'vue';

const { currentTheme, initTheme } = useTheme();

onLaunch(() => {
  initTheme();
  applyTheme(currentTheme.value);
});

onShow(() => {
  applyTheme(currentTheme.value);
});

watch(currentTheme, (newTheme) => {
  applyTheme(newTheme);
});

function applyTheme(theme) {
  if (typeof uni !== 'undefined' && uni.setBackgroundColor) {
    // Optionally set window background color
    const bgColor = theme === 'dark' ? '#0d1117' : '#f6f8fa';
    uni.setBackgroundColor({ backgroundColor: bgColor });
    uni.setNavigationBarColor({
      frontColor: theme === 'dark' ? '#ffffff' : '#000000',
      backgroundColor: bgColor
    });
  }
}
</script>

<style lang="scss">
@use './styles/theme.scss';

/* 确保页面高度 100% */
page {
  height: 100%;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  box-sizing: border-box;
}

view, scroll-view, text, input, textarea {
  box-sizing: border-box;
}
</style>
