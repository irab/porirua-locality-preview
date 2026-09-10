"use client";

import { useEffect, useRef } from "react";
import type { Map as LeafletMap, Marker, TileLayer } from "leaflet";
import "leaflet/dist/leaflet.css";

const PORIRUA = { lat: -41.134, lng: 174.84, zoom: 12 };
const TILES = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const ABSENCE_MS = 3000;

export type Pin = { lat: number; lng: number };

export type PinMapProps = {
  pin?: Pin | null;
  comparePin?: Pin | null;
  draggable?: boolean;
  onMove?: (pin: Pin) => void;
  onTilesFailed?: () => void;
};

function samePin(a?: Pin | null, b?: Pin | null) {
  if (!a || !b) return a === b;
  return a.lat === b.lat && a.lng === b.lng;
}

// A pane narrower than a tile renders grey, so wait for a real size before
// fitting the view or judging whether tiles arrived.
function hasUsableSize(el: HTMLElement | null) {
  return Boolean(el && el.clientWidth >= 40 && el.clientHeight >= 40);
}

function ariaLabelFor(draggable: boolean, comparePin?: Pin | null) {
  if (draggable) return "Map pin. Drag the pin if the place is wrong.";
  if (comparePin) {
    return "Map showing the current pin and the proposed pin. Now is on the site. Proposed is this update.";
  }
  return "Map pin for this listing.";
}

export function PinMap({ pin = null, comparePin = null, draggable = false, onMove, onTilesFailed }: PinMapProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const compareMarkerRef = useRef<Marker | null>(null);
  // Callbacks and pins are read through refs so the map is built once and then
  // updated in place, rather than torn down on every parent render.
  const onMoveRef = useRef(onMove);
  const onTilesFailedRef = useRef(onTilesFailed);
  const stateRef = useRef({ pin, comparePin, draggable });

  onMoveRef.current = onMove;
  onTilesFailedRef.current = onTilesFailed;

  const shownCompare = samePin(pin, comparePin) ? null : comparePin;
  const label = ariaLabelFor(draggable, shownCompare);

  useEffect(() => {
    let cancelled = false;
    let cleanup: (() => void) | undefined;

    // Leaflet touches window at import time, so it is only pulled in here.
    void import("leaflet").then(({ default: L }) => {
      const canvas = canvasRef.current;
      if (cancelled || !canvas || mapRef.current) return;

      const map = L.map(canvas, { scrollWheelZoom: false, zoomControl: true }).setView(
        [PORIRUA.lat, PORIRUA.lng],
        PORIRUA.zoom
      );
      mapRef.current = map;

      let tilesLoaded = 0;
      let tilesFailed = false;
      let absenceTimer: ReturnType<typeof setTimeout> | null = null;
      let sized = false;

      const failTiles = () => {
        if (tilesFailed) return;
        tilesFailed = true;
        if (absenceTimer) clearTimeout(absenceTimer);
        absenceTimer = null;
        onTilesFailedRef.current?.();
      };

      const tiles: TileLayer = L.tileLayer(TILES, {
        attribution: "&copy; OpenStreetMap",
        maxZoom: 19,
      });
      tiles.on("tileload", () => {
        tilesLoaded += 1;
      });
      tiles.on("tileerror", failTiles);
      tiles.addTo(map);

      const pinIcon = (kind: string, caption: string) =>
        L.divIcon({
          className: `directory-pin directory-pin-${kind}`,
          html: `<span class="directory-pin-caption">${caption}</span><span class="directory-pin-dot"></span>`,
          iconSize: [72, 36],
          iconAnchor: [36, 34],
        });

      const fitView = () => {
        const { pin: current, comparePin: compare } = stateRef.current;
        const other = samePin(current, compare) ? null : compare;
        if (current && other) {
          map.fitBounds(
            [
              [current.lat, current.lng],
              [other.lat, other.lng],
            ],
            { padding: [28, 28], maxZoom: 16 }
          );
          return;
        }
        if (current) {
          map.setView([current.lat, current.lng], Math.max(map.getZoom() || 0, 16));
          return;
        }
        map.setView([PORIRUA.lat, PORIRUA.lng], PORIRUA.zoom);
      };

      const upsert = (
        existing: Marker | null,
        point: Pin | null,
        options: { kind: string; caption: string; canDrag: boolean }
      ) => {
        if (!point) {
          existing?.remove();
          return null;
        }
        const latlng: [number, number] = [point.lat, point.lng];
        if (existing) {
          existing.setLatLng(latlng);
          if (options.canDrag) existing.dragging?.enable();
          else existing.dragging?.disable();
          return existing;
        }
        const marker = L.marker(latlng, {
          draggable: options.canDrag,
          keyboard: true,
          title: options.caption,
          icon: pinIcon(options.kind, options.caption),
        }).addTo(map);
        if (options.canDrag) {
          marker.on("dragend", () => {
            const next = marker.getLatLng();
            onMoveRef.current?.({ lat: next.lat, lng: next.lng });
          });
        }
        return marker;
      };

      const syncMarkers = () => {
        const { pin: current, comparePin: compare, draggable: canDrag } = stateRef.current;
        const other = samePin(current, compare) ? null : compare;
        markerRef.current = upsert(markerRef.current, current, {
          kind: other ? "now" : "single",
          caption: other ? "Now" : "Pin",
          canDrag,
        });
        compareMarkerRef.current = upsert(compareMarkerRef.current, other, {
          kind: "proposed",
          caption: "Proposed",
          canDrag: false,
        });
        fitView();
      };

      // The map is often built inside a panel that is still laying out, so
      // Leaflet must be told the size once the pane is really on screen.
      const syncViewport = () => {
        if (!hasUsableSize(canvas)) return;
        map.invalidateSize();
        if (!sized) {
          sized = true;
          fitView();
        }
        if (absenceTimer || tilesFailed) return;
        absenceTimer = setTimeout(() => {
          absenceTimer = null;
          if (tilesFailed || !hasUsableSize(canvas)) return;
          if (tilesLoaded === 0) failTiles();
        }, ABSENCE_MS);
      };

      if (draggable) {
        map.on("click", (event) => {
          onMoveRef.current?.({ lat: event.latlng.lat, lng: event.latlng.lng });
        });
      }

      syncMarkers();
      const observer = new ResizeObserver(() => syncViewport());
      observer.observe(canvas);
      requestAnimationFrame(() => requestAnimationFrame(() => syncViewport()));

      (map as LeafletMap & { __syncMarkers?: () => void }).__syncMarkers = syncMarkers;

      cleanup = () => {
        if (absenceTimer) clearTimeout(absenceTimer);
        observer.disconnect();
        map.remove();
      };
    });

    return () => {
      cancelled = true;
      cleanup?.();
      mapRef.current = null;
      markerRef.current = null;
      compareMarkerRef.current = null;
    };
  }, []);

  useEffect(() => {
    stateRef.current = { pin, comparePin, draggable };
    const map = mapRef.current as (LeafletMap & { __syncMarkers?: () => void }) | null;
    map?.__syncMarkers?.();
  }, [pin?.lat, pin?.lng, comparePin?.lat, comparePin?.lng, draggable]);

  return (
    <div className={shownCompare ? "pin-map compare" : "pin-map"} role="application" aria-label={label}>
      <div ref={canvasRef} className="pin-map-canvas" />
      {shownCompare ? (
        <p className="pin-legend">
          <span>Now — on the site</span>
          <span>Proposed — this update</span>
        </p>
      ) : null}
    </div>
  );
}
