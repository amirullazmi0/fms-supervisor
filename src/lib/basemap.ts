// Peta dasar buat semua peta Leaflet: "Peta" (OpenStreetMap) dan "Satelit" (Esri).
// Peta selalu terang, nggak ikut tema gelap.
import L from 'leaflet';

export type Basemap = 'map' | 'sat';

const LAYERS: Record<Basemap, () => L.TileLayer> = {
  map: () =>
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap' }),
  sat: () =>
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 19,
      attribution: 'Citra &copy; Esri',
    }),
};

// Pasang peta dasar ke map. Balikin fungsi buat ganti jenisnya.
export function addBasemap(m: L.Map, kind: Basemap = 'map'): (next: Basemap) => void {
  let layer = LAYERS[kind]().addTo(m);
  let current = kind;
  return (next) => {
    if (next === current) return;
    layer.remove();
    layer = LAYERS[next]().addTo(m);
    layer.bringToBack();
    current = next;
  };
}
