import type {
  ComponentDetail,
  ComponentId,
  NodeDetail,
  NodeKey,
  SimulationState,
  TelemetrySnapshot,
} from '../types/simulation';

export const APP_TITLE = 'SIMULASI 3D PUBLIC ADDRESS SYSTEM KELOMPOK 3';

export const TEAM_MEMBERS = [
  '1. ANDIT AZIZ SAPUTRA',
  '2. MUH. ANUGRAH NASIR',
  '3. ORHYZAE ALIFAH TAMSUR',
] as const;

export const INITIAL_SIMULATION_STATE: SimulationState = {
  ptt: false,
  bgm: true,
  alarm: false,
  explode: false,
  audioEnabled: false,
  gain: 0.6,
  eq: 0,
  fader: 0.75,
  atten: 0.7,
  cableMeters: 120,
  tapWatts: 6,
  spkCount: 3,
  fault: null,
  activeNode: 'mic',
  activeComponentId: null,
};

export const NODE_DETAILS: Record<NodeKey, NodeDetail> = {
  mic: {
    key: 'mic',
    stepLabel: '01',
    shortName: 'Paging Mic',
    badge: 'Tahap 1 · Transduser Input · 7 Lapisan Kapsul',
    title: 'Paging Microphone (Kapsul Dinamis)',
    func: 'Mengubah energi mekanik gelombang suara vokal menjadi sinyal listrik analog bertegangan sangat lemah (orde milivolt) berdasarkan prinsip induksi elektromagnetik.',
    flow: 'Suara masuk lewat (1) Grille Logam & (2) Foam Akustik → menggetarkan (3) Diafragma → menggerakkan (4) Kumparan Suara di medan (5) Magnet Permanen dalam (6) Rumah Kapsul → keluar lewat (7) Kabel Sinyal Lemah.',
    items: [
      'Lapisan 1–2: Grille logam melindungi kapsul; foam akustik meredam pop noise konsonan letup.',
      'Lapisan 3–5: Diafragma, voice coil, dan magnet permanen membangkitkan GGL induksi analog.',
      'Lapisan 6–7: Housing menjaga presisi mekanis; kabel sinyal lemah mengirim mV ke Mixer.',
      'Sensor Suara (MAX4466 / INMP441): Membaca amplitudo vokal & memicu Priority Override saat PTT aktif.',
    ],
    cam: [-14, 6.2, 12],
    target: [-14, 1.8, 0],
  },
  mixer: {
    key: 'mixer',
    stepLabel: '02',
    shortName: 'Pre-Amp / Mixer',
    badge: 'Tahap 2–3 · Otak Sistem & Line Level · 5 Blok PCB',
    title: 'Pre-Amplifier / Mixer (19-Inch Rackmount)',
    func: 'Menguatkan sinyal lemah (mV), mengatur karakter nada, mengelola prioritas suara darurat/paging, mencampur kanal, dan menstabilkan sinyal ke standar Line Level (~0,775V–1,23V).',
    flow: 'Input (Mic, BGM, Alarm) → (1) Gain/Pre-Amp → (2) Tone Control/EQ → (3) Priority Override → (4) Mixing/Volume → (5) Output Buffer → Sinyal Line Level menuju Power Amplifier.',
    items: [
      'Blok 1–2: Op-Amp & coupling capacitor menaikkan gain; filter equalizer mengatur Bass/Mid/Treble.',
      'Blok 3 (Priority Override): Relay memutus atau meredam BGM otomatis saat PTT Mic atau Alarm aktif.',
      'Blok 4–5: Summing fader mencampur kanal; output buffer menstabilkan impedansi Line Level.',
      'Sensor Suhu Rak (NTC/DHT22): Memantau temperatur kabinet mixer 19-inci agar tetap stabil.',
    ],
    cam: [-4.5, 7.2, 11],
    target: [-4.5, 1.1, 0],
  },
  amp: {
    key: 'amp',
    stepLabel: '03',
    shortName: 'Power Amp 100V',
    badge: 'Tahap 4–5 · Otot Sistem & 100V Line · 6 Blok Daya',
    title: 'Power Amplifier 100V Line',
    func: 'Menggandakan daya dan tegangan sinyal Line Level menggunakan energi catu daya, lalu menaikkan tegangan menjadi 100V Line agar minim voltage drop pada kabel ratusan meter.',
    flow: 'Line Level Input → (1) Catu Daya (2 Trafo Toroidal + 6 Elco) & (2) Sirkuit Driver → (3) Transistor/MOSFET Daya (didinginkan 4. Heatsink) → (5) Sirkuit Proteksi → (6) Trafo Output 100V Line.',
    items: [
      'Blok 1–3: Trafo toroidal + bank elco menyuplai DC; driver & MOSFET daya menggandakan daya.',
      'Blok 4 (Heatsink) + Sensor Suhu DS18B20: Memantau suhu sirip pendingin & efek pemanasan termal.',
      'Blok 5 (Proteksi) + Sensor Arus ACS712 / SCT-013: Mendeteksi arus berlebih/korsleting & menyalakan LED Protect.',
      'Blok 6 (Trafo Output 100V): Step-up tegangan ke 100V Line untuk distribusi kabel jarak jauh.',
    ],
    cam: [5.5, 8.2, 12],
    target: [5.5, 1.2, 0],
  },
  spk: {
    key: 'spk',
    stepLabel: '04',
    shortName: 'Ceiling Speaker',
    badge: 'Tahap 6 · Transduser Output · 6 Lapisan Elektroakustik',
    title: 'Ceiling Speaker (100V Line)',
    func: 'Menurunkan sinyal tegangan tinggi 100V Line sesuai wattage tap (3W/6W/15W) dan mengubah sinyal listrik menjadi gelombang akustik suara yang terdengar di ruangan.',
    flow: 'Sinyal 100V Line → (1) Trafo Matching (step-down & tap daya) → (2) Kumparan Suara di (3) Magnet Permanen + (4) Suspensi Spider → menggetarkan (5) Diafragma/Cone → keluar lewat (6) Grille Logam.',
    items: [
      'Lapisan 1: Trafo matching menurunkan tegangan 100V sesuai tap (3W / 6W / 15W) dan impedansi voice coil.',
      'Lapisan 2–5: Interaksi elektromagnetik voice coil & magnet permanen menggetarkan spider dan cone.',
      'Lapisan 6: Grille logam melindungi cone dari debu/sentuhan tanpa menghalangi gelombang suara.',
      'Sensor Akustik (SPL Ruangan): Memantau tekanan suara aktual (dB) hasil radiasi speaker paralel.',
    ],
    cam: [15.5, 6.5, 11],
    target: [15.5, 2.0, 0],
  },
};

