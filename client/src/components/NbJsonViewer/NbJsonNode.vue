<template>
  <view class="json-node">
    <view class="node-line" @click.stop="toggle" :style="{ paddingLeft: depth * 20 + 'rpx' }">
      <!-- Arrow icon for objects/arrays -->
      <view class="toggle-icon-wrap" v-if="isObjectOrArray" :class="{ 'is-expanded': isOpen }">
        <text class="arrow-icon">▶</text>
      </view>
      <view class="toggle-icon-wrap" v-else></view>

      <!-- Key -->
      <text v-if="nodeKey !== null" class="node-key" :style="{ color: colors.key }">"{{ nodeKey }}"</text>
      <text v-if="nodeKey !== null" class="node-colon" :style="{ color: colors.punctuation }">:&nbsp;</text>

      <!-- Value preview when closed OR simple primitive -->
      <template v-if="isObjectOrArray">
        <text v-show="!isOpen" class="node-preview" :style="{ color: colors.punctuation }">
          {{ isArray ? `[ ... ${data.length} items ]` : '{ ... }' }}
        </text>
        <text v-show="isOpen" class="node-punctuation" :style="{ color: colors.punctuation }">
          {{ isArray ? '[' : '{' }}
        </text>
      </template>
      <template v-else>
        <text class="node-value" :style="{ color: valueColor }">{{ formattedValue }}</text>
      </template>
    </view>

    <!-- Children (if open object/array) -->
    <view v-if="isObjectOrArray && isOpen" class="node-children">
      <NbJsonNode
        v-for="(val, k) in data"
        :key="k"
        :nodeKey="isArray ? null : k"
        :data="val"
        :depth="depth + 1"
        :colors="colors"
      />
    </view>

    <!-- Closing bracket when open -->
    <view v-if="isObjectOrArray && isOpen" class="node-line" :style="{ paddingLeft: depth * 20 + 'rpx' }">
      <!-- Spacer for alignment -->
      <view class="toggle-icon-wrap"></view>
      <text class="node-punctuation" :style="{ color: colors.punctuation }">
        {{ isArray ? ']' : '}' }}
      </text>
    </view>

  </view>
</template>

<script>
export default {
  name: 'NbJsonNode'
}
</script>

<script setup>
import { ref, computed } from 'vue';
import NbJsonNode from './NbJsonNode.vue';

const props = defineProps({
  data: {
    required: true
  },
  nodeKey: {
    type: [String, Number],
    default: null
  },
  depth: {
    type: Number,
    default: 0
  },
  colors: {
    type: Object,
    required: true
  }
});

const isOpen = ref(true);

const isArray = computed(() => Array.isArray(props.data));
const isObject = computed(() => props.data !== null && typeof props.data === 'object' && !isArray.value);
const isObjectOrArray = computed(() => isArray.value || isObject.value);

const toggle = () => {
  if (isObjectOrArray.value) {
    isOpen.value = !isOpen.value;
  }
};

const formattedValue = computed(() => {
  if (props.data === null) return 'null';
  if (typeof props.data === 'string') return `"${props.data}"`;
  return String(props.data);
});

const valueColor = computed(() => {
  if (props.data === null) return props.colors.null;
  if (typeof props.data === 'boolean') return props.colors.boolean;
  if (typeof props.data === 'number') return props.colors.number;
  if (typeof props.data === 'string') return props.colors.string;
  return props.colors.punctuation;
});
</script>

<style scoped>
.json-node {
  font-family: var(--font-code);
  font-size: 24rpx;
  line-height: 1.6;
}

.node-line {
  display: flex;
  align-items: flex-start;
  word-break: break-all;
}

.node-line:active {
  background-color: rgba(128, 128, 128, 0.1);
}

.toggle-icon-wrap {
  width: 32rpx;
  height: 38rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.arrow-icon {
  font-size: 16rpx;
  color: var(--text-muted);
  transition: transform 0.2s;
}

.is-expanded .arrow-icon {
  transform: rotate(90deg);
}

.node-preview {
  margin-left: 8rpx;
  font-style: italic;
  opacity: 0.7;
}

.node-children {
  display: flex;
  flex-direction: column;
}
</style>
