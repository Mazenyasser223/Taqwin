import React, { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, CircleMarker, useMap } from 'react-leaflet';
import L from 'leaflet';
import type { Gym } from '../../types';
import {
  EGYPT_MAP_CENTER,
  GYM_MAP_TILES,
  distanceKm,
  formatDistanceKm,
  hasGymCoordinates,
  resolveGymCoordinates,
} from '../../lib/gymGeo';
import { useI18n } from '../../lib/i18n/useI18n';
import 'leaflet/dist/leaflet.css';

const gymIcon = L.divIcon({
  className: '',
  html: '<div style="width:22px;height:22px;border-radius:50%;background:#ef4444;border:2.5px solid #fff;box-shadow:0 0 0 4px rgba(239,68,68,0.25),0 4px 12px rgba(0,0,0,0.35)"></div>',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

function FitGymBounds({ gyms }: { gyms: { lat: number; lng: number }[] }) {
  const map = useMap();

  useEffect(() => {
    const points: [number, number][] = gyms.map((g) => [g.lat, g.lng]);
    if (points.length === 0) {
      map.setView([EGYPT_MAP_CENTER.lat, EGYPT_MAP_CENTER.lng], 6, { animate: false });
      return;
    }
    if (points.length === 1) {
      map.setView(points[0], 14, { animate: false });
      return;
    }
    map.fitBounds(L.latLngBounds(points), { padding: [48, 48], maxZoom: 13, animate: false });
  }, [map, gyms]);

  return null;
}

/** Fly to user + nearest gym when locate button is pressed */
function FlyToUserAndNearest({
  userPos,
  nearestLat,
  nearestLng,
  locateKey,
}: {
  userPos: { lat: number; lng: number } | null;
  nearestLat?: number | null;
  nearestLng?: number | null;
  locateKey: number;
}) {
  const map = useMap();

  useEffect(() => {
    if (locateKey === 0 || !userPos) return;
    const points: [number, number][] = [[userPos.lat, userPos.lng]];
    if (nearestLat != null && nearestLng != null) points.push([nearestLat, nearestLng]);
    if (points.length === 1) {
      map.flyTo(points[0], 14, { duration: 0.8 });
      return;
    }
    map.flyToBounds(L.latLngBounds(points), { padding: [80, 80], maxZoom: 15, duration: 0.8 });
  }, [map, userPos, nearestLat, nearestLng, locateKey]);

  return null;
}

export interface GymMapViewProps {
  gyms: Gym[];
  onSelectGym: (gym: Gym) => void;
  userPos?: { lat: number; lng: number } | null;
  locateKey?: number;
  nearestGymId?: string | null;
}

export const GymMapView: React.FC<GymMapViewProps> = ({
  gyms,
  onSelectGym,
  userPos = null,
  locateKey = 0,
  nearestGymId = null,
}) => {
  const { t, language } = useI18n();

  const mappable = useMemo(
    () =>
      gyms
        .map((gym) => {
          const coords = resolveGymCoordinates(gym);
          if (!coords) return null;
          const distance = userPos
            ? distanceKm(userPos.lat, userPos.lng, coords.lat, coords.lng)
            : null;
          return { gym, ...coords, distance };
        })
        .filter(Boolean)
        .sort((a, b) => {
          if (a!.distance == null && b!.distance == null) return 0;
          if (a!.distance == null) return 1;
          if (b!.distance == null) return -1;
          return a!.distance - b!.distance;
        }) as { gym: Gym; lat: number; lng: number; distance: number | null }[],
    [gyms, userPos],
  );

  const nearestEntry = nearestGymId
    ? mappable.find((m) => m.gym.id === nearestGymId) ?? mappable[0]
    : mappable[0];

  const boundsPoints = useMemo(
    () => mappable.map((g) => ({ lat: g.lat, lng: g.lng })),
    [mappable],
  );

  if (mappable.length === 0) {
    return (
      <div className="glass-panel rounded-3xl p-10 text-center text-muted min-h-[420px] flex flex-col items-center justify-center gap-3">
        <span className="material-symbols-outlined text-4xl text-faint">map</span>
        <p>{t('gyms.mapEmpty')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-3xl border border-subtle shadow-default min-h-[420px] h-[min(70vh,560px)] [&_.leaflet-container]:h-full [&_.leaflet-container]:w-full [&_.leaflet-container]:rounded-3xl [&_.leaflet-control-attribution]:text-[9px] [&_.leaflet-popup-content-wrapper]:rounded-xl [&_.leaflet-popup-content]:m-2">
        <MapContainer
          center={[EGYPT_MAP_CENTER.lat, EGYPT_MAP_CENTER.lng]}
          zoom={6}
          scrollWheelZoom
          className="z-0"
        >
          <TileLayer url={GYM_MAP_TILES.url} attribution={GYM_MAP_TILES.attribution} />
          <FitGymBounds gyms={boundsPoints} />
          <FlyToUserAndNearest
            userPos={userPos}
            nearestLat={nearestEntry?.lat}
            nearestLng={nearestEntry?.lng}
            locateKey={locateKey}
          />
          {userPos && (
            <CircleMarker
              center={[userPos.lat, userPos.lng]}
              radius={8}
              pathOptions={{ color: '#38bdf8', fillColor: '#0ea5e9', fillOpacity: 0.9, weight: 2 }}
            />
          )}
          {mappable.map(({ gym, lat, lng, distance }) => (
            <Marker
              key={gym.id}
              position={[lat, lng]}
              icon={gymIcon}
              eventHandlers={{ click: () => onSelectGym(gym) }}
            >
              <Popup>
                <div className="min-w-[160px] space-y-1">
                  <p className="font-bold text-sm">{gym.name}</p>
                  <p className="text-xs text-gray-500">{gym.location}</p>
                  {distance != null && (
                    <p className="text-xs text-teal-600 font-semibold">
                      {formatDistanceKm(distance, language)}
                    </p>
                  )}
                  <button
                    type="button"
                    className="mt-2 text-xs font-bold text-teal-700 hover:underline"
                    onClick={() => onSelectGym(gym)}
                  >
                    {t('gyms.viewProfile')}
                  </button>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
      {!gyms.some((g) => hasGymCoordinates(g)) && (
        <p className="text-[11px] text-faint">{t('gyms.mapFallbackHint')}</p>
      )}
    </div>
  );
};