export const COMPONENT_DETAILS: Record<ComponentId, ComponentDetail> = {
  // --- 1. PAGING MICROPHONE ---
  'mic-base': {
    id: 'mic-base',
    parentNode: 'mic',
    shortName: 'Konsol & PTT',
    title: 'Konsol Dasar, Tombol PTT & LED Chime',
    category: 'Blok Sirkuit',
    badge: 'Paging Mic · Antarmuka Operator',
    func: 'Menjadi dudukan mekanis mikrofon sekaligus sakelar Push-To-Talk (PTT) untuk mengirim sinyal trigger prioritas ke Pre-Amp/Mixer.',
    detail: 'Saat PTT ditekan, sakelar menutup rangkaian trigger dan menyalakan indikator LED Chime sebelum suara vokal dipancarkan ke ruangan.',
    specs: [
      'Tombol PTT berjenis momentary/latching dengan kontak bebas pantulan (debounce).',
      'LED hijau menandakan kanal paging aktif; LED biru menandakan nada chime pembuka.',
      'Dilengkapi 4 kaki karet peredam getaran meja (handling noise isolation).',
    ],
    cam: [-14, 3.6, 5.2],
    target: [-14, 0.7, 0.4],
  },
  'mic-gooseneck': {
    id: 'mic-gooseneck',
    parentNode: 'mic',
    shortName: 'Gooseneck',
    title: 'Tiang Leher Angsa (Gooseneck) Fleksibel',
    category: 'Transduser',
    badge: 'Paging Mic · Penyangga & Shielding',
    func: 'Menopang kapsul mikrofon pada posisi ergonomis di depan mulut operator sekaligus menjadi jalur kabel internal berpelindung (shielded).',
    detail: 'Tabung logam berulir/fleksibel bertindak sebagai sangkar Faraday untuk mencegah interferensi gelombang elektromagnetik (EMI/RFI) masuk ke sinyal milivolt.',
    specs: [
      'Material logam konduktif yang terhubung ke pin Ground (Pin 1 XLR).',
      'Mengarahkan kapsul dinamis agar sejajar dengan sumbu vokal operator.',
    ],
    cam: [-13.2, 4.2, 5.0],
    target: [-14, 2.1, -0.7],
  },
  'mic-grille': {
    id: 'mic-grille',
    parentNode: 'mic',
    shortName: 'L1. Grille',
    title: 'Lapisan 1 · Grille Logam Pelindung',
    category: 'Transduser',
    badge: 'Paging Mic · Kapsul Lapisan 1',
    func: 'Melindungi bagian dalam kapsul mikrofon yang sensitif dari benturan fisik dan kotoran tanpa menghambat aliran gelombang suara.',
    detail: 'Struktur jaring logam berpori halus tetap meneruskan variasi tekanan udara vokal menuju filter akustik di belakangnya.',
    specs: [
      'Anyaman kawat baja tahan karat (stainless mesh) tahan korosi.',
      'Membantu mengurangi hembusan angin langsung dari depan kapsul.',
    ],
    cam: [-16.0, 4.8, 4.0],
    target: [-14.8, 3.35, -0.45],
  },
  'mic-foam': {
    id: 'mic-foam',
    parentNode: 'mic',
    shortName: 'L2. Foam',
    title: 'Lapisan 2 · Foam Akustik (Pop Filter)',
    category: 'Transduser',
    badge: 'Paging Mic · Kapsul Lapisan 2',
    func: 'Meredam hentakan udara berkecepatan tinggi (pop noise) dari pengucapan konsonan letup seperti huruf P, B, dan T.',
    detail: 'Busa poliuretan berpori terbuka mendispersikan energi angin mendadak namun tetap transparan terhadap frekuensi suara manusia (300 Hz – 3,4 kHz).',
    specs: [
      'Menjaga kejernihan artikulasi pengumuman paging tanpa distorsi letupan.',
      'Menyaring partikel debu mikro dan kelembapan napas operator.',
    ],
    cam: [-15.5, 4.6, 3.8],
    target: [-14.5, 3.35, -0.45],
  },
  'mic-diaphragm': {
    id: 'mic-diaphragm',
    parentNode: 'mic',
    shortName: 'L3. Diafragma',
    title: 'Lapisan 3 · Diafragma (Membran Akustik)',
    category: 'Transduser',
    badge: 'Paging Mic · Kapsul Lapisan 3',
    func: 'Menangkap variasi tekanan udara gelombang suara dan bergetar secara mekanis mengikuti frekuensi serta amplitudo suara operator.',
    detail: 'Membran polimer tipis (Mylar) yang sangat ringan sehingga merespons getaran suara secara presisi dan langsung menggerakkan kumparan suara.',
    specs: [
      'Ketebalan dalam orde mikrometer agar inersia mekanis sangat rendah.',
      'Bergetar maju-mundur secara sinkron dengan gelombang suara input (dB).',
    ],
    cam: [-14.8, 4.6, 3.6],
    target: [-14.2, 3.35, -0.45],
  },
  'mic-coil': {
    id: 'mic-coil',
    parentNode: 'mic',
    shortName: 'L4. Voice Coil',
    title: 'Lapisan 4 · Kumparan Suara (Voice Coil)',
    category: 'Transduser',
    badge: 'Paging Mic · Kapsul Lapisan 4',
    func: 'Mengubah getaran mekanis diafragma menjadi arus dan tegangan listrik AC lemah melalui hukum induksi elektromagnetik Faraday.',
    detail: 'Lilitan kawat tembaga halus yang menempel pada diafragma bergerak memotong garis gaya magnet di celah magnet permanen.',
    specs: [
      'Menghasilkan sinyal analog level mikrofon (~1 mV – 5 mV).',
      'Impedansi kumparan dinamis tipikal 150 Ω – 600 Ω (low impedance balanced).',
    ],
    cam: [-14.2, 4.6, 3.6],
    target: [-13.9, 3.35, -0.45],
  },
  'mic-magnet': {
    id: 'mic-magnet',
    parentNode: 'mic',
    shortName: 'L5. Magnet',
    title: 'Lapisan 5 · Magnet Permanen Kapsul',
    category: 'Transduser',
    badge: 'Paging Mic · Kapsul Lapisan 5',
    func: 'Menyediakan medan magnet statis berkerapatan fluks tinggi di sekitar celah kumparan suara (voice coil).',
    detail: 'Tanpa memerlukan catu daya eksternal (phantom power), medan magnet permanen memungkinkan mikrofon dinamis bekerja mandiri dan andal.',
    specs: [
      'Menggunakan material ferit atau neodymium dengan celah kutub konsentris.',
      'Menentukan sensitivitas konversi mekanik-ke-listrik kapsul.',
    ],
    cam: [-13.6, 4.6, 3.6],
    target: [-13.5, 3.35, -0.45],
  },
  'mic-housing': {
    id: 'mic-housing',
    parentNode: 'mic',
    shortName: 'L6-7. Housing',
    title: 'Lapisan 6–7 · Rumah Kapsul & Kabel Sinyal Lemah',
    category: 'Transduser',
    badge: 'Paging Mic · Kapsul Lapisan 6 & 7',
    func: 'Menjaga kelurusan mekanis antara magnet dan diafragma serta menyalurkan sinyal mV lewat kabel balanced berpelindung ke Mixer.',
    detail: 'Desain rongga belakang kapsul juga membentuk pola tangkapan arah (cardioid) agar suara dari belakang mikrofon diredam dan mencegah feedback.',
    specs: [
      'Konektor keluar menyalurkan sinyal diferensial (Hot+, Cold-, Shield).',
      'Mencegah kebisingan induksi AC 50 Hz di sepanjang kabel menuju rak mixer.',
    ],
    cam: [-12.8, 4.6, 3.8],
    target: [-13.0, 3.35, -0.45],
  },
  'sensor-sound': {
    id: 'sensor-sound',
    parentNode: 'mic',
    shortName: 'Sensor MAX4466',
    title: 'Sensor Suara Input (MAX4466 / INMP441)',
    category: 'Sensor Telemetri',
    badge: 'Sensor Telemetri · Akustik Input',
    func: 'Mengukur level tekanan suara vokal atau lingkungan (dB) secara real-time dan mengirim status aktivasi ke sistem telemetri serta Priority Override.',
    detail: 'Modul sensor dilengkapi kapsul elektret kondensor dan penguat presisi rendah derau untuk memantau intensitas sinyal akustik di titik input.',
    specs: [
      'Membaca level suara dari kondisi sunyi (~35 dB) hingga paging/alarm (>90 dB).',
      'Terintegrasi dengan tombol PTT untuk memicu pengalihan prioritas di Mixer.',
    ],
    cam: [-16.6, 4.5, 3.8],
    target: [-15.35, 3.35, -0.45],
  },

  // --- 2. PRE-AMPLIFIER / MIXER ---
  'mixer-chassis': {
    id: 'mixer-chassis',
    parentNode: 'mixer',
    shortName: 'Sasis 19-Inch',
    title: 'Sasis 19-Inch Rackmount & PCB Utama',
    category: 'Blok Sirkuit',
    badge: 'Pre-Amp / Mixer · Struktur Mekanis',
    func: 'Menjadi rangka pelindung standar industri 19 inci beserta papan sirkuit utama (PCB) yang menghubungkan seluruh blok pemrosesan sinyal Line Level.',
    detail: 'Dilengkapi kuping rak (rack ears) di sisi kiri-kanan untuk pemasangan pada kabinet audio gedung serta ground chassis untuk perisai EMI.',
    specs: [
      'Standar lebar rak 19 inci dengan ventilasi disipasi panas pasif.',
      'Jalur tembaga PCB memisahkan ground sinyal audio dan ground catu daya.',
    ],
    cam: [-4.5, 5.5, 8.2],
    target: [-4.5, 1.0, 0],
  },
  'mixer-gain': {
    id: 'mixer-gain',
    parentNode: 'mixer',
    shortName: 'B1. Gain Pre-Amp',
    title: 'Blok 1 · Gain / Pre-Amplifier (Op-Amp)',
    category: 'Blok Sirkuit',
    badge: 'Pre-Amp / Mixer · Blok PCB 1',
    func: 'Menguatkan sinyal sangat lemah dari mikrofon (orde milivolt) hingga mencapai level kerja internal rangkaian sekitar 0,775V–1,23V (Line Level).',
    detail: 'Menggunakan IC Operational Amplifier (Op-Amp) rendah derau dan kapasitor kopling untuk memblokir tegangan DC sekaligus menjaga rasio Signal-to-Noise.',
    specs: [
      'Penguatan dapat diatur antara 10% hingga 100% lewat kontrol Gain.',
      'Mencegah sinyal terlalu lemah (noise tinggi) atau terlalu tinggi (clipping).',
    ],
    cam: [-6.4, 4.4, 3.6],
    target: [-5.6, 1.6, -1.1],
  },
  'mixer-eq': {
    id: 'mixer-eq',
    parentNode: 'mixer',
    shortName: 'B2. EQ Tone',
    title: 'Blok 2 · Tone Control / Equalizer (Bass, Mid, Treble)',
    category: 'Blok Sirkuit',
    badge: 'Pre-Amp / Mixer · Blok PCB 2',
    func: 'Membentuk karakteristik frekuensi suara agar vokal pengumuman terdengar jelas dan musik latar (BGM) seimbang di akustik ruangan.',
    detail: 'Terdiri dari 3 potensiometer filter aktif (Low, Mid, High) dengan rentang atenuasi/boost -12 dB hingga +12 dB.',
    specs: [
      'Memotong frekuensi rendah berlebih untuk mencegah suara bergemuruh (boomy).',
      'Menonjolkan frekuensi vokal (1–3 kHz) guna meningkatkan kejelasan ucapan.',
    ],
    cam: [-5.8, 4.4, 4.2],
    target: [-5.5, 1.6, 0.1],
  },
  'mixer-priority': {
    id: 'mixer-priority',
    parentNode: 'mixer',
    shortName: 'B3. Priority Relay',
    title: 'Blok 3 · Sirkuit Priority Override (Relay)',
    category: 'Blok Sirkuit',
    badge: 'Pre-Amp / Mixer · Blok PCB 3',
    func: 'Mengatur hierarki sinyal otomatis: memutus atau meredam kanal BGM seketika saat Paging Mic (PTT) atau Sinyal Alarm Darurat aktif.',
    detail: 'Relay elektromagnetik berpindah kondisi secara instan ketika mendapat tegangan trigger dari tombol PTT atau panel sistem alarm kebakaran.',
    specs: [
      'Urutan prioritas: (1) Alarm Evakuasi → (2) Paging Mic PTT → (3) BGM.',
      'Indikator relay menyala kuning saat status Priority Override aktif.',
    ],
    cam: [-3.5, 4.4, 3.8],
    target: [-3.75, 1.72, -0.65],
  },
  'mixer-faders': {
    id: 'mixer-faders',
    parentNode: 'mixer',
    shortName: 'B4. Mixing Fader',
    title: 'Blok 4 · Kanal Mixing & Master Fader',
    category: 'Blok Sirkuit',
    badge: 'Pre-Amp / Mixer · Blok PCB 4',
    func: 'Menggabungkan (summing) beberapa kanal sumber audio (Mic, BGM, Aux, Alarm) dan mengatur level keluaran utama sebelum dikirim ke Power Amplifier.',
    detail: 'Empat kanal fader input bermuara ke Master Fader berwarna amber yang mengendalikan amplitudo gabungan sinyal Line Level.',
    specs: [
      'Arsitektur summing amplifier menjaga tiap kanal tidak saling membebani.',
      'Posisi Master Fader secara langsung memengaruhi amplitudo titik ke-3 osiloskop.',
    ],
    cam: [-4.3, 4.5, 5.2],
    target: [-4.5, 1.6, 1.25],
  },
  'mixer-buffer': {
    id: 'mixer-buffer',
    parentNode: 'mixer',
    shortName: 'B5. Output Buffer',
    title: 'Blok 5 · Output Buffer Line Level',
    category: 'Blok Sirkuit',
    badge: 'Pre-Amp / Mixer · Blok PCB 5',
    func: 'Menstabilkan impedansi keluaran dan mengisolasi rangkaian mixer dari beban kabel interkoneksi menuju Power Amplifier.',
    detail: 'Buffer impedansi rendah memastikan tidak terjadi penurunan level atau kehilangan frekuensi tinggi saat menghubungkan rak mixer ke amplifier.',
    specs: [
      'Standar keluaran Line Level nominal 0 dBu (0,775 Vrms) – +4 dBu (1,23 Vrms).',
      'Impedansi keluaran rendah (< 100 Ω) untuk transmisi bebas noise antar-perangkat.',
    ],
    cam: [-2.4, 4.4, 3.6],
    target: [-2.65, 1.68, -1.2],
  },
  'sensor-mixer-temp': {
    id: 'sensor-mixer-temp',
    parentNode: 'mixer',
    shortName: 'Sensor Suhu Rak',
    title: 'Sensor Suhu Kabinet Rak Mixer (NTC / DHT22)',
    category: 'Sensor Telemetri',
    badge: 'Sensor Telemetri · Kabinet Mixer',
    func: 'Memantau suhu internal kabinet rak 19-inci guna memastikan IC Op-Amp, regulator daya, dan relay prioritas bekerja di rentang termal aman.',
    detail: 'Peningkatan suhu kabinet di atas batas nominal menjadi peringatan dini perlunya sirkulasi udara kipas pada rak audio gedung.',
    specs: [
      'Rentang kerja optimal kabinet mixer: 26 °C – 45 °C.',
      'Terhubung ke modul telemetri untuk pemantauan kondisi lingkungan rak.',
    ],
    cam: [-2.2, 4.2, 4.6],
    target: [-2.45, 1.68, 0.35],
  },

  // --- 3. POWER AMPLIFIER 100V LINE ---
  'amp-chassis': {
    id: 'amp-chassis',
    parentNode: 'amp',
    shortName: 'Sasis 2U Amp',
    title: 'Sasis 2U & Panel Depan Power Amplifier',
    category: 'Komponen Daya',
    badge: 'Power Amp 100V · Struktur & Ventilasi',
    func: 'Rumah pelindung baja 2U yang menopang bobot komponen daya berat (trafo toroidal dan trafo output 100V) serta menyediakan jalur aliran udara.',
    detail: 'Panel depan menampung indikator status sistem dan pegangan rak untuk perawatan unit di ruang kontrol.',
    specs: [
      'Konstruksi pelat baja kokoh untuk menahan getaran mekanis trafo daya besar.',
      'Dilengkapi pegangan rak depan dan jalur grounding keselamatan listrik.',
    ],
    cam: [5.5, 6.2, 9.0],
    target: [5.5, 1.0, 0],
  },
  'amp-psu': {
    id: 'amp-psu',
    parentNode: 'amp',
    shortName: 'B1. Catu Daya',
    title: 'Blok 1 · Catu Daya (2 Trafo Toroidal + 6 Elco Filter)',
    category: 'Komponen Daya',
    badge: 'Power Amp 100V · Blok Daya 1',
    func: 'Mengubah tegangan AC PLN menjadi tegangan DC berarus tinggi yang bersih dan stabil sebagai sumber energi utama penguat daya.',
    detail: 'Dua trafo toroidal tembaga efisiensi tinggi menurunkan tegangan AC, kemudian disearahkan dan diratakan oleh bank 6 kapasitor elektrolit (Elco) biru.',
    specs: [
      'Trafo toroidal memiliki fluks bocor sangat kecil sehingga tidak memicu dengung (hum).',
      'Bank 6 Elco menyimpan cadangan energi sesaat untuk puncak dinamika suara (peak power).',
    ],
    cam: [2.8, 5.2, 5.8],
    target: [2.9, 0.9, 0],
  },
  'amp-driver': {
    id: 'amp-driver',
    parentNode: 'amp',
    shortName: 'B2. Driver Stage',
    title: 'Blok 2 · Sirkuit Driver Penguat Tegangan',
    category: 'Blok Sirkuit',
    badge: 'Power Amp 100V · Blok Daya 2',
    func: 'Menguatkan ayunan tegangan sinyal Line Level dari Mixer dan mengatur arus bias agar transistor/MOSFET daya bekerja linear tanpa distorsi crossover.',
    detail: 'Menjadi jembatan kontrol antara sinyal masukan berdaya kecil dan tingkat penguat akhir berarus tinggi.',
    specs: [
      'Mengatur kestabilan titik bias kelas AB/D pada transistor daya akhir.',
      'Menjaga respons frekuensi tetap rata meski beban kabel panjang.',
    ],
    cam: [4.6, 5.0, 5.2],
    target: [4.95, 0.65, 0],
  },
  'amp-mosfet': {
    id: 'amp-mosfet',
    parentNode: 'amp',
    shortName: 'B3. MOSFET Daya',
    title: 'Blok 3 · Transistor / MOSFET Daya Akhir (6× TO-247)',
    category: 'Komponen Daya',
    badge: 'Power Amp 100V · Blok Daya 3',
    func: 'Menggandakan daya dan arus sinyal audio dalam skala besar untuk menggerakkan kumparan primer trafo output 100V Line.',
    detail: 'Enam buah semikonduktor daya dipasang rapat pada dinding heatsink menggunakan pasta termal untuk membuang panas rugi-rugi daya.',
    specs: [
      'Bekerja berpasangan (push-pull) untuk siklus positif dan negatif gelombang audio.',
      'Menghasilkan disipasi panas sebanding dengan besar beban speaker dan attenuator.',
    ],
    cam: [5.4, 4.8, 5.0],
    target: [5.48, 0.95, 0],
  },
  'amp-heatsink': {
    id: 'amp-heatsink',
    parentNode: 'amp',
    shortName: 'B4. Heatsink',
    title: 'Blok 4 · Heatsink Sirip Aluminium (14 Sirip Pendingin)',
    category: 'Komponen Daya',
    badge: 'Power Amp 100V · Blok Daya 4',
    func: 'Menyerap panas dari MOSFET daya dan melepaskannya ke udara sekitar melalui luas permukaan 14 sirip aluminium.',
    detail: 'Dalam simulasi 3D, warna sirip heatsink berubah memerah secara proporsional saat suhu meningkat akibat beban berat atau gangguan.',
    specs: [
      'Material aluminium ekstrusi konduktivitas termal tinggi.',
      'Suhu operasi normal di bawah 65 °C; di atas 65 °C memicu peringatan Overheat.',
    ],
    cam: [6.5, 5.2, 5.5],
    target: [6.2, 1.1, 0],
  },
  'sensor-temp': {
    id: 'sensor-temp',
    parentNode: 'amp',
    shortName: 'Sensor DS18B20',
    title: 'Sensor Suhu Heatsink (DS18B20 Probe)',
    category: 'Sensor Telemetri',
    badge: 'Sensor Telemetri · Termal Power Amp',
    func: 'Mengukur temperatur aktual sirip heatsink secara digital (1-Wire) dan melaporkan kondisi termal penguat ke panel telemetri.',
    detail: 'Probe stainless menempel langsung pada sirip pendingin untuk mendeteksi kenaikan panas akibat tap daya tinggi, jumlah speaker paralel, atau kondisi overload.',
    specs: [
      'Akurasi pembacaan digital ±0,5 °C pada rentang -10 °C hingga +85 °C.',
      'Menjadi pemicu peringatan Overheat bila suhu melewati ambang batas 65 °C.',
    ],
    cam: [7.6, 4.2, 4.4],
    target: [6.95, 1.22, 0.35],
  },
  'amp-protect': {
    id: 'amp-protect',
    parentNode: 'amp',
    shortName: 'B5. Proteksi Relay',
    title: 'Blok 5 · Sirkuit Proteksi & LED Protect',
    category: 'Blok Sirkuit',
    badge: 'Power Amp 100V · Blok Daya 5',
    func: 'Memutus jalur keluaran ke speaker secara otomatis saat terdeteksi korsleting (Short Circuit) atau beban berlebih (Overload) agar MOSFET tidak rusak.',
    detail: 'Ketika gangguan terjadi, relay proteksi melepas sambungan beban dan menyalakan LED Protect merah pada panel depan.',
    specs: [
      'Waktu respons pemutusan dalam orde milidetik setelah sensor arus mendeteksi lonjakan.',
      'Mencegah kebakaran kabel dan kerusakan permanen pada trafo serta MOSFET.',
    ],
    cam: [7.8, 4.8, 5.4],
    target: [7.75, 0.9, 0.5],
  },
  'sensor-current': {
    id: 'sensor-current',
    parentNode: 'amp',
    shortName: 'Sensor ACS712/CT',
    title: 'Sensor Arus Beban (ACS712 / SCT-013 Current Transformer)',
    category: 'Sensor Telemetri',
    badge: 'Sensor Telemetri · Arus 100V Line',
    func: 'Memantau besar arus listrik yang mengalir menuju trafo dan jalur beban speaker 100V Line secara real-time tanpa memutus rangkaian.',
    detail: 'Membaca kenaikan arus saat wattage tap (3W/6W/15W) atau jumlah speaker paralel bertambah, serta mendeteksi lonjakan ekstrem saat Short Circuit.',
    specs: [
      'Arus normal: ~0,4 A – 4,5 A; Overload: > 7,5 A; Short Circuit: melonjak ke 18,5 A.',
      'Bekerja bersama sirkuit proteksi untuk mengaktifkan LED Protect merah.',
    ],
    cam: [8.4, 4.2, 4.8],
    target: [7.85, 0.86, 1.15],
  },
  'amp-trafo': {
    id: 'amp-trafo',
    parentNode: 'amp',
    shortName: 'B6. Trafo 100V',
    title: 'Blok 6 · Trafo Output Step-Up 100V Line & Terminal',
    category: 'Komponen Daya',
    badge: 'Power Amp 100V · Blok Daya 6',
    func: 'Menaikkan tegangan keluaran amplifier menjadi standar tegangan tinggi konstan 100V Line agar distribusi kabel jarak jauh minim rugi tegangan (voltage drop).',
    detail: 'Dengan menaikkan tegangan menjadi 100V, arus pada kabel distribusi menjadi jauh lebih kecil (P = V × I), sehingga kabel ratusan meter tetap efisien.',
    specs: [
      'Terminal keluaran 100V (Hot) dan COM (Common) terisolasi galvanis dari rangkaian DC.',
      'Memungkinkan banyak speaker dipasang paralel berdasarkan total Watt, bukan impedansi Ohm.',
    ],
    cam: [10.4, 4.8, 5.2],
    target: [9.35, 1.0, 0.55],
  },

  // --- 4. CEILING SPEAKER ---
  'spk-trafo': {
    id: 'spk-trafo',
    parentNode: 'spk',
    shortName: 'L1. Trafo Matching',
    title: 'Lapisan 1 · Trafo Matching 100V Line (Tap 3W / 6W / 15W)',
    category: 'Komponen Daya',
    badge: 'Ceiling Speaker · Lapisan 1',
    func: 'Menurunkan kembali tegangan tinggi 100V Line menjadi tegangan rendah sesuai kebutuhan kumparan speaker dan memilih porsi daya (Wattage Tap).',
    detail: 'Tiga lampu indikator pada trafo menunjukkan tap daya aktif: 3W (Z ≈ 3,3 kΩ), 6W (Z ≈ 1,67 kΩ), atau 15W (Z ≈ 667 Ω) untuk menyesuaikan tingkat kenyaringan zona ruangan.',
    specs: [
      'Mengisolasi dan mencocokkan impedansi tinggi saluran 100V ke kumparan 8 Ω speaker.',
      'Semakin besar Tap Wattage, semakin besar arus yang ditarik dari Power Amplifier.',
    ],
    cam: [13.2, 4.8, 4.8],
    target: [14.35, 2.35, 0],
  },
  'spk-coil': {
    id: 'spk-coil',
    parentNode: 'spk',
    shortName: 'L2. Voice Coil',
    title: 'Lapisan 2 · Kumparan Suara (Voice Coil Speaker)',
    category: 'Transduser',
    badge: 'Ceiling Speaker · Lapisan 2',
    func: 'Menerima arus listrik audio dari trafo matching dan menghasilkan medan magnet bolak-balik sesuai gaya Lorentz untuk menggerakkan cone.',
    detail: 'Lilitan kawat tembaga berenamel bergerak maju-mundur secara presisi di dalam celah medan magnet permanen.',
    specs: [
      'Mengubah energi listrik ter-modulasi menjadi gaya dorong mekanis aksial.',
      'Gerakan berhenti seketika saat Proteksi Amplifier trip akibat gangguan.',
    ],
    cam: [14.2, 4.8, 4.6],
    target: [14.98, 2.35, 0],
  },
  'spk-magnet': {
    id: 'spk-magnet',
    parentNode: 'spk',
    shortName: 'L3. Magnet',
    title: 'Lapisan 3 · Magnet Permanen Speaker',
    category: 'Transduser',
    badge: 'Ceiling Speaker · Lapisan 3',
    func: 'Menghasilkan medan magnet permanen statis yang kuat agar gaya tarik-tolak terhadap kumparan suara (voice coil) berlangsung efisien.',
    detail: 'Berinteraksi langsung dengan fluks elektromagnetik dari voice coil untuk menghasilkan getaran mekanis beramplitudo proporsional.',
    specs: [
      'Struktur cincin ferit berdensitas fluks tinggi untuk efisiensi akustik optimal.',
      'Menjadi jangkar massa utama di bagian belakang rangka speaker.',
    ],
    cam: [14.8, 4.8, 4.6],
    target: [15.45, 2.35, 0],
  },
  'spk-spider': {
    id: 'spk-spider',
    parentNode: 'spk',
    shortName: 'L4. Spider',
    title: 'Lapisan 4 · Suspensi Spider (Damper)',
    category: 'Transduser',
    badge: 'Ceiling Speaker · Lapisan 4',
    func: 'Menjaga posisi kumparan suara tetap terpusat sempurna di dalam celah magnet serta mengembalikan cone ke titik netral setelah bergetar.',
    detail: 'Cincin bergelombang fleksibel ini mencegah kumparan bergesekan dengan dinding magnet saat bergetar pada amplitudo tinggi.',
    specs: [
      'Memberikan kelenturan aksial sekaligus kekakuan radial yang tinggi.',
      'Meredam osilasi sisa agar suara pengumuman tidak berdengung.',
    ],
    cam: [15.4, 4.8, 4.6],
    target: [15.88, 2.35, 0],
  },
  'spk-cone': {
    id: 'spk-cone',
    parentNode: 'spk',
    shortName: 'L5. Cone',
    title: 'Lapisan 5 · Diafragma / Cone Speaker',
    category: 'Transduser',
    badge: 'Ceiling Speaker · Lapisan 5',
    func: 'Mendorong massa udara di ruangan secara mekanis sehingga getaran listrik kembali berubah menjadi gelombang akustik suara yang terdengar.',
    detail: 'Permukaan kerucut yang ringan namun kaku bergetar secara visual di layar 3D seiring intensitas sinyal keluaran speaker.',
    specs: [
      'Luas permukaan cone menentukan efisiensi penyebaran suara di plafon.',
      'Memancarkan gelombang suara berwarna hijau (BGM), biru (PTT), atau merah (Alarm).',
    ],
    cam: [16.2, 4.8, 4.6],
    target: [16.38, 2.35, 0],
  },
  'spk-grille': {
    id: 'spk-grille',
    parentNode: 'spk',
    shortName: 'L6. Grille',
    title: 'Lapisan 6 · Grille Logam & Rangka Plafon',
    category: 'Transduser',
    badge: 'Ceiling Speaker · Lapisan 6',
    func: 'Melindungi membran cone dari debu, serangga, dan benturan fisik sekaligus menyatukan tampilan speaker secara rapi dengan plafon bangunan.',
    detail: 'Lubang perforasi dirancang memiliki rasio terbuka tinggi agar gelombang akustik keluar tanpa mengalami refleksi atau pelemahan signifikan.',
    specs: [
      'Material plat logam berlapis cat bubuk putih standar plafon arsitektural.',
      'Dipasang pada dudukan plafon dengan penjepit pegas (spring clamp).',
    ],
    cam: [17.0, 4.8, 4.6],
    target: [16.9, 2.35, 0],
  },
  'spk-parallel': {
    id: 'spk-parallel',
    parentNode: 'spk',
    shortName: 'Speaker Paralel',
    title: 'Array Beban Speaker Paralel (100V Line)',
    category: 'Komponen Daya',
    badge: 'Ceiling Speaker · Distribusi Multi-Zona',
    func: 'Merepresentasikan jumlah unit speaker (1 hingga 6 unit) yang terhubung paralel pada satu jalur kabel 100V Line.',
    detail: 'Penambahan speaker paralel menjumlahkan total daya beban (P_total = N × Tap Wattage) dan menurunkan impedansi total jalur secara proporsional.',
    specs: [
      'Contoh: 6 speaker × Tap 15W = 90 W total beban (Impedansi jalur = 111 Ω).',
      'Beban berlebih pada attenuator tinggi akan memicu status Overload pada Power Amp.',
    ],
    cam: [18.5, 5.2, 3.8],
    target: [16.8, 1.4, -2.5],
  },
  'sensor-spl': {
    id: 'sensor-spl',
    parentNode: 'spk',
    shortName: 'Sensor Output SPL',
    title: 'Sensor Akustik Output (SPL Meter Ruangan)',
    category: 'Sensor Telemetri',
    badge: 'Sensor Telemetri · Output Ruangan',
    func: 'Memantau tingkat tekanan suara aktual (Sound Pressure Level / dB) yang berhasil dipancarkan Ceiling Speaker ke area pendengar.',
    detail: 'Membaca efek kumulatif dari Gain Mixer, Master Fader, Attenuator Power Amp, rugi kabel 100V Line, serta pilihan Tap Wattage speaker.',
    specs: [
      'Menurun drastis ke level ambien jika terjadi voltage drop ekstrem atau proteksi trip.',
      'Memastikan keterbacaan pengumuman darurat selalu berada di atas kebisingan ruangan.',
    ],
    cam: [18.2, 4.2, 4.6],
    target: [17.3, 1.35, 0.9],
  },

  // --- 5. JALUR TRANSMISI ---
  'signal-cable': {
    id: 'signal-cable',
    parentNode: 'cable',
    shortName: 'Kabel Transmisi',
    title: 'Jalur Transmisi Sinyal (mV → Line Level → 100V Line)',
    category: 'Jalur Transmisi',
    badge: 'Distribusi Sinyal · 3 Domain Tegangan',
    func: 'Menghubungkan seluruh rantai perangkat dengan tiga tingkatan tegangan berbeda untuk menjaga kualitas audio sekaligus efisiensi jarak jauh.',
    detail: 'Partikel biru menunjukkan sinyal mV & Line Level, partikel kuning menandakan tegangan tinggi 100V Line jarak jauh, dan partikel hijau menunjukkan daya menuju speaker (merah saat proteksi trip).',
    specs: [
      'Segmen 1 (Mic → Mixer): Sinyal milivolt sangat lemah, wajib kabel pendek berpelindung.',
      'Segmen 2 (Mixer → Power Amp): Sinyal standar Line Level (~1Vrms).',
      'Segmen 3 (Power Amp → Speaker): Tegangan 100V Line, sanggup menempuh jarak hingga 400 m.',
    ],
    cam: [1.5, 11.5, 22],
    target: [1.5, 1.6, 0],
  },
};

