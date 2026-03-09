<template>
  <scroll-view scroll-x class="nb-tabs-container">
    <view class="nb-tabs">
      <view 
        v-for="tab in tabs" 
        :key="tab.id"
        class="tab-item"
        :class="{ active: modelValue === tab.id }"
        @click="selectTab(tab.id)"
      >
        <text>{{ tab.name }}</text>
        <view class="badge" v-if="tab.badge">{{ tab.badge }}</view>
        <view class="indicator" v-if="modelValue === tab.id"></view>
      </view>
    </view>
  </scroll-view>
</template>

<script setup>
const props = defineProps({
  tabs: {
    type: Array,
    required: true // [{ id: 'params', name: 'Params', badge: 2 }]
  },
  modelValue: {
    type: String,
    required: true
  }
});

const emit = defineEmits(['update:modelValue', 'change']);

const selectTab = (id) => {
  emit('update:modelValue', id);
  emit('change', id);
};
</script>

<style scoped>
.nb-tabs-container {
  width: 100%;
  background-color: transparent;
}
.nb-tabs {
  display: flex;
  flex-wrap: nowrap;
}
.tab-item {
  padding: 24rpx 32rpx;
  font-size: 26rpx;
  color: var(--text-secondary);
  cursor: pointer;
  position: relative;
  white-space: nowrap;
  display: flex;
  align-items: center;
  gap: 12rpx;
  transition: color 0.2s;
}
.tab-item:active {
  opacity: 0.8;
}
.tab-item.active {
  color: var(--text-primary);
  font-weight: 600;
}
.badge {
  background-color: var(--bg-hover);
  color: var(--text-primary);
  font-size: 20rpx;
  padding: 2rpx 10rpx;
  border-radius: 20rpx;
  line-height: 1.2;
}
.indicator {
  position: absolute;
  bottom: 0;
  left: 32rpx;
  right: 32rpx;
  height: 4rpx;
  background-color: var(--accent-blue);
  border-radius: 4rpx 4rpx 0 0;
}
</style>
