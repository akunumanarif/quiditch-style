# Broom League · Windmere · M2

Browser game 3D Babylon.js dengan **pertandingan 7v7 + bot**, bola/gol, empat role, timer, hasil/rematch, **latihan terbang 60 detik**, karakter/sapu GLB berig, material PBR scan, sky HDR, dan private flight multiplayer Colyseus. Tidak membutuhkan akun atau database.

## Jalankan

Node.js **22+** dan browser desktop dengan WebGL2/WebGPU:

```sh
npm install
npm run dev
```

Buka **http://localhost:5173**. Vite 5173 dan Colyseus 2567 dijalankan bersamaan. `.nvmrc` dan paket Node 22 lokal tersedia.

## Cara bermain

1. Isi nama → **Quick practice** → readiness check → Continue. Menu memakai satu capture arena lokal yang ringan; arena penuh, tekstur dan Havok dimuat setelah readiness.
2. **W** memberi dorongan, **S** rem udara, **A/D** condong kiri/kanan; **W+A/D** terbang serong, **Space** menanjak, **E** menukik/turun, **Shift kiri + W** boost, mouse/arrow keys untuk arah, **R** recenter. **Q** putar balik 180° (~0,8 detik, 24 energi, cooldown 3 detik); **Q sambil A** memilih arah putaran kiri. Klik canvas untuk mouse look.
3. Lewati waypoint emas sebanyak mungkin dalam **60 detik**. Hasil menampilkan waypoint/lap dan menyediakan **Fly again**. Ini hasil latihan lokal, bukan skor pertandingan authoritative.
4. **Esc → Settings** untuk grafik, sensitivitas, reduced motion, suara dan keyboard remapping. Klik nama tombol untuk mengubahnya, lalu Save. Pengaturan versi lama tetap dibaca dengan default aman.
5. **Play 7v7 match** atau **Create room** → pilih tim/role/durasi → **Ready → Mulai pertandingan**. Host seorang diri cukup; bot mengisi slot kosong. Untuk teman: **Copy invite** → buka di browser/incognito kedua sebelum kick-off. Semua manusia harus Ready. Server match 30 Hz, snapshot 10 Hz.
6. **F** mengambil/merebut/mengoper bola bagi Striker/Keeper, menangkis bagi Warden, menangkap target bagi Seeker. Klik arena untuk mouse look; klik kiri berikutnya menembak bola / memukul hazard / menangkap target sesuai role. **E tetap turun**.
7. Gol **+10**, tangkapan Aurel Wing **+30 dan mengakhiri match**. Skor tertinggi menang, seri diperbolehkan. Durasi 1/5/10 menit; default 10 menit. Hasil menampilkan gol/oper/tangkapan setiap pilot; host bisa Rematch.
8. **F3** menampilkan FPS, p95, draw calls, renderer dan RTT.

Kamera menghindari lantai, perimeter dan tiang ring. Flight memiliki inersia, banking, energi boost, batas kecepatan gabungan, dan collision recovery. Input roll/vertikal serta heading memakai easing; posisi tubuh memakai spring, delapan klip animasi dibaurkan secara kontinu, dan chase camera mengikuti pose yang dirender dengan transisi posisi serta arah pandang. Transisi boost juga bertahap. Audio angin dan nada waypoint disintesis lokal, dapat dinonaktifkan.

## Aset M1

- Stadion orisinal dengan arkade terbuka, tribun kayu, cornice, menara, atap slate, banner dan enam ring brass.
- Terrain bergelombang menggantikan gunung kerucut M0.
- Material batu, rumput, slate dan kulit CC0 dari Poly Haven, disimpan lokal dengan normal dan ARM maps. Langit HDR memberi lingkungan dan refleksi PBR.
- Pilot/sapu orisinal dari Blender: **21.024 triangle, 9 mesh parts, 12 joints, 8 klip**, GLB ~1,35 MB. Helm/goggles, sepatu, sarung tangan, jubah beranimasi, shaft melengkung dan 100 willow twigs.
- Low mempertahankan diffuse scan dengan shading statis lebih ringan, menurunkan resolusi, serta menonaktifkan shadow dan normal detail; High mengaktifkan pencahayaan/shadow lebih lengkap. Stand/tower digabung per material untuk membatasi draw calls.

Ini art pass M1 dengan kemajuan dari proksi M0; karakter masih memerlukan sculpt, detail kain/wajah, LOD lanjutan dan animasi yang lebih matang untuk kualitas final PRD.

[Preview stadion](docs/screenshots/m1-stadium.png) · [Flight High](docs/screenshots/m1-flight-high.png) · [Pilot](docs/screenshots/m1-rider.png)

## Verifikasi

```sh
npm run check
# Dev services tetap berjalan, terminal kedua:
npx playwright install chromium
npm run test:browser
```

`check`: strict TypeScript, ESLint, 42 unit/integration tests dan production build. Browser QA menyelesaikan satu latihan **60 detik nyata**, retry, remapping/audio persistence, Havok, GLB/sky, invite dan gerakan dua browser terpisah. Screenshot dan hasil pengukuran ditulis ke `docs/`.

```sh
npm run build
npm run preview -w apps/web
npm start -w apps/server
BASE_URL=http://localhost:4173 npm run test:browser
```

