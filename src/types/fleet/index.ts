// Tipe data armada (port dari fmctest/server/types.ts). Bentuknya sama dengan JSON `data` dari fms-backend.

export type IoValue = number | string;
export type IoMapValues = Record<string, IoValue>;

export interface AvlRecord {
  time: number;
  priority: number;
  lat: number;
  lng: number;
  alt: number;
  angle: number;
  sats: number;
  speed: number;
  eventIo: number;
  valid: boolean;
  io: IoMapValues;
}

export interface IoDef {
  name: string;
  group: IoGroup;
  size: 1 | 2 | 4 | 8;
  unit?: string;
  scale?: number;
  kind?: 'bool' | 'hex' | 'id'; // id = kode/nomor, ditampilin apa adanya tanpa pemisah ribuan
  enum?: Record<number, string>;
  signed?: boolean;
}

export type IoGroup = 'status' | 'gnss' | 'power' | 'io' | 'driving' | 'can';

export interface HistoryPoint {
  t: number;
  lat: number;
  lng: number;
  v: boolean;
  speed: number;
  angle: number;
  sats: number;
  ign?: IoValue;
  ext?: IoValue;
}

export interface Device {
  imei: string;
  name: string | null;
  // Info kendaraan (diisi dari dashboard)
  plate: string | null;
  vehicle: string | null;
  online: boolean;
  remote: string | null;
  connectedAt: number | null;
  lastSeen: number | null;
  firstSeen: number | null; // kapan alat pertama kali terdaftar di database
  last: Omit<AvlRecord, 'io'> | null;
  pos: { lat: number; lng: number; angle: number; time: number } | null;
  io: IoMapValues;
  ioTime: Record<string, number>;
  records: number;
}

export type Level = 'info' | 'warn' | 'crit';

export interface FleetEvent {
  time: number;
  imei: string;
  level: Level;
  kind: string;
  text: string;
}

export type LogKind = 'conn' | 'raw' | 'data' | 'ack' | 'cmd' | 'error';
export type LogLevel = 'info' | 'warn' | 'error';

export interface LogEntry {
  id: number;
  time: number;
  kind: LogKind;
  imei: string | null;
  level: LogLevel;
  text: string;
}

export interface CommandLine {
  imei: string;
  dir: 'in' | 'out' | 'err';
  text: string;
  time: number;
}

export interface ServerStatus {
  startedAt: number;
  port: number;
  lanIps: string[];
  // Alamat tunnel publik (ngrok / bore.pub), ini yang diisi di Domain/Port alat.
  tunnel: { host: string; port: number; provider: 'ngrok' | 'bore' } | null;
  devicePort: number;
  db: { devices: number; records: number; events: number };
  connected: number;
  devices: number;
}

// ---------- Pelacakan perjalanan ----------
export interface LatLng {
  lat: number;
  lng: number;
}

export interface TrackPoint extends LatLng {
  t: number;
  speed: number;
  angle: number;
  ign: boolean | null;
  fuel: number | null; // level BBM (satuan di DaySummary.fuelUnit), null kalau nggak ada sensor
}

export interface FuelEvent {
  type: 'refuel' | 'drop'; // drop = BBM turun pas truk diam (dugaan pencurian/bocor)
  time: number;
  amount: number; // selalu positif, satuan fuelUnit
  before: number;
  after: number;
  lat: number;
  lng: number;
}

export interface TripSegment {
  type: 'trip' | 'stop';
  start: number;
  end: number;
  distance: number; // meter
  maxSpeed: number; // km/jam
  avgSpeed: number;
  from: LatLng;
  to: LatLng;
  idle: boolean; // berhenti dengan mesin nyala
  place: string | null; // nama jalan/daerah (titik berhenti, atau tujuan perjalanan)
  fuelUsed: number | null; // BBM terpakai selama perjalanan (satuan fuelUnit)
  fromIndex: number; // index di DaySummary.points
  toIndex: number;
}

export interface DaySummary {
  from: number;
  to: number;
  distance: number; // meter
  movingMs: number;
  stoppedMs: number;
  idleMs: number;
  maxSpeed: number;
  avgSpeed: number;
  trips: number;
  stops: number;
  engineMs: number; // lama mesin nyala (ignition ON)
  fuelUnit: 'L' | '%' | null;
  fuelUsed: number | null; // total BBM terpakai hari itu (nggak termasuk isi ulang)
  fuelEvents: FuelEvent[];
  segments: TripSegment[];
  points: TrackPoint[];
}

