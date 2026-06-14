import React, { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import type { LatLngExpression } from 'leaflet';
import { EGYPT_MAP_CENTER, GYM_MAP_TILES } from '../../lib/gymGeo';
import { useI18n } from '../../lib/i18n/useI18n';
import 'leaflet/dist/leaflet.css';

const pickerIcon = L.divIcon({
  className: '',
  html: '<div style="width:28px;height:28px;border-radius:50%;background:#ef4444;border:3px solid #fff;box-shadow:0 4px 14px rgba(239,68,68,0.55)"></div>',
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

function MapRecenter({ center, zoom }: { center: LatLngExpression; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom, { animate: false });
  }, [map, center, zoom]);
  return null;
}

function DraggablePin({
  position,
  onChange,
}: {
  position: { lat: number; lng: number };
  onChange: (lat: number, lng: number) => void;
}) {
  const [pos, setPos] = useState(position);

  useEffect(() => {
    setPos(position);
  }, [position.lat, position.lng]);

  const markerRef = React.useRef<L.Marker>(null);

  const eventHandlers = useMemo(
    () => ({
      dragend() {
        const marker = markerRef.current;
        if (!marker) return;
        const ll = marker.getLatLng();
        setPos({ lat: ll.lat, lng: ll.lng });
        onChange(ll.lat, ll.lng);
      },
    }),
    [onChange],
  );

  return (
    <Marker
      draggable
      eventHandlers={eventHandlers}
      position={pos}
      ref={markerRef}
      icon={pickerIcon}
    />
  );
}

function MapClickHandler({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export interface GymLocationPickerProps {
  latitude: number | null;
  longitude: number | null;
  onChange: (lat: number, lng: number) => void;
}

export const GymLocationPicker: React.FC<GymLocationPickerProps> = ({
  latitude,
  longitude,
  onChange,
}) => {
  const { t } = useI18n();
  const [geoError, setGeoError] = useState<string | null>(null);

  const position = useMemo(
    () => ({
      lat: latitude ?? EGYPT_MAP_CENTER.lat,
      lng: longitude ?? EGYPT_MAP_CENTER.lng,
    }),
    [latitude, longitude],
  );

  const hasPin = latitude != null && longitude != null;

  const useMyLocation = () => {
    setGeoError(null);
    if (!navigator.geolocation) {
      setGeoError(t('profile.gymLocationGeoUnsupported'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => onChange(pos.coords.latitude, pos.coords.longitude),
      () => setGeoError(t('profile.gymLocationGeoDenied')),
      { enableHighAccuracy: true, timeout: 12000 },
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted">{t('profile.gymLocationHint')}</p>
        <button
          type="button"
          onClick={useMyLocation}
          className="inline-flex items-center gap-1.5 rounded-xl border border-subtle bg-elevated px-3 py-2 text-xs font-bold text-foreground hover:border-primary/40"
        >
          <span className="material-symbols-outlined text-sm">my_location</span>
          {t('profile.gymLocationUseMine')}
        </button>
      </div>
      {geoError && <p className="text-xs text-red-400">{geoError}</p>}
      <div className="overflow-hidden rounded-2xl border border-subtle h-[280px] sm:h-[320px] [&_.leaflet-container]:h-full [&_.leaflet-container]:w-full [&_.leaflet-container]:rounded-2xl [&_.leaflet-control-attribution]:text-[9px]">
        <MapContainer
          center={[position.lat, position.lng]}
          zoom={hasPin ? 15 : 11}
          scrollWheelZoom
          className="z-0"
        >
          <TileLayer url={GYM_MAP_TILES.url} attribution={GYM_MAP_TILES.attribution} />
          <MapRecenter center={[position.lat, position.lng]} zoom={hasPin ? 15 : 11} />
          <MapClickHandler onPick={onChange} />
          {hasPin && <DraggablePin position={position} onChange={onChange} />}
        </MapContainer>
      </div>
      {hasPin ? (
        <p className="text-[11px] text-faint font-mono">
          {t('profile.gymLocationCoords', {
            lat: position.lat.toFixed(5),
            lng: position.lng.toFixed(5),
          })}
        </p>
      ) : (
        <p className="text-[11px] text-amber-400/90">{t('profile.gymLocationRequired')}</p>
      )}
    </div>
  );
};
