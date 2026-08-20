"use client";

import { useEffect, useMemo, useRef } from "react";
import type { Vehicle } from "@/lib/types";

type Props = {
  vehicles: Vehicle[];
};

type LeafletNS = typeof import("leaflet");

// Delhi bounding box for a sensible default view.
const DELHI_CENTER: [number, number] = [28.6139, 77.209];
const DELHI_ZOOM = 11;

function statusColor(v: Vehicle): string {
  if (v.currentStatus === "IN_TRANSIT_TO")
    return "linear-gradient(135deg,#10b981,#059669)";
  if (v.currentStatus === "STOPPED_AT")
    return "linear-gradient(135deg,#f43f5e,#be123c)";
  if (v.currentStatus === "INCOMING_AT")
    return "linear-gradient(135deg,#f59e0b,#d97706)";
  if (typeof v.speed === "number" && v.speed > 0)
    return "linear-gradient(135deg,#22d3ee,#0891b2)";
  return "linear-gradient(135deg,#a78bfa,#7c3aed)";
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export default function VehicleMap({ vehicles }: Props) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const leafletMap = useRef<import("leaflet").Map | null>(null);
  const markerLayer = useRef<import("leaflet").LayerGroup | null>(null);
  const LRef = useRef<LeafletNS | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L: LeafletNS = await import("leaflet");
      if (cancelled || !mapRef.current) return;
      LRef.current = L;
      const map = L.map(mapRef.current, {
        center: DELHI_CENTER,
        zoom: DELHI_ZOOM,
        zoomControl: true,
        preferCanvas: true,
      });
      L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
        {
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
          subdomains: "abcd",
          maxZoom: 19,
        }
      ).addTo(map);
      markerLayer.current = L.layerGroup().addTo(map);
      leafletMap.current = map;
    })();
    return () => {
      cancelled = true;
      if (leafletMap.current) {
        leafletMap.current.remove();
        leafletMap.current = null;
      }
    };
  }, []);

  const ids = useMemo(
    () => vehicles.map((v) => v.vehicleId).join(","),
    [vehicles]
  );

  useEffect(() => {
    const L = LRef.current;
    const map = leafletMap.current;
    const layer = markerLayer.current;
    if (!L || !map || !layer) return;
    layer.clearLayers();
    if (vehicles.length === 0) return;
    const markers: import("leaflet").Marker[] = [];
    for (const v of vehicles) {
      const route = v.routeId ?? "—";
      const label = route.length > 3 ? route.slice(0, 3) : route;
      const icon = L.divIcon({
        className: "bus-icon",
        iconSize: [28, 28],
        iconAnchor: [14, 14],
        html: `<div class="bus-icon-inner" style="background:${statusColor(
          v
        )};" title="${v.vehicleId}">${escapeHtml(label)}</div>`,
      });
      const m = L.marker([v.latitude, v.longitude], { icon });
      const routeInfo = v.routeId
        ? `<div>Route: <b>${escapeHtml(v.routeId)}</b></div>`
        : "";
      const tripInfo = v.tripId
        ? `<div>Trip: ${escapeHtml(v.tripId)}</div>`
        : "";
      const stopInfo = v.stopId
        ? `<div>Next stop: ${escapeHtml(v.stopId)}</div>`
        : "";
      const speed =
        typeof v.speed === "number" ? v.speed.toFixed(1) : "—";
      const bearing =
        typeof v.bearing === "number" ? `${v.bearing.toFixed(0)}°` : "—";
      const status = v.currentStatus ?? "—";
      m.bindPopup(
        `<div style="min-width:180px">
          <div style="font-weight:600;color:#c7d2fe;margin-bottom:4px">Vehicle ${escapeHtml(
            v.vehicleId
          )}</div>
          ${routeInfo}${tripInfo}${stopInfo}
          <div>Status: ${escapeHtml(status.replace(/_/g, " "))}</div>
          <div>Speed: ${speed} · Bearing: ${bearing}</div>
          <div style="color:#94a3b8;margin-top:4px">Updated ${new Date(
            v.timestamp
          ).toLocaleTimeString()}</div>
        </div>`
      );
      m.addTo(layer);
      markers.push(m);
    }
    if (markers.length > 0) {
      const group = L.featureGroup(markers);
      const bounds = group.getBounds();
      if (bounds.isValid()) {
        map.fitBounds(bounds.pad(0.15), { animate: true, maxZoom: 14 });
      }
    }
  }, [ids, vehicles]);

  return <div ref={mapRef} className="h-full w-full" />;
}