// Peran titik di sebuah rute. Titik sendiri nggak punya jenis: jadi loading/unloading ditentuin rute.
export type SiteType = 'loading' | 'unloading';

// Master titik (geofence): tempat + radius. Satu titik bisa jadi loading di rute A dan unloading di rute B.
export interface Site {
  id: string;
  name: string;
  lat: number;
  lng: number;
  radius: number; // meter
  note: string | null;
  imeis: string[]; // truk yang lagi bertugas (shift aktif) di rute yang lewat titik ini
  createdAt: number;
  updatedAt: number;
}

// Jalur jalan antar dua titik (dari OSRM). paths[0] = jalur utama, sisanya alternatif.
export interface RoadPath {
  distance: number; // meter
  durationS: number; // estimasi mobil, detik
  truckDurationS: number; // estimasi truk (mobil × truckFactor)
  coords: [number, number][]; // [lat, lng]
}

export interface RoadRoute {
  paths: RoadPath[];
  truckFactor: number;
  source: string;
  fetchedAt: number;
}

// Jalur & estimasi dari ritase asli truk di rute itu (beberapa hari terakhir).
export interface RouteHistory {
  days: number;
  trips: number; // jumlah ritase selesai
  avgDurationMs: number;
  minDurationMs: number;
  maxDurationMs: number;
  avgDistance: number; // meter
  avgStops: number;
  avgFuel: number | null;
  fuelUnit: 'L' | '%' | null;
  latest: { imei: string; start: number; end: number; distance: number; durationMs: number; coords: [number, number][] } | null;
  // Jalan yang biasa dilalui driver: pergi (loading → unloading) & pulang (unloading → loading).
  paths?: { go: UsualPath | null; back: UsualPath | null } | null;
}

// Jejak GPS ritase yang paling mirip sama ritase lain di arah itu.
export interface UsualPath {
  trips: number; // ritase selesai di arah ini
  compared: number; // ritase terbaru yang dibandingin (maks 25)
  follow: number; // dari itu, berapa yang lewat jalan ini
  distance: number; // meter
  durationMs: number;
  avgDurationMs: number;
  lastEnd: number;
  coords: [number, number][];
}

// Siapa yang lagi jalan di satu rute (penugasan shift aktif yang masih berlaku).
export interface OnDuty {
  shiftId: string;
  shiftName: string;
  driverId: string;
  driverName: string;
  imei: string;
}

// Rute = 1 titik loading + 1 titik unloading. Driver & truk masuk ke rute lewat penugasan shift.
export interface Route {
  id: string;
  name: string;
  loadingId: string;
  unloadingId: string;
  note: string | null;
  onDuty: OnDuty[];
  imeis: string[]; // truk dari onDuty
  createdAt: number;
  updatedAt: number;
}

// Satu kali truk ada di dalam radius titik.
export interface SiteVisit {
  siteId: string;
  name: string;
  arrive: number;
  depart: number | null; // null = masih di dalam titik (data terakhir)
  dwellMs: number;
}

// Arah perjalanan di rute: go = berangkat (loading → unloading, bawa muatan), back = pulang (unloading → loading).
export type TripLeg = 'go' | 'back';

// Satu perjalanan di rute, berangkat atau pulang.
// `loading` = kunjungan di titik ASAL, `unloading` = kunjungan di titik TUJUAN (pulang: asal = titik unloading rute).
export interface RouteTrip {
  routeId: string;
  routeName: string;
  leg: TripLeg;
  loading: SiteVisit;
  unloading: SiteVisit | null; // null = belum sampai (masih jalan / data berhenti)
  status: 'done' | 'ongoing' | 'unfinished';
  start: number; // keluar dari titik asal
  end: number; // tiba di titik tujuan (atau data terakhir)
  durationMs: number;
  distance: number; // meter
  movingMs: number;
  stops: number; // berapa kali berhenti di jalan (≥ 2 menit)
  stoppedMs: number;
  maxSpeed: number;
  avgSpeed: number;
  fuelUsed: number | null; // satuan RouteReport.fuelUnit
  fuelAtLoading: number | null; // level BBM waktu keluar dari titik asal
  fuelAtUnloading: number | null; // level BBM waktu sampai di titik tujuan
}

