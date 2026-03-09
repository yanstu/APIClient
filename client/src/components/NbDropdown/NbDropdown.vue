<template>
  <view class="nb-dropdown-wrapper">
    <view class="dropdown-trigger" :class="methodColorClass" @click="toggle">
      <text class="method-text">{{ modelValue }}</text>
      <text class="arrow" :class="{ 'is-open': isOpen }">▼</text>
    </view>
    
    <!-- Mask -->
    <view v-if="isOpen" class="dropdown-mask" @click="close"></view>
    
    <!-- Menu -->
    <view class="dropdown-menu" :class="{ 'is-open': isOpen }">
      <view 
        v-for="item in options" 
        :key="item"
        class="dropdown-item"
        :class="getColorClass(item)"
        @click="select(item)"
      >
        <text>{{ item }}</text>
        <text v-if="modelValue === item" class="check">✓</text>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed } from 'vue';

const props = defineProps({
  modelValue: {
    type: String,
    default: 'GET'
  }
});

const emit = defineEmits(['update:modelValue', 'change']);

const options = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'];
const isOpen = ref(false);

const toggle = () => {
  isOpen.value = !isOpen.value;
};

const close = () => {
  isOpen.value = false;
};

const select = (val) => {
  emit('update:modelValue', val);
  emit('change', val);
  close();
};

const getColorClass = (method) => {
  const m = method.toLowerCase();
  const map = {
    get: 'c-blue',
    post: 'c-green',
    put: 'c-orange',
    delete: 'c-red',
    patch: 'c-yellow',
    options: 'c-purple'
  };
  return map[m] || 'c-default';
};

const methodColorClass = computed(() => getColorClass(props.modelValue));
</script>

<style scoped>
.nb-dropdown-wrapper {
  position: relative;
  z-index: 50; /* Ensure it stays on top */
}

.dropdown-trigger {
  height: 80rpx;
  padding: 0 24rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12rpx;
  border-radius: var(--radius-md);
  background-color: var(--bg-panel);
  border: 1px solid var(--border-light);
  font-weight: 700;
  font-size: 26rpx;
  min-width: 150rpx;
  box-sizing: border-box;
}

.dropdown-trigger:active {
  opacity: 0.8;
}

.method-text {
  flex: 1;
  text-align: center;
}

.arrow {
  color: var(--text-secondary);
  font-size: 20rpx;
  transition: transform 0.2s;
}
.arrow.is-open {
  transform: rotate(180deg);
}

.dropdown-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 40;
  background: transparent;
}

.dropdown-menu {
  position: absolute;
  top: 90rpx;
  left: 0;
  background-color: var(--bg-panel);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
  padding: 8rpx;
  box-shadow: 0 10rpx 30rpx rgba(0,0,0,0.3);
  opacity: 0;
  pointer-events: none;
  transform: translateY(-10rpx);
  transition: all 0.2s cubic-bezier(0.1, 0.8, 0.2, 1);
  min-width: 200rpx;
  z-index: 50;
}

.dropdown-menu.is-open {
  opacity: 1;
  pointer-events: auto;
  transform: translateY(0);
}

.dropdown-item {
  padding: 16rpx 24rpx;
  font-size: 26rpx;
  font-weight: 600;
  border-radius: var(--radius-sm);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.dropdown-item:active {
  background-color: var(--bg-hover);
}

.check {
  color: var(--text-primary);
  font-size: 24rpx;
}

/* Colors */
.c-blue { color: var(--accent-blue); }
.c-green { color: var(--accent-green); }
.c-orange { color: var(--accent-orange); }
.c-red { color: var(--accent-red); }
.c-yellow { color: var(--accent-yellow); }
.c-purple { color: var(--accent-purple); }
.c-default { color: var(--text-primary); }
</style>
