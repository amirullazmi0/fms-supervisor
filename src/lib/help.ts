// Isi tombol info (i): penjelasan singkat setiap halaman, kartu, dan metrik, beserta istilahnya.
// Kunci "page:<path>" dipasang otomatis di judul halaman (Layout); kunci lain dipasang manual lewat
// <InfoTip id="..." /> atau prop `info` di ChartCard / Stat. Tampil hanya bila fitur "Info & panduan"
// (info_tips) menyala. File ini sama di fms-supervisor dan fms-administrator.

export interface HelpEntry {
    title: string;
    summary: string; // satu kalimat, tampil saat kursor diarahkan
    body?: string[]; // paragraf penjelasan, tampil saat diklik
    terms?: [string, string][]; // istilah → arti
}

export const HELP: Record<string, HelpEntry> = {
    // ---------- Halaman supervisor ----------
    'page:/': {
        title: 'Beranda dispatcher',
        summary:
            'Ringkasan satu layar: produksi hari ini vs target, shift berjalan, dan papan unit.',
        body: [
            'Papan unit mengelompokkan unit menurut aktivitas saat ini (antre, muat, hauling, dumping, return, standby, breakdown) dari GPS dan status MDT.',
            'Kolom "Perlu perhatian" berisi antrean panjang, unit breakdown, dan unit yang terlambat mengirim data.',
        ],
    },
    'page:/track': {
        title: 'Lacak unit',
        summary: 'Posisi, perjalanan, ritase, dan sensor satu unit, termasuk putar ulang rute.',
        body: [
            'Pilih unit di daftar kiri. Garis biru adalah jejak GPS hari yang dipilih; titik berhenti dan ritase bisa diklik untuk melihat detail.',
            'Unit di area tanpa sinyal (blank spot) menyimpan data di memori alat dan mengirimkannya begitu sinyal kembali, sehingga jejak bisa bertambah belakangan.',
        ],
        terms: [
            ['Ritase', 'Satu perjalanan bermuatan dari front loading sampai tiba di dumping.'],
            ['Blank spot', 'Area tanpa sinyal; data dikirim terlambat (store & forward).'],
        ],
    },
    'page:/dispatch': {
        title: 'Panel dispatcher',
        summary:
            'Keseimbangan DT dan excavator per fleet: match factor, antrean, hanging time, dan saran pindah DT.',
        body: [
            'Setiap kartu adalah satu fleet (rute + excavator). Bila MF di bawah 0,9 excavator menunggu DT; di atas 1,1 DT antre di front.',
            'Saran redistribusi memindahkan satu DT dari fleet overmatch ke fleet undermatch bila keduanya menjadi lebih seimbang. Tombol "Pindahkan" menyelesaikan penugasan lama dan menugaskan unit beserta operatornya di shift fleet tujuan.',
        ],
        terms: [
            [
                'Match factor (MF)',
                '(DT aktif × waktu muat) ÷ (excavator × cycle time DT). Ideal = 1.',
            ],
            ['Hanging time', 'Waktu excavator menganggur karena tidak ada DT di front.'],
            ['Fleet', 'Satu rute (front loading → dumping) beserta excavator-nya.'],
        ],
    },
    'page:/live': {
        title: 'Live (GPRS)',
        summary:
            'Koneksi langsung ke tracker FMC150: data mentah, status koneksi, dan perintah GPRS.',
        body: [
            'Halaman teknis untuk memeriksa alat. Untuk pemantauan operasional gunakan Beranda atau Lacak unit.',
        ],
    },
    'page:/production': {
        title: 'Produksi per jam',
        summary:
            'Ritase & tonase per jam (waktu GPS) dibandingkan target, beserta status unit dan cycle time per tahap.',
        body: [
            'Jam berlabel "Sementara" masih bisa bertambah karena data dari blank spot belum seluruhnya masuk; label berubah menjadi "Final" setelah semua unit mengirim data melewati jam tersebut.',
            'Pencapaian dihitung dari target tonase bila diisi, bila tidak dari target ritase (menu Target produksi di administrator).',
        ],
        terms: [
            ['Tonase', 'Ritase × truck factor (ton per rit) unit.'],
            ['Truck factor', 'Muatan rata-rata satu rit, diatur per unit.'],
        ],
    },
    'page:/speed-zones': {
        title: 'Zona kecepatan & overspeed',
        summary:
            'Batas kecepatan di turunan, crossing, dan area tongkang, serta pelanggarannya per operator.',
        body: [
            'Unit yang melebihi batas di dalam radius zona memicu notifikasi langsung (paling sering sekali per 5 menit per unit per zona) dan tercatat sebagai kejadian overspeed.',
            'Satu kejadian = rangkaian record GPS di atas batas tanpa jeda lebih dari 1 menit.',
        ],
    },
    'page:/heatmap': {
        title: 'Heat map jalan',
        summary:
            'Kecepatan unit di sepanjang jalan angkut: merah = titik panas (lambat dan sering dilalui).',
        body: [
            'Hanya titik GPS selama ritase dan di luar radius front loading & dumping yang dihitung, sehingga antrean di front tidak terbaca sebagai jalan lambat.',
            'Mode "Kepadatan lalu lintas" menampilkan ruas yang paling sering dilalui. Titik guncangan berasal dari akselerometer (rem mendadak, akselerasi keras, belok tajam, benturan): indikasi jalan rusak atau cara mengemudi.',
        ],
        terms: [
            ['Bermuatan (hauling)', 'Perjalanan dari front loading ke dumping.'],
            ['Kosongan (return)', 'Perjalanan kembali dari dumping ke front loading.'],
        ],
    },
    'page:/operator-report': {
        title: 'Rapor operator & idle',
        summary:
            'Skor 0–100 per operator dan laporan idle per unit beserta perkiraan BBM terbuang.',
        body: [
            'Skor dimulai dari 100 lalu dikurangi: overspeed 3 per kejadian (maks 30), mengemudi kasar 1 per kejadian (maks 15), telat mulai / berhenti lebih awal lebih dari 15 menit 5 per kali (maks 20), dan porsi idle di atas 20% waktu bertugas (maks 15).',
            'BBM idle memakai CAN fuel rate bila tersedia; tanpa CAN dipakai perkiraan 3,5 L/jam.',
        ],
        terms: [
            ['Idle', 'Mesin menyala tetapi unit diam (kecepatan ≤ 2 km/jam).'],
            [
                'Mengemudi kasar',
                'Event akselerometer: rem mendadak, akselerasi keras, belok tajam.',
            ],
        ],
    },
    'page:/breakdowns': {
        title: 'Breakdown & mesin',
        summary:
            'Log breakdown, lama perbaikan (MTTR) per unit dan per jenis, serta alert mesin dari CAN.',
        body: [
            'Breakdown beruntun tanpa kembali ke Working (mis. BD Mesin lalu BD Hidrolik) dihitung satu perbaikan.',
            'Alert mesin muncul saat suhu mesin melewati 100 °C (kritis 105 °C) atau kode error DTC aktif; membutuhkan tracker yang tersambung ke CAN unit.',
        ],
        terms: [
            ['MTTR', 'Mean time to repair: rata-rata lama perbaikan breakdown yang sudah selesai.'],
        ],
    },
    'page:/availability': {
        title: 'PA & UA',
        summary:
            'Ketersediaan fisik dan pemakaian unit dari log status (MDT / supervisor), basis waktu kalender 24 jam.',
        body: [
            'Waktu tanpa status tercatat dihitung tersedia tetapi bukan working, sehingga UA rendah bisa berarti status di MDT tidak diisi.',
            'Angka merah: PA di bawah 85% atau UA di bawah 75% (acuan umum site).',
        ],
        terms: [
            ['PA', 'Physical Availability = (total waktu − breakdown) ÷ total waktu.'],
            ['UA', 'Use of Availability = working ÷ (total waktu − breakdown).'],
            ['MA', 'Mechanical Availability = working ÷ (working + breakdown).'],
            ['EU', 'Effective Utilization = working ÷ total waktu.'],
        ],
    },
    'page:/reports': {
        title: 'Laporan ritase',
        summary: 'Ritase per rute, operator, unit, shift, atau hari untuk periode yang dipilih.',
        body: [
            'Ritase dihitung otomatis dari GPS: unit keluar dari front loading rute lalu masuk ke dumping rute yang sama dalam penugasan shift.',
            'Klik baris untuk melihat daftar ritase-nya; tombol Ekspor Excel mengunduh seluruh ritase pada filter yang sama.',
        ],
    },
    'page:/shifts': {
        title: 'Shift & penugasan',
        summary: 'Buat shift per rute, tugaskan operator & unit, dan atur istirahat terjadwal.',
        body: [
            'Satu shift = satu rute (fleet). Penugasan menentukan unit mana yang dihitung ritase-nya untuk operator mana.',
            'Istirahat terjadwal (mis. Ishoma) otomatis mengubah status unit menjadi standby terencana selama jamnya, lalu kembali ke status sebelumnya. Template shift mengisi jam dan istirahat secara cepat.',
            'Saat shift ditutup, unit yang masih hauling atau dumping tetap menyelesaikan ritase terakhirnya.',
        ],
    },
    'page:/operators': {
        title: 'Operator',
        summary: 'Data operator yang ditugaskan di shift, beserta PIN login tablet MDT.',
        body: [
            'Operator login di MDT kabin dengan NIK + PIN, bukan di dashboard. Operator yang pernah bertugas hanya bisa dinonaktifkan agar laporan lama tetap utuh.',
        ],
    },
    'page:/fleet': {
        title: 'Armada',
        summary: 'Daftar semua unit beserta kondisi, sensor, data mentah, dan info unit.',
        body: [
            'Ubah info unit (plat, jenis, truck factor, merek, model tracker) dari tombol info unit. Riwayat pemasangan tracker tercatat setiap plat diganti.',
        ],
    },
    'page:/sites': {
        title: 'Front, dumping & rute',
        summary: 'Master titik (geofence), zona antre & spot, dan rute front loading → dumping.',
        body: [
            'Titik tidak memiliki jenis tetap; perannya (front loading atau dumping) ditentukan di rute.',
            'Zona antre dan spot memisahkan waktu antre dari waktu muat/bongkar pada laporan cycle time.',
        ],
        terms: [
            ['Front loading', 'Lokasi pemuatan oleh excavator.'],
            ['Dumping', 'Lokasi pembuangan / disposal / tongkang.'],
            ['Spotting', 'Waktu memposisikan unit di titik muat/bongkar.'],
        ],
    },

    // ---------- Halaman administrator ----------
    'page:/monitoring': {
        title: 'Peta monitoring',
        summary:
            'Posisi & status operasional seluruh unit secara langsung, dan heat map jalan angkut.',
        body: [
            'Warna unit mengikuti status dari MDT / supervisor: hijau Working, biru Standby terencana, oranye Standby tidak terencana, merah Breakdown, abu-abu tanpa status atau offline.',
            'Klik kotak ringkasan untuk menyaring unit menurut status.',
        ],
    },
    'page:/targets': {
        title: 'Target produksi',
        summary: 'Target ritase & tonase per jam dan per shift untuk setiap rute (fleet).',
        body: [
            'Target per jam dipakai menghitung % pencapaian di Produksi per jam; target per shift tampil di layar MDT.',
            'Target berlaku mulai tanggal "Berlaku mulai"; target baru tidak mengubah pencapaian periode sebelumnya.',
        ],
    },
    'page:/delay-codes': {
        title: 'Delay code',
        summary: 'Daftar tombol status di MDT beserta kategorinya (working, standby, breakdown).',
        body: [
            'Kategori menentukan perhitungan PA & UA: standby terencana (P2H, Ishoma, sholat), standby tidak terencana (antre, tunggu loader, hujan), dan breakdown.',
            'Kode lama tidak dapat dihapus karena dipakai riwayat; nonaktifkan saja agar hilang dari MDT.',
        ],
        terms: [['P2H', 'Pemeriksaan harian unit sebelum dioperasikan.']],
    },
    'page:/users': {
        title: 'User',
        summary: 'Akun staff dashboard (email + password + role) dan operator MDT (NIK + PIN).',
    },
    'page:/roles': {
        title: 'Role & permission',
        summary: 'Mengatur menu dan aksi yang boleh dilakukan setiap role.',
    },
    'page:/roads': {
        title: 'Data jalan',
        summary: 'Cache jalur jalan (OpenStreetMap) yang dipakai peta rute dan simulasi.',
    },
    'page:/features': {
        title: 'Fitur',
        summary:
            'Menyalakan atau mematikan fitur tanpa deploy ulang, termasuk tombol info (i) ini.',
    },

    // ---------- Kartu & metrik ----------
    'card:hourly': {
        title: 'Produksi per jam',
        summary: 'Ritase & tonase setiap jam menurut waktu GPS keluar dari front loading.',
        body: [
            'Batang abu-abu adalah target. Status Sementara / Final menunjukkan apakah data jam itu sudah lengkap.',
        ],
    },
    'card:stages': {
        title: 'Cycle time per tahap',
        summary:
            'Rata-rata waktu setiap tahap satu putaran: antre, spotting, muat, hauling, dumping, return.',
        body: [
            'Tahap terpanjang adalah sasaran perbaikan pertama. Spotting dan waktu muat/dumping baru terpisah bila zona spot sudah dipasang di titik.',
        ],
        terms: [
            [
                'Cycle time (CT)',
                'Waktu satu putaran penuh: front loading → dumping → kembali ke front loading.',
            ],
        ],
    },
    'card:freshness': {
        title: 'Kesegaran data',
        summary: 'Seberapa terlambat data GPS tiba di server (store & forward dari blank spot).',
    },
    'card:unit-status': {
        title: 'Status unit sekarang',
        summary: 'Status terakhir setiap unit dari MDT operator atau input supervisor.',
    },
    'metric:mf': {
        title: 'Match factor',
        summary: 'Keseimbangan jumlah DT terhadap kapasitas excavator. Ideal mendekati 1.',
        body: [
            '< 0,9 undermatch: excavator menunggu DT. 0,9–1,1 match. > 1,1 overmatch: DT antre di front.',
        ],
    },
    'metric:pa': {
        title: 'PA (Physical Availability)',
        summary:
            '(Total waktu − breakdown) ÷ total waktu: porsi waktu unit siap pakai secara fisik.',
    },
    'metric:ua': {
        title: 'UA (Use of Availability)',
        summary:
            'Working ÷ (total waktu − breakdown): seberapa banyak waktu siap pakai benar-benar dipakai bekerja.',
    },
    'metric:ma': {
        title: 'MA (Mechanical Availability)',
        summary: 'Working ÷ (working + breakdown): keandalan mekanis selama unit dioperasikan.',
    },
    'metric:eu': {
        title: 'EU (Effective Utilization)',
        summary: 'Working ÷ total waktu: pemakaian efektif terhadap seluruh waktu kalender.',
    },
    'metric:mttr': {
        title: 'MTTR',
        summary:
            'Rata-rata lama perbaikan breakdown yang sudah selesai. Breakdown yang masih berjalan tidak dihitung.',
    },
    'metric:score': {
        title: 'Skor operator',
        summary:
            '100 dikurangi overspeed, mengemudi kasar, ketidakdisiplinan shift, dan idle berlebih.',
    },
};
