<template>
  <div class="pin-map" :class="{ compare: Boolean(comparePoint) }" role="application" :aria-label="ariaLabel">
    <div ref="el" class="pin-map-canvas directory-pin-map-canvas"></div>
    <p v-if="comparePoint" class="pin-legend">
      <span>Now — on the site</span>
      <span>Proposed — this update</span>
    </p>
    <p class="sr-only">{{ ariaLabel }}</p>
  </div>
</template>

<script>
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const PORIRUA = { lat: -41.134, lng: 174.84, zoom: 12 };
const TILES = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const ABSENCE_MS = 3000;

function asCoord(value) {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function pointFrom(lat, lng) {
  const resolvedLat = asCoord(lat);
  const resolvedLng = asCoord(lng);
  if (resolvedLat == null || resolvedLng == null) return null;
  return { lat: resolvedLat, lng: resolvedLng };
}

function pinIcon(kind, label) {
  return L.divIcon({
    className: `directory-pin directory-pin-${kind}`,
    html: `<span class="directory-pin-caption">${label}</span><span class="directory-pin-dot"></span>`,
    iconSize: [72, 36],
    iconAnchor: [36, 34],
  });
}

function mapHasUsableSize(el) {
  return Boolean(el && el.clientWidth >= 40 && el.clientHeight >= 40);
}

export default {
  props: {
    lat: { type: [Number, String], default: null },
    lng: { type: [Number, String], default: null },
    compareLat: { type: [Number, String], default: null },
    compareLng: { type: [Number, String], default: null },
    draggable: { type: Boolean, default: false },
  },
  emits: ["move", "tiles-failed"],
  data() {
    return {
      map: null,
      tiles: null,
      marker: null,
      compareMarker: null,
      resizeObserver: null,
      sized: false,
      tilesLoaded: 0,
      tilesFailed: false,
      absenceTimer: null,
      absenceWatching: false,
    };
  },
  computed: {
    point() {
      return pointFrom(this.lat, this.lng);
    },
    comparePoint() {
      const next = pointFrom(this.compareLat, this.compareLng);
      if (!next || !this.point) return null;
      if (next.lat === this.point.lat && next.lng === this.point.lng) return null;
      return next;
    },
    ariaLabel() {
      if (this.draggable) return "Map pin. Drag the pin if the place is wrong.";
      if (this.comparePoint) {
        return "Map showing the current pin and the proposed pin. Now is on the site. Proposed is this update.";
      }
      return "Map pin for this listing.";
    },
  },
  watch: {
    point: {
      deep: true,
      handler() {
        this.syncMarkers();
      },
    },
    comparePoint: {
      deep: true,
      handler() {
        this.syncMarkers();
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
    }).setView([PORIRUA.lat, PORIRUA.lng], PORIRUA.zoom);
    this.tiles = L.tileLayer(TILES, {
      attribution: "&copy; OpenStreetMap",
      maxZoom: 19,
    });
    this.tiles.on("tileload", () => {
      this.tilesLoaded += 1;
    });
    this.tiles.on("tileerror", () => this.failTiles());
    this.tiles.addTo(this.map);
    this.syncMarkers();
    if (this.draggable) {
      this.map.on("click", (event) => {
        this.$emit("move", { lat: event.latlng.lat, lng: event.latlng.lng });
      });
    }
    this.resizeObserver = new ResizeObserver(() => {
      this.syncViewport();
    });
    this.resizeObserver.observe(this.$refs.el);
    this.$nextTick(() => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => this.syncViewport());
      });
    });
  },
  beforeUnmount() {
    this.clearAbsenceTimer();
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.map?.remove();
    this.map = null;
    this.tiles = null;
    this.marker = null;
    this.compareMarker = null;
  },
  methods: {
    failTiles() {
      if (this.tilesFailed) return;
      this.tilesFailed = true;
      this.clearAbsenceTimer();
      this.$emit("tiles-failed");
    },
    clearAbsenceTimer() {
      if (this.absenceTimer) {
        clearTimeout(this.absenceTimer);
        this.absenceTimer = null;
      }
    },
    startAbsenceWatch() {
      if (this.absenceWatching || this.tilesFailed) return;
      this.absenceWatching = true;
      this.absenceTimer = setTimeout(() => {
        this.absenceTimer = null;
        if (this.tilesFailed) return;
        if (!mapHasUsableSize(this.$refs.el)) {
          this.absenceWatching = false;
          return;
        }
        if (this.tilesLoaded === 0) this.failTiles();
      }, ABSENCE_MS);
    },
    syncViewport() {
      if (!this.map || !this.$refs.el) return;
      if (!mapHasUsableSize(this.$refs.el)) return;
      this.map.invalidateSize();
      if (!this.sized) {
        this.sized = true;
        this.fitView();
      }
      this.startAbsenceWatch();
    },
    upsertMarker(existing, point, { kind, label, draggable }) {
      if (!point) {
        existing?.remove();
        return null;
      }
      const latlng = [point.lat, point.lng];
      if (!existing) {
        const marker = L.marker(latlng, {
          draggable,
          keyboard: true,
          title: label,
          icon: pinIcon(kind, label),
        }).addTo(this.map);
        if (draggable) {
          marker.on("dragend", () => {
            const next = marker.getLatLng();
            this.$emit("move", { lat: next.lat, lng: next.lng });
          });
        }
        return marker;
      }
      existing.setLatLng(latlng);
      existing.dragging?.[draggable ? "enable" : "disable"]?.();
      return existing;
    },
    syncMarkers() {
      if (!this.map) return;
      this.marker = this.upsertMarker(this.marker, this.point, {
        kind: this.comparePoint ? "now" : "single",
        label: this.comparePoint ? "Now" : this.ariaLabel,
        draggable: this.draggable,
      });
      this.compareMarker = this.upsertMarker(this.compareMarker, this.comparePoint, {
        kind: "proposed",
        label: "Proposed",
        draggable: false,
      });
      this.fitView();
    },
    fitView() {
      if (!this.map) return;
      if (this.point && this.comparePoint) {
        this.map.fitBounds([
          [this.point.lat, this.point.lng],
          [this.comparePoint.lat, this.comparePoint.lng],
        ], { padding: [28, 28], maxZoom: 16 });
        return;
      }
      if (this.point) {
        this.map.setView([this.point.lat, this.point.lng], Math.max(this.map.getZoom() || 0, 16));
        return;
      }
      this.map.setView([PORIRUA.lat, PORIRUA.lng], PORIRUA.zoom);
    },
  },
};
</script>

