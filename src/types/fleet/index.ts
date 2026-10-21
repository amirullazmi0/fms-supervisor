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
    kind?: 'bool' | 'hex' | 'id'; // id = kode/nomor, ditampilkan apa adanya tanpa pemisah ribuan
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
    // Info unit (diisi dari dashboard)
    plate: string | null;
    vehicle: string | null;
    payloadTon: number; // truck factor: ton per rit
    unitType: UnitType;
    brand?: string | null;
    model?: string | null;
    trackerModel?: string | null; // FMC150 / FMC650 / ...
    bucketM3?: number | null; // kapasitas bucket excavator
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
    tunnel: { host: string; port: number; provider: 'ngrok' | 'bore' | 'manual' } | null;
    tunnelEnabled?: boolean; // TUNNEL=true di backend. false = sudah di-deploy, alat terhubung langsung ke server
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
    fuel: number | null; // level BBM (satuan di DaySummary.fuelUnit), null bila tidak ada sensor
}

export interface FuelEvent {
    type: 'refuel' | 'drop'; // drop = BBM turun saat unit diam (dugaan pencurian/bocor)
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
    idle: boolean; // berhenti dengan mesin menyala
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
    engineMs: number; // lama mesin menyala (ignition ON)
    fuelUnit: 'L' | '%' | null;
    fuelUsed: number | null; // total BBM terpakai hari itu (tidak termasuk isi ulang)
    fuelEvents: FuelEvent[];
    segments: TripSegment[];
    points: TrackPoint[];
}

// Peran titik di sebuah rute. Titik sendiri tidak punya jenis: front loading / dumping ditentukan rute.
export type SiteType = 'loading' | 'unloading';

// Master titik (geofence): lokasi + radius. Satu titik bisa menjadi front loading di rute A dan dumping di rute B.
export interface Site {
    id: string;
    name: string;
    lat: number;
    lng: number;
    radius: number; // meter
    note: string | null;
    imeis: string[]; // unit yang sedang bertugas (shift aktif) di rute yang melewati titik ini
    queueAlertTrucks?: number; // alert antrean: >= sekian unit antre...
    queueAlertMin?: number; // ...lebih dari sekian menit
    zones?: SiteZone[];
    createdAt: number;
    updatedAt: number;
}

// Zona di sekitar titik: antre (jalur tunggu) atau spot (posisi muat / dumping).
export type ZoneKind = 'queue' | 'spot';

export interface SiteZone {
    id?: string;
    kind: ZoneKind;
    lat: number;
    lng: number;
    radius: number; // meter
}

// Jalur jalan antar dua titik (dari OSRM). paths[0] = jalur utama, sisanya alternatif.
export interface RoadPath {
    distance: number; // meter
    durationS: number; // estimasi kendaraan ringan, detik
    truckDurationS: number; // estimasi unit (kendaraan ringan × truckFactor)
    coords: [number, number][]; // [lat, lng]
}

export interface RoadRoute {
    paths: RoadPath[];
    truckFactor: number;
    source: string;
    fetchedAt: number;
}

// Jalur & estimasi dari ritase aktual unit di rute itu (beberapa hari terakhir).
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
    latest: {
        imei: string;
        start: number;
        end: number;
        distance: number;
        durationMs: number;
        coords: [number, number][];
    } | null;
    // Jalan yang biasa dilalui operator: hauling (front loading → dumping) & return (dumping → front loading).
    paths?: { go: UsualPath | null; back: UsualPath | null } | null;
}

// Jejak GPS ritase yang paling mirip sama ritase lain di arah itu.
export interface UsualPath {
    trips: number; // ritase selesai di arah ini
    compared: number; // ritase terbaru yang dibandingkan (maks 25)
    follow: number; // dari itu, berapa yang lewat jalan ini
    distance: number; // meter
    durationMs: number;
    avgDurationMs: number;
    lastEnd: number;
    coords: [number, number][];
}

// Siapa yang sedang bertugas di satu rute (penugasan shift aktif yang masih berlaku).
export interface OnDuty {
    shiftId: string;
    shiftName: string;
    driverId: string;
    driverName: string;
    imei: string;
    // active = shift berjalan; finishing = shift sudah dihentikan, ritase terakhir masih hauling atau dumping;
    // done = shift sudah selesai (di recentDone, 12 jam terakhir).
    phase?: 'active' | 'finishing' | 'done';
    closedAt?: number | null;
}

// Rute = 1 titik front loading + 1 titik dumping. Operator & unit masuk ke rute lewat penugasan shift.
export interface Route {
    id: string;
    name: string;
    loadingId: string;
    unloadingId: string;
    note: string | null;
    onDuty: OnDuty[];
    recentDone?: OnDuty[]; // unit yang shift-nya sudah selesai di rute ini (12 jam terakhir)
    imeis: string[]; // unit dari onDuty
    createdAt: number;
    updatedAt: number;
}

