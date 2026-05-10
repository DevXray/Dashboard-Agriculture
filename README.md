# AgroMonitor ESP32 — Setup singkat

> Repo ini berisi aplikasi web sederhana untuk menerima dan menampilkan data sensor dari ESP32.

File penting:

- [setup_sensor_esp32.sql](setup_sensor_esp32.sql) — skrip bootstrap untuk membuat database `sensor_esp32` dan tabel `DataSensor`.
- [koneksi.php](koneksi.php) — konfigurasi koneksi MySQL.
- [post-esp-data.php](post-esp-data.php) — endpoint yang menerima POST dari ESP32 (perlu `api_key`).

Langkah cepat (Windows + XAMPP)

1. Pastikan XAMPP (Apache + MySQL) terinstal dan berjalan.

2. Salin folder proyek ke `htdocs` XAMPP. Contoh: `C:\xampp\htdocs\esp32_sensorV3`

3. Import database menggunakan skrip bootstrap:

   - Jika `mysql` ada di PATH:

```bash
mysql -u root -p < setup_sensor_esp32.sql
```

   - Contoh di Windows menggunakan XAMPP (jika MySQL root tanpa password, tekan Enter):

```powershell
&C:\xampp\mysql\bin\mysql.exe -u root < setup_sensor_esp32.sql
# atau jika MySQL punya password
&C:\xampp\mysql\bin\mysql.exe -u root -p < setup_sensor_esp32.sql
```

   Alternatif: buka `http://localhost/phpmyadmin`, pilih *Import*, pilih file `setup_sensor_esp32.sql` dan jalankan.

4. Periksa konfigurasi database pada [koneksi.php](koneksi.php). Jika MySQL Anda menggunakan user/password berbeda, ubah nilai `DB_USER` dan `DB_PASS` sesuai.

5. API key: default API key untuk endpoint `post-esp-data.php` adalah `12345abcde`. Jika ingin mengganti, ubah pada `post-esp-data.php` dan pastikan firmware ESP32 menggunakan nilai yang sama.

Contoh POST data dari ESP32 / cURL

```bash
curl -X POST http://localhost/esp32_sensorV3/post-esp-data.php \
  -d "api_key=12345abcde" \
  -d "suhuUdara=28.5" -d "kelUdara=65" -d "kelTanah=72" -d "kecerahan=80" \
  -d "latitude=-5.1477" -d "longitude=119.4327"
```

Kemudian buka dashboard di:

```
http://localhost/esp32_sensorV3/
```

Catatan & troubleshooting singkat

- Jika halaman menunjukkan error koneksi database, periksa dan sesuaikan `DB_HOST`, `DB_USER`, `DB_PASS`, `DB_NAME` di [koneksi.php](koneksi.php).
- Jika import SQL gagal karena hak akses, pastikan akun MySQL Anda punya privilege CREATE DATABASE.
- SSE (`sse.php`) membuka koneksi panjang-pendek; jika environment memblokir long-running PHP, Anda bisa menonaktifkan real-time dan bergantung pada refresh biasa.
- Pastikan folder proyek berada di lokasi yang dilayani Apache (mis. `htdocs`) dan Apache berjalan.

Butuh bantuan lagi?

Jika ingin, saya bisa:

- Menjalankan import SQL sekarang (kalau Anda beri saya izin untuk mengeksekusi perintah), atau
- Membuat `setup.bat` untuk mempermudah import di Windows.
