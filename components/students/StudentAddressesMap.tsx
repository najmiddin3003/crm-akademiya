"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import Link from "next/link";

export interface StudentAddress {
  id: number;
  name: string;
  phone: string;
  addressType: string;
  addressLabel: string;
  filial: string;
  lat: number;
  lng: number;
}

// Leaflet'ning standart marker rasm-yo'llari bundler bilan sinadi (Turbopack
// ham bundan mustasno emas) — shu sabab tayyor rasm o'rniga CSS DivIcon
// ishlatilgan (o'lcham/rang joriy --primary mavzu rangiga moslashadi).
const markerIcon = L.divIcon({
  className: "",
  html: `<span style="display:block;width:16px;height:16px;border-radius:50%;background:hsl(var(--primary));border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,.4)"></span>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
  popupAnchor: [0, -8],
});

const TASHKENT_CENTER: [number, number] = [41.2995, 69.2401];

export default function StudentAddressesMap({ addresses }: { addresses: StudentAddress[] }) {
  return (
    <MapContainer
      center={TASHKENT_CENTER}
      zoom={11}
      scrollWheelZoom
      className="h-full w-full"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {addresses.map((a) => (
        <Marker key={a.id} position={[a.lat, a.lng]} icon={markerIcon}>
          <Popup>
            <div className="text-sm space-y-1 min-w-[160px]">
              <Link href={`/student-edit/${a.id}`} className="font-semibold text-primary hover:underline">
                {a.name}
              </Link>
              <div className="text-muted-foreground">{a.phone}</div>
              <div>{a.addressType} &middot; {a.addressLabel}</div>
              <div className="text-xs text-muted-foreground">{a.filial}</div>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