// Satu kali unit berada di dalam radius titik.
export interface SiteVisit {
    siteId: string;
    name: string;
    arrive: number;
    depart: number | null; // null = masih di dalam titik (data terakhir)
    dwellMs: number;
}

// Arah perjalanan di rute: go = hauling (front loading → dumping, bermuatan), back = return (dumping → front loading).
export type TripLeg = 'go' | 'back';

// Satu perjalanan di rute, hauling atau return.
// `loading` = kunjungan di titik ASAL, `unloading` = kunjungan di titik TUJUAN (return: asal = titik dumping rute).
export interface RouteTrip {
    routeId: string;
    routeName: string;
    leg: TripLeg;
    loading: SiteVisit;
    unloading: SiteVisit | null; // null = belum tiba (masih berjalan / data terhenti)
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
    routes: Route[]; // rute unit ini
    sites: Site[];
    visits: SiteVisit[];
    trips: RouteTrip[]; // ritase
    totals: {
        trips: number;
        done: number;
        avgDurationMs: number;
        backDone: number;
        backAvgMs: number;
        distance: number;
        stops: number;
        stoppedMs: number;
        fuelUsed: number | null;
    };
}

// ---------- Shift & penugasan ----------
export interface Driver {
    id: string;
    name: string;
    phone: string | null;
    employeeNo: string | null;
    ibutton: string | null; // ID iButton (hex) bila operator memakai kunci iButton FMC150
    active: boolean;
    note: string | null;
    hasPin?: boolean; // bisa login di tablet MDT
    createdAt: number;
    updatedAt: number;
}

// Istirahat terjadwal (P2-3): HH:MM, selesai < mulai = lewat tengah malam; code = delay code standby terencana.
export interface ShiftBreak {
    start: string;
    end: string;
    code: string;
}