export interface RouteReport {
  from: number;
  to: number;
  fuelUnit: 'L' | '%' | null;
  routes: Route[]; // rute truk ini
  sites: Site[];
  visits: SiteVisit[];
  trips: RouteTrip[]; // ritase
  totals: { trips: number; done: number; avgDurationMs: number; backDone: number; backAvgMs: number; distance: number; stops: number; stoppedMs: number; fuelUsed: number | null };
}

// ---------- Shift & penugasan ----------
export interface Driver {
  id: string;
  name: string;
  phone: string | null;
  employeeNo: string | null;
  ibutton: string | null; // ID iButton (hex) kalau supir pakai kunci iButton FMC150
  active: boolean;
  note: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface ShiftTemplate {
  id: string;
  name: string;
  startTime: string; // HH:MM
  endTime: string; // HH:MM (lebih kecil dari startTime = lewat tengah malam)
  autoClose: boolean;
  sort: number;
}

export type ShiftStatus = 'planned' | 'active' | 'closed';

export interface Assignment {
  id: string;
  shiftId: string;
  driverId: string;
  imei: string;
  routeId: string;
  note: string | null;
  startAt: number | null; // null = dari awal shift
  endAt: number | null; // null = masih berlaku sampai shift selesai
  createdAt: number;
}

export interface Shift {
  id: string;
  name: string;
  routeId: string | null; // 1 shift = 1 rute
  date: string; // YYYY-MM-DD, tanggal kerja
  plannedStart: number;
  plannedEnd: number;
  autoClose: boolean;
  status: ShiftStatus;
  startedAt: number | null;
  closedAt: number | null;
  closeReason: 'manual' | 'auto' | null;
  note: string | null;
  overdue: boolean; // aktif tapi udah lewat jam selesai
  assignments: Assignment[];
  createdAt: number;
  updatedAt: number;
}

// Ritase tersimpan (tabel trips), dasar laporan.
export interface TripRecord {
  id: string;
  assignmentId: string | null;
  shiftId: string | null;
  shiftName: string | null;
  shiftDate: string | null;
  driverId: string | null;
  driverName: string | null;
  imei: string;
  truck: string | null; // plat / nama truk waktu itu
  routeId: string | null;
  routeName: string;
  leg: TripLeg;
  loadingName: string; // titik asal perjalanan ini
  unloadingName: string; // titik tujuan perjalanan ini
  departAt: number;
  arriveAt: number | null;
  durationMs: number;
  distance: number;
  movingMs: number;
  stops: number;
  stoppedMs: number;
  maxSpeed: number;
  avgSpeed: number;
  fuelUnit: 'L' | '%' | null;
  fuelAtLoading: number | null;
  fuelAtUnloading: number | null;
  fuelUsed: number | null;
  loadDwellMs: number;
  unloadDwellMs: number | null;
  status: 'done' | 'unfinished';
}

export type ReportGroup = 'route' | 'driver' | 'truck' | 'shift' | 'day';

// trips/done/avg/min/max = jalan berangkat (loading → unloading). Jarak, berhenti, BBM total = dua arah.
export interface ReportRow {
  key: string;
  label: string;
  sub: string | null;
  trips: number;
  done: number;
  avgDurationMs: number;
  minDurationMs: number;
  maxDurationMs: number;
  backDone: number; // jalan pulang (unloading → loading) yang selesai
  backAvgMs: number;
  backMinMs: number;
  backMaxMs: number;
  distance: number;
  stops: number;
  stoppedMs: number;
  fuelUnit: 'L' | '%' | null;
  fuelUsed: number | null;
  avgFuel: number | null;
  avgFuelAtLoading: number | null;
  avgFuelAtUnloading: number | null;
}

export interface Report {
  from: number;
  to: number;
  group: ReportGroup;
  rows: ReportRow[];
  total: ReportRow;
}

// Pesan yang dikirim lewat /api/stream (Server-Sent Events).
export type StreamMsg =
  | { type: 'hello'; time: number }
  | { type: 'sites' } // titik atau rute berubah
  | { type: 'shifts' } // shift, penugasan, atau driver berubah
  | { type: 'trips' } // ritase tersimpan diperbarui
  | { type: 'notice'; level: 'info' | 'warn' | 'crit'; title: string; body: string; to?: string } // notifikasi umum (mis. shift lewat jam)
  | { type: 'device'; device: Device }
  | { type: 'removed'; imei: string }
  | { type: 'point'; imei: string; point: HistoryPoint }
  | { type: 'event'; event: FleetEvent }
  | ({ type: 'command' } & CommandLine)
  | { type: 'log'; entry: LogEntry };
