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
    <p v-if="address" class="verify-address">{{ address }}</p>
    <pin-map v-if="showMap && pin" :lat="pin.lat" :lng="pin.lng" />
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
    pin: { type: Object, default: null },
    showMap: { type: Boolean, default: false },
  },
};
</script>

<style scoped>
.verify {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
  align-items: center;
  margin: 8px 0 12px;
}
.verify-link {
  color: var(--theme--primary);
}
.verify-address {
  margin: 0;
  width: 100%;
}
</style>