<style>
@import "leaflet/dist/leaflet.css";

.directory-pin-map-canvas.leaflet-container {
  width: 100% !important;
  height: 160px !important;
  min-height: 160px !important;
  background: #ddd;
}
.pin-map.compare .directory-pin-map-canvas.leaflet-container {
  height: 200px !important;
  min-height: 200px !important;
}
.directory-pin-map-canvas.leaflet-container img.leaflet-tile {
  mix-blend-mode: normal !important;
  max-width: none !important;
  max-height: none !important;
}
</style>

<style scoped>
.pin-map {
  flex: 1 1 100%;
  width: 100%;
  min-width: 100%;
  min-height: 160px;
}
.pin-map-canvas {
  width: 100%;
  height: 160px;
  min-height: 160px;
  border-radius: 8px;
  z-index: 1;
  background: #ddd;
}
.pin-map.compare .pin-map-canvas {
  height: 200px;
  min-height: 200px;
}
.pin-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
  margin: 6px 0 0;
  font-size: 0.85rem;
  color: var(--theme--foreground);
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
  text-align: center;
}
.directory-pin-caption {
  display: block;
  font: 600 11px/1.2 system-ui, sans-serif;
  color: var(--theme--foreground, #172940);
  text-shadow: 0 0 3px #fff, 0 0 3px #fff;
}
.directory-pin-dot {
  display: block;
  width: 18px;
  height: 18px;
  margin: 2px auto 0;
  border-radius: 50% 50% 50% 0;
  transform: rotate(-45deg);
  background: var(--theme--primary, #6644ff);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.35);
}
.directory-pin-now .directory-pin-dot {
  background: #fff;
  border: 3px solid var(--theme--foreground, #172940);
  box-sizing: border-box;
}
.directory-pin-proposed .directory-pin-dot {
  background: var(--theme--primary, #6644ff);
}
</style>