export interface ShiftTemplate {
    id: string;
    name: string;
    startTime: string; // HH:MM
    endTime: string; // HH:MM (lebih kecil dari startTime = lewat tengah malam)
    autoClose: boolean;
    sort: number;
    breaks: ShiftBreak[];
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
    overdue: boolean; // aktif tetapi sudah melewati jam selesai
    assignments: Assignment[];
    breaks: ShiftBreak[];
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
    truck: string | null; // plat / nama unit saat itu
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

export type ReportGroup = 'route' | 'driver' | 'truck' | 'shift' | 'day' | 'hour';

// trips/done/avg/min/max = hauling (front loading → dumping). Jarak, berhenti, BBM total = dua arah.
export interface ReportRow {
    key: string;
    label: string;
    sub: string | null;
    trips: number;
    done: number;
    avgDurationMs: number;
    minDurationMs: number;
    maxDurationMs: number;
    backDone: number; // return (dumping → front loading) yang selesai
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
    ton: number; // tonase = ritase selesai × truck factor
    cycleMs: number; // waktu siklus (dasar jam kerja)
    tonPerHour: number; // produktivitas
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
    | { type: 'shifts' } // shift, penugasan, atau operator berubah
    | { type: 'trips' } // ritase tersimpan diperbarui
    | { type: 'notice'; level: 'info' | 'warn' | 'crit'; title: string; body: string; to?: string } // notifikasi umum (mis. shift lewat jam)
    | { type: 'device'; device: Device }
    | { type: 'removed'; imei: string }
    | { type: 'point'; imei: string; point: HistoryPoint }
    | { type: 'event'; event: FleetEvent }
    | ({ type: 'command' } & CommandLine)
    | { type: 'log'; entry: LogEntry }
    | { type: 'unit_status'; imei: string } // status unit berubah (MDT / supervisor)
    | { type: 'dispatch' }; // excavator fleet berubah

// ---------- Produksi, status unit, MDT ----------

export type UnitType = 'DT' | 'EX' | 'LV' | 'SUPPORT';
export type UnitStatus = 'working' | 'standby' | 'breakdown';
export type DelayCategory = 'working' | 'standby_planned' | 'standby_unplanned' | 'breakdown';

export interface DelayCode {
    code: string;
    name: string;
    category: DelayCategory;
    status: UnitStatus;
    icon: string | null;
    sort: number;
    active: boolean;
}

export interface UnitStatusLog {
    id: string;
    imei: string;
    truck: string;
    driverId: string | null;
    driverName: string | null;
    status: UnitStatus;
    delayCode: string | null;
    delayName: string | null;
    category: DelayCategory | null;
    startAt: number;
    endAt: number | null;
    source: 'auto' | 'supervisor' | 'dmr' | 'mdt';
    note: string | null;
    receivedAt: number;
}

// Jam: berjalan (belum lewat), sementara (ada unit yang datanya belum masuk sampai akhir jam), final.
export type HourStatus = 'berjalan' | 'sementara' | 'final';

export interface PendingUnit {
    imei: string;
    truck: string;
    lastGpsAt: number | null;
}

export interface HourlyRow {
    key: string;
    label: string;
    date: string;
    start: number;
    end: number;
    rit: number;
    ton: number;
    targetRit: number;
    targetTon: number;
    achievement: number | null;
    status: HourStatus;
    units: number;
    pending: PendingUnit[];
}

export interface HourlyReport {
    from: number;
    to: number;
    rows: HourlyRow[];
    total: HourlyRow;
}

export interface Freshness {
    imei: string;
    truck: string;
    lastGpsAt: number | null;
    lastReceivedAt: number | null;
    avgDelayMs: number;
    maxDelayMs: number;
    lateRecords: number;
    records: number;
}

export interface StageStats {
    visits: number;
    avgQueueMs: number;
    avgSpotMs: number | null;
    avgWorkMs: number;
    avgDwellMs: number;
}

export interface StageRow {
    routeId: string;
    routeName: string;
    loading: StageStats;
    haulingMs: number;
    haulingCount: number;
    unloading: StageStats;
    returningMs: number;
    returningCount: number;
    cycleMs: number;
    ritPerHour: number;
}

export interface StageReport {
    from: number;
    to: number;
    rows: StageRow[];
}

export interface ProductionTarget {
    id: string;
    routeId: string;
    routeName: string;
    ritPerHour: number | null;
    tonPerHour: number | null;
    ritPerShift: number | null;
    tonPerShift: number | null;
    validFrom: string;
    note: string | null;
    updatedAt: number;
}

export interface MdtTablet {
    id: string;
    imei: string;
    name: string | null;
    pairedAt: number | null;
    lastSyncAt: number | null;
    revokedAt: number | null;
    createdAt: number;
}

// ---------- PA & UA (P2-2): GET /reports/availability ----------
export type AvailabilityBucket = 'total' | 'day' | 'month';

// PA = (T − BD) / T, UA = Working / (T − BD), MA = Working / (Working + BD), EU = Working / T (persen).
export interface AvailabilityRow {
    key: string; // imei | jenis unit | "all"
    label: string;
    unitType?: UnitType;
    period?: string; // YYYY-MM-DD | YYYY-MM, kosong = seluruh periode
    units: number;
    totalMs: number;
    workingMs: number;
    standbyPlannedMs: number;
    standbyUnplannedMs: number;
    breakdownMs: number;
    noStatusMs: number; // waktu tanpa status (dihitung tersedia, bukan working)
    pa: number | null;
    ua: number | null;
    ma: number | null;
    eu: number | null;
}

export interface AvailabilityReport {
    from: number;
    to: number;
    bucket: AvailabilityBucket;
    units: AvailabilityRow[];
    types: AvailabilityRow[];
    total: AvailabilityRow[];
}

// Riwayat pemasangan tracker ke unit (GET /devices/:imei/installs). removedAt null = masih terpasang.
export interface DeviceInstall {
    id: string;
    imei: string;
    plate: string;
    name: string | null;
    installedAt: number;
    removedAt: number | null;
}

// ---------- Panel dispatcher (P2-5 … P2-7): GET /dispatch/fleets ----------
export interface FleetLoader {
    id: string;
    routeId: string;
    imei: string;
    label: string;
    productivityTph: number | null; // ton per jam
    startAt: number;
    endAt: number | null;
}

export interface FleetTruck {
    imei: string;
    label: string;
    driverName: string;
    category: DelayCategory | '';
    status: string | null; // nama delay code
    atFront: boolean; // di radius front loading, diam
    gpsAgeMs: number | null;
    inactive?: string; // alasan tidak produksi (kosong = aktif)
}

export type MatchClass = 'under' | 'match' | 'over' | '';

// MF = (DT aktif × waktu muat) ÷ (excavator × cycle time DT).
export interface Fleet {
    routeId: string;
    routeName: string;
    loadingName: string;
    unloadingName: string;
    loader: FleetLoader | null;
    trucks: FleetTruck[];
    active: number;
    loadTimeMs: number;
    cycleMs: number;
    basisWindow: string; // "3 jam" | "7 hari" | "perkiraan"
    matchFactor: number | null;
    match: MatchClass;
    idealTrucks: number | null;
    queue: number;
    hangingMs: number | null;
    hangingWindow: number;
}

export interface FleetMove {
    imei: string;
    label: string;
    fromRouteId: string;
    fromRouteName: string;
    toRouteId: string;
    toRouteName: string;
    fromMfAfter: number | null;
    toMfAfter: number | null;
    text: string;
}

export interface DispatchBoard {
    at: number;
    fleets: Fleet[];
    moves: FleetMove[];
}

// ---------- Heat map jalan (P3-2): GET /reports/heatmap ----------
export interface HeatCell {
    lat: number;
    lng: number;
    points: number;
    avgSpeed: number; // km/jam
    maxSpeed: number;
}

export interface ShockPoint {
    lat: number;
    lng: number;
    time: number;
    imei: string;
    kind: 'accel' | 'brake' | 'corner' | 'crash';
    g: number | null;
}

export interface HeatmapReport {
    from: number;
    to: number;
    cellDeg: number;
    cells: HeatCell[];
    shocks: ShockPoint[];
    truncated: boolean;
}
