// Gambar titik (master titik) di peta Leaflet: lingkaran sesuai radius + penanda.
// Titik nggak punya jenis tetap. Kalau lagi nampilin rute, perannya (loading/unloading) dikasih lewat `roles`.
import L from 'leaflet';
import type { Site, SiteType } from '@/types/fleet';

export type SiteRole = SiteType | null;

export const ROLE_COLOR: Record<SiteType | 'none', string> = { loading: '#16a34a', unloading: '#e07b00', none: '#2f6fe4' };
export const ROLE_LABEL: Record<SiteType, string> = { loading: 'Loading', unloading: 'Unloading' };

export const escHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c);

const letter = (role: SiteRole) => (role === 'loading' ? 'L' : role === 'unloading' ? 'U' : '');

export function siteIcon(name: string, role: SiteRole = null, selected = false): L.DivIcon {
  return L.divIcon({
    className: '',
    iconSize: [26, 26],
    iconAnchor: [13, 13],
    html: `<div class="site-mk site-${role ?? 'none'}${selected ? ' sel' : ''}">${letter(role)}<span class="site-mk-label">${escHtml(name)}</span></div>`,
  });
}

export function siteCircle(site: Pick<Site, 'lat' | 'lng' | 'radius'>, role: SiteRole = null, selected = false): L.Circle {
  return L.circle([site.lat, site.lng], {
    radius: site.radius,
    color: ROLE_COLOR[role ?? 'none'],
    weight: selected ? 3 : 2,
    fillOpacity: selected ? 0.3 : 0.18,
    interactive: false,
  });
}

// Isi popup waktu titik diklik.
export function sitePopup(s: Site, role: SiteRole, truckName: (imei: string) => string = (i) => i): string {
  const trucks = s.imeis.length ? s.imeis.map((i) => escHtml(truckName(i))).join(', ') : '<i>Nggak ada yang lagi jalan</i>';
  return `<div class="map-pop">
    <div class="mp-title"><span class="site-dot site-${role ?? 'none'}">${letter(role)}</span>${escHtml(s.name)}</div>
    <dl>
      ${role ? `<dt>Di rute ini</dt><dd>${ROLE_LABEL[role]}</dd>` : ''}
      <dt>Radius</dt><dd>${s.radius} m</dd>
      <dt>Lagi jalan</dt><dd>${trucks}</dd>
      <dt>Koordinat</dt><dd class="mono">${s.lat.toFixed(6)}, ${s.lng.toFixed(6)}</dd>
      ${s.note ? `<dt>Catatan</dt><dd>${escHtml(s.note)}</dd>` : ''}
    </dl>
  </div>`;
}

interface DrawOpts {
  onClick?: (id: string) => void;
  selectedId?: string | null;
  truckName?: (imei: string) => string;
  roles?: Map<string, SiteType>; // peran titik di rute yang lagi ditampilin
}

// Lingkaran + penanda untuk semua titik ke dalam satu layer group (dikosongin dulu). Klik penanda = popup info.
export function drawSites(group: L.LayerGroup, sites: Site[], { onClick, selectedId, truckName, roles }: DrawOpts = {}): Map<string, L.Marker> {
  group.clearLayers();
  const markers = new Map<string, L.Marker>();
  for (const s of sites) {
    const sel = s.id === selectedId;
    const role = roles?.get(s.id) ?? null;
    siteCircle(s, role, sel).addTo(group);
    const mk = L.marker([s.lat, s.lng], { icon: siteIcon(s.name, role, sel), title: `${role ? `${ROLE_LABEL[role]}: ` : ''}${s.name} (${s.radius} m)`, zIndexOffset: sel ? 800 : role ? 400 : 200 });
    mk.bindPopup(sitePopup(s, role, truckName), { maxWidth: 260 });
    if (onClick) mk.on('click', () => onClick(s.id));
    mk.addTo(group);
    markers.set(s.id, mk);
  }
  return markers;
}