export const NODE_COMPONENTS: Record<NodeKey, ComponentId[]> = {
  mic: [
    'mic-base',
    'mic-gooseneck',
    'mic-grille',
    'mic-foam',
    'mic-diaphragm',
    'mic-coil',
    'mic-magnet',
    'mic-housing',
    'sensor-sound',
  ],
  mixer: [
    'mixer-chassis',
    'mixer-gain',
    'mixer-eq',
    'mixer-priority',
    'mixer-faders',
    'mixer-buffer',
    'sensor-mixer-temp',
  ],
  amp: [
    'amp-chassis',
    'amp-psu',
    'amp-driver',
    'amp-mosfet',
    'amp-heatsink',
    'sensor-temp',
    'amp-protect',
    'sensor-current',
    'amp-trafo',
  ],
  spk: [
    'spk-trafo',
    'spk-coil',
    'spk-magnet',
    'spk-spider',
    'spk-cone',
    'spk-grille',
    'spk-parallel',
    'sensor-spl',
  ],
};

export const ALL_SENSORS: ComponentId[] = [
  'sensor-sound',
  'sensor-mixer-temp',
  'sensor-temp',
  'sensor-current',
  'sensor-spl',
];

export const NODE_ORDER: NodeKey[] = ['mic', 'mixer', 'amp', 'spk'];

