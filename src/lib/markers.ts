// Penanda truk di peta Leaflet (gayanya di index.css: .tm*). Dipakai peta Live & Lacak truk.
import L from 'leaflet';
import { statusOf } from './format';
import type { Device } from '@/types/fleet';

export const escHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c);

// Truk dilihat dari samping, siluet penuh: bak, kabin (+ kaca), 2 roda. Warna bak/kabin = warna status (currentColor).
export const TRUCK_GLYPH =
  '<svg viewBox="0 0 24 24" aria-hidden="true">' +
  '<rect class="tk-body" x="1" y="5" width="13" height="11" rx="1.2" />' +
  '<path class="tk-body" d="M14.6 8.5h3.7a1 1 0 0 1 .8.4l3.2 4.1a1 1 0 0 1 .2.6V16h-7.9z" />' +
  '<path class="tk-win" d="M16.2 10h2l1.9 2.5h-3.9z" />' +
  '<circle class="tk-wheel" cx="5.5" cy="17.3" r="2.2" /><circle class="tk-wheel" cx="18" cy="17.3" r="2.2" />' +
  '</svg>';

// Ikon truk (tanpa lingkaran) + label. Panah kecil nunjukin arah kalau lagi jalan. Panah kecil nunjukin arah kalau lagi jalan.
export function truckIcon(d: Device, label: string, selected: boolean): L.DivIcon {
  const st = statusOf(d);
  const dir = st === 'moving' ? `<span class="tm-dir" style="--rot:${d.pos?.angle ?? 0}deg"></span>` : '';
  return L.divIcon({
    className: '',
    iconSize: [44, 44],
    iconAnchor: [22, 22],
    html: `<div class="tm tm-${st}${selected ? ' sel' : ''}">${dir}<span class="tm-dot">${TRUCK_GLYPH}</span><span class="tm-label">${escHtml(label)}</span></div>`,
  });
}

// Penanda posisi waktu putar ulang rute.
export function playIcon(angle: number): L.DivIcon {
  return L.divIcon({
    className: '',
    iconSize: [44, 44],
    iconAnchor: [22, 22],
    html: `<div class="tm tm-play sel"><span class="tm-dir" style="--rot:${angle}deg"></span><span class="tm-dot">${TRUCK_GLYPH}</span></div>`,
  });
}

// Warna garis rute di peta (peta selalu terang, jadi warnanya tetap).
export const ROUTE_COLOR = '#2f6fe4';