Output: `apps/web/dist`. Set `VITE_SERVER_URL=wss://server.example` saat build untuk hosting publik; client membutuhkan HTTPS dan server WSS. Untuk LAN, gunakan IP host, buka port 5173 dan 2567. `localhost` pada perangkat lain menunjuk perangkat itu sendiri. TLS/public hosting belum disiapkan.

## Membangun ulang aset

`npm run assets:build` mengunduh dependensi CC0 yang belum tersedia dan menjalankan Blender background. Set `BLENDER_BIN` bila executable tidak ada di PATH; macOS Blender.app dideteksi otomatis. Sumber rig tersimpan di `assets-source/windmere-rider.blend`. [Manifest](public-assets/manifest.json), [vendor hashes](public-assets/vendor-manifest.json), [provenance/lisensi](docs/ASSET_LICENSES.md).

## Batasan dan tahap berikutnya

**M2 diimplementasikan**: bot pengisi 7v7, bola authoritative dengan swept goal detection, dua hazard, Aurel Wing, aksi empat role, countdown/timer, skor, hasil dan rematch. Lobby, Ready, host handover dan penggantian pemain yang keluar juga tersedia. M3 berikutnya melengkapi prediction/reconciliation, refresh recovery dan deployment. M4 sinematik serta final art/audio; M5 QA 14 client dan perangkat target.

Automatic reconnect transport memiliki grace 30 detik. Token disimpan dalam sessionStorage; recovery setelah refresh belum memiliki UI. Semua room hilang saat server restart. Tidak ada akun/leaderboard/database.

Profil headless lokal tidak membuktikan 60 FPS pada perangkat target. Lihat [profiling M1](docs/PROFILING.md), [milestone](docs/MILESTONES.md), dan [QA](docs/QA_TEST_PLAN.md). Semua gate performa dan art review yang belum diuji tetap dicatat terbuka.

Uji khusus kelancaran gerak (client/server tetap berjalan):

```sh
npm run test:flight
# Build preview:
BASE_URL=http://localhost:4173 npm run test:flight
```

Uji ini menekan kanan/kiri, naik/turun dan berbelok secara nyata di Chromium, lalu merekam kontinuitas kemiringan, arah kamera, bobot animasi dan FPS ke `docs/qa-flight-smoothing.json`.

## Aerodinamika dan rasa angin

Gerakan memakai integrasi gaya pada 120 Hz: thrust, drag berbasis kuadrat airspeed, crosswind/gust, gravitasi serta bantuan hover fantasi. Lepas W untuk meluncur; tahan S untuk mengerem. Menukik menambah kecepatan, menanjak menghabiskan momentum, dan perubahan heading lewat mouse/panah memerlukan radius serta banking lebih besar. A/D hanya mengatur sudut kemiringan sampai ~55°: tanpa W tidak menambah yaw maupun dorongan samping; bersama W, dorongan dibelokkan mengikuti sudut kemiringan sehingga lintasan menjadi serong.

Tekanan dinamis memengaruhi lapisan audio angin stereo, streak udara, playback jubah, FOV dan getaran kamera ringan. HUD menunjukkan airspeed, tekanan Pa, beban G dan kesiapan Q. Reduced Motion mematikan streak/getaran dan banking visual tambahan. Angka tekanan/G adalah state simulasi game. Model ini dituning untuk terbang fantasi sinematik, bukan hasil pengukuran kendaraan nyata atau rekonstruksi fisika sebuah film.

```sh
# Client/server aktif:
npm run test:aero
# Build preview:
BASE_URL=http://localhost:4173 npm run test:aero
```

Uji memeriksa coast, tekanan/efek angin, pembalikan arah gerak oleh Q, energi/cooldown, climb/bank dan reduced motion. Hasil tersimpan di `docs/qa-aerodynamics.json`; tuning dan asumsi di [FLIGHT_PHYSICS.md](docs/FLIGHT_PHYSICS.md).

## Kontrol condong dan descend E

A/D kini mengatur sikap badan/sapu pada sumbu roll. Model sudut memakai torsi, kecepatan sudut dan redaman yang bertambah sesuai tekanan udara. Saat tombol dilepas, badan kembali tegak secara bertahap; torso bereaksi sedikit terlambat terhadap kemiringan untuk memberi kesan bobot. Arah hadap tetap di mouse/panah. W memberi dorongan, dan W+A/D mengarahkannya serong mengikuti kemiringan badan. Q tetap putar balik khusus.

Default descend adalah **E**. Profil lama yang masih menyimpan Ctrl di-upgrade otomatis dan petunjuk HUD mengikuti binding aktif. Remapping khusus berikutnya tetap didukung.

```sh
npm run test:roll
BASE_URL=http://localhost:4173 npm run test:roll
```

Uji memeriksa kemiringan kiri/kanan tanpa yaw/lateral thrust, kembali tegak, reaksi rig, migrasi binding yang tersimpan, E untuk turun, serta gerak serong kiri/kanan saat W+A/D tanpa memutar arah hadap.

## QA pertandingan M2

```sh
# Server dan preview produksi aktif di 2567 / 4173:
npm run test:match
```

Uji dua browser + 12 bot dari lobby hingga hasil dan rematch. `tests/match.test.ts` juga menjalankan pertandingan 14 bot dengan kontrol tervalidasi hingga gol kedua tim, penyelamatan keeper dan tangkapan final. Model bot memakai LOD berig 4.957 segitiga dengan satu klip Flight; model pemain utama mempertahankan delapan klip. Bangun ulang dengan Blender background memakai `assets-source/build_lod.py`.
