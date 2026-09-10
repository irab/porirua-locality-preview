<template>
  <div class="verify">
    <a
      v-if="website"
      class="verify-link"
      :href="website"
      target="_blank"
      rel="noopener noreferrer"
    >Website</a>
    <a v-if="phone" class="verify-link" :href="'tel:' + phone">{{ phone }}</a>
    <p v-if="address" class="verify-address">
      <span v-if="addressNote" class="verify-note">{{ addressNote }}</span>
      {{ address }}
    </p>
    <pin-map
      v-if="showMap && pin && !tilesFailed"
      :lat="pin.lat"
      :lng="pin.lng"
      :compare-lat="comparePin?.lat"
      :compare-lng="comparePin?.lng"
      @tiles-failed="tilesFailed = true"
    />
  </div>
</template>

<script>
import PinMap from "./pin-map.vue";

export default {
  components: { PinMap },
  props: {
    website: { type: String, default: "" },
    phone: { type: String, default: "" },
    address: { type: String, default: "" },
    addressNote: { type: String, default: "" },
    pin: { type: Object, default: null },
    comparePin: { type: Object, default: null },
    showMap: { type: Boolean, default: false },
  },
  data() {
    return { tilesFailed: false };
  },
  watch: {
    pin() {
      this.tilesFailed = false;
    },
  },
};
</script>

<style scoped>
.verify {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
  align-items: stretch;
  margin: 12px 0 4px;
}
.verify-link {
  color: var(--theme--primary);
}
.verify-address {
  margin: 0;
  width: 100%;
  color: #2a2f3d;
}
.verify-note {
  display: block;
  color: #2a2f3d;
  font-size: 1rem;
  font-weight: 600;
}
.verify :deep(.pin-map) {
  flex: 1 1 100%;
  width: 100%;
  min-width: 100%;
}
</style>
