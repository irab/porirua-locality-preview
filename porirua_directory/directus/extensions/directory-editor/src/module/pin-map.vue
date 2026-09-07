<template>
  <div class="pin-map" role="application" :aria-label="ariaLabel">
    <div ref="el" class="pin-map-canvas"></div>
    <p class="sr-only">{{ ariaLabel }}</p>
  </div>
</template>

<script>
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const PORIRUA = { lat: -41.134, lng: 174.84, zoom: 12 };

function asCoord(value) {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export default {
  props: {
    lat: { type: [Number, String], default: null },
    lng: { type: [Number, String], default: null },
    draggable: { type: Boolean, default: false },
  },
  emits: ["move", "tiles-failed"],
  data() {
    return {
      map: null,
      marker: null,
    };
  },
  computed: {
    point() {
      const lat = asCoord(this.lat);
      const lng = asCoord(this.lng);
      if (lat == null || lng == null) return null;
      return { lat, lng };
    },
    ariaLabel() {
      if (this.draggable) return "Map pin. Drag the pin if the place is wrong.";
      return "Map pin for this listing.";
    },
  },
  watch: {
    point: {
      deep: true,
      handler() {
        this.syncMarker();
      },
    },
    draggable() {
      if (this.marker) this.marker.dragging?.[this.draggable ? "enable" : "disable"]?.();
    },
  },
  mounted() {
    this.map = L.map(this.$refs.el, {
      scrollWheelZoom: false,
      zoomControl: true,
    }).setView(
      this.point ? [this.point.lat, this.point.lng] : [PORIRUA.lat, PORIRUA.lng],
      this.point ? 16 : PORIRUA.zoom
    );
    const tiles = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap",
      maxZoom: 18,
    });
    let tileErrors = 0;
    tiles.on("tileerror", () => {
      tileErrors += 1;
      if (tileErrors >= 3) this.$emit("tiles-failed");
    });
    tiles.addTo(this.map);
    this.syncMarker();
    if (this.draggable) {
      this.map.on("click", (event) => {
        this.$emit("move", { lat: event.latlng.lat, lng: event.latlng.lng });
      });
    }
    this.$nextTick(() => {
      this.map.invalidateSize();
      requestAnimationFrame(() => this.map?.invalidateSize());
    });
  },
  beforeUnmount() {
    this.map?.remove();
    this.map = null;
    this.marker = null;
  },
  methods: {
    syncMarker() {
      if (!this.map) return;
      if (!this.point) {
        if (this.marker) {
          this.marker.remove();
          this.marker = null;
        }
        this.map.setView([PORIRUA.lat, PORIRUA.lng], PORIRUA.zoom);
        return;
      }
      const latlng = [this.point.lat, this.point.lng];
      if (!this.marker) {
        this.marker = L.marker(latlng, {
          draggable: this.draggable,
          keyboard: true,
          title: this.ariaLabel,
          icon: L.divIcon({
            className: "directory-pin",
            html: '<span class="directory-pin-dot"></span>',
            iconSize: [28, 28],
            iconAnchor: [14, 26],
          }),
        }).addTo(this.map);
        this.marker.on("dragend", () => {
          const next = this.marker.getLatLng();
          this.$emit("move", { lat: next.lat, lng: next.lng });
        });
      } else {
        this.marker.setLatLng(latlng);
      }
      this.marker.dragging?.[this.draggable ? "enable" : "disable"]?.();
      this.map.setView(latlng, Math.max(this.map.getZoom(), 16));
    },
  },
};
</script>

<style>
@import "leaflet/dist/leaflet.css";
</style>

<style scoped>
.pin-map {
  width: 100%;
}
.pin-map-canvas {
  width: 100%;
  height: 160px;
  border-radius: 8px;
  z-index: 1;
  background: var(--theme--background-normal, #f0f0f0);
}
.pin-map-canvas :deep(.leaflet-container) {
  width: 100%;
  height: 160px;
}
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
}
</style>

<style>
.directory-pin {
  background: transparent;
  border: 0;
}
.directory-pin-dot {
  display: block;
  width: 22px;
  height: 22px;
  margin: 3px auto 0;
  border-radius: 50% 50% 50% 0;
  transform: rotate(-45deg);
  background: var(--theme--primary, #6644ff);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.35);
}
</style>