export function computeSimulationTelemetry(
  state: SimulationState,
  prevTempC: number
): TelemetrySnapshot {
  const priorityActive = state.ptt || state.alarm;
  const activeAudio =
    (state.ptt ? 1.0 : 0.0) +
    (state.alarm ? 1.2 : 0.0) +
    (!priorityActive && state.bgm ? 0.55 : 0.0);

  const loadFactor = (state.tapWatts / 15) * (state.spkCount / 6) * state.atten;
  const soundDb = Number(
    (35 + Math.min(65, activeAudio * 28 * (0.5 + state.gain * 0.6))).toFixed(1)
  );

  let currentA: number;
  let protectTripped: boolean;

  if (state.fault === 'short') {
    currentA = 18.5;
    protectTripped = true;
  } else if (state.fault === 'overload' || loadFactor > 0.88) {
    currentA = Number((7.5 + loadFactor * 6.5).toFixed(2));
    protectTripped = true;
  } else {
    currentA = Number((0.4 + loadFactor * 3.8 + activeAudio * 0.45).toFixed(2));
    protectTripped = false;
  }

  const targetTemp = 28 + loadFactor * 36 + (protectTripped ? 18 : 0) + activeAudio * 4;
  const tempC = Number((prevTempC + (targetTemp - prevTempC) * 0.08).toFixed(1));
  const mixerTempC = Number((27.5 + state.gain * 5.2 + (priorityActive ? 2.4 : 0)).toFixed(1));

  const nominalTotalWatts = state.tapWatts * state.spkCount;
  const effectiveLoadWatts = protectTripped
    ? 0
    : Number((nominalTotalWatts * state.atten * state.fader).toFixed(1));
  const lineImpedanceOhm =
    nominalTotalWatts > 0 ? Math.round((100 * 100) / nominalTotalWatts) : 9999;

  const loopResistance = state.cableMeters * 0.024;
  const lineCurrentNominal = (nominalTotalWatts / 100) * state.atten;
  const voltageDropV = protectTripped
    ? 100
    : Number(Math.min(18, lineCurrentNominal * loopResistance).toFixed(2));
  const deliveredVoltageV = protectTripped
    ? 0
    : Number(Math.max(0, 100 * state.atten - voltageDropV).toFixed(1));

  const cableAtten = Math.max(0.45, 1 - (state.cableMeters / 400) * 0.35);
  const outputSplDb = protectTripped
    ? 36.0
    : Number(
        (
          38 +
          Math.min(
            64,
            activeAudio *
              24 *
              (0.45 + state.fader * 0.55) *
              (0.4 + state.atten * 0.7) *
              cableAtten *
              (0.55 + (state.tapWatts / 15) * 0.55)
          )
        ).toFixed(1)
      );

  return {
    tempC,
    mixerTempC,
    soundDb,
    outputSplDb,
    currentA,
    priorityActive,
    protectTripped,
    totalLoadWatts: effectiveLoadWatts,
    lineImpedanceOhm,
    voltageDropV,
    deliveredVoltageV,
  };
}
