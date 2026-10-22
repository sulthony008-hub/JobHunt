# Rangkuman JobHunter

**Lokasi baru:** `D:\Project Saya\JobHunter`
**Lokasi lama:** `D:\JobHunter` → `D:\Project automaton\JobHunter` (sudah dipindahkan)

> Proyek mengikuti aturan global: proyek baru disimpan di `D:\Project Saya\`.
> JobHunter ada di subfolder `JobHunter`.

## File di dalam proyek

| File / folder | Fungsi |
|---|---|
| `lamaran.xlsx` | Tracker utama: sheet `Lamaran`, `Log`, `Panduan`, `Sumber` |
| `profil.yaml` | Data pelamar, kriteria lowongan, aturan pengiriman |
| `sumber.yaml` | Daftar sumber lowongan (LinkedIn, JobStreet, Glints, dll) |
| `README.md` | Dokumentasi utama + cara setup |
| `AGENTS.md` | Konteks singkat untuk agen Hermes |
| `requirements.txt` | Dependensi: Flask, openpyxl, PyYAML |
| `Buka Dashboard.bat` | Launcher dashboard (path relatif, aman dipindah) |
| `cv\CV.pdf` | CV aktif (belum ada) |
| `cv\versions\` | Arsip CV lama dari upload dashboard |
| `drafts\` | Draft email sebelum dikirim |
| `logs\` | Log hasil pencarian / pengiriman |
| `templates\email_lamaran.txt` | Template surat lamaran |
| `templates\follow_up.txt` | Template follow-up |
| `dashboard\app.py` | Server Flask lokal `127.0.0.1:8770` |
| `dashboard\templates\index.html` | Halaman dashboard |
| `dashboard\static\style.css` | Tema gelap futuristik |
| `dashboard\static\app.js` | Logika UI + pemanggilan API |
| `scripts\tracker.py` | CLI baca/tambah/update tracker |
| `scripts\build_tracker.py` | Membuat ulang file tracker |
| `scripts\setup.py` | Setup profil & email interaktif |
| `scripts\doctor.py` | Cek kesiapan sistem |
| `skill\job-hunter\SKILL.md` | Salinan portabel skill untuk repo |
| `skill\README.md` | Cara pasang skill + cron di Hermes |

## File di luar proyek (tetap dipakai)

| File / lokasi | Fungsi |
|---|---|
| `D:\Hermes\skills\productivity\job-hunter\SKILL.md` | Skill Hermes `job-hunter` — path sudah diperbarui |
| `D:\Hermes\skills\productivity\job-hunter\references\klasifikasi-balasan.md` | Panduan klasifikasi balasan |
| `C:\Users\WIN 10\.config\himalaya\config.toml` | Konfigurasi IMAP/SMTP Gmail (belum dibuat) |
| `C:\Users\WIN 10\.config\himalaya\app-password.txt` | App Password Gmail (belum dibuat) |
| `D:\Hermes\bin\himalaya.exe` | CLI email v1.2.0 |
| Hermes cron `6aaca6533e07` | Pantau inbox tiap 30 menit — workdir sudah diperbarui |
| Hermes cron `c09ab47beb67` | Follow-up harian 09:00 — workdir + prompt sudah diperbarui |
| Hermes cron `747a7dbe17dd` | Laporan pagi 07:00 — workdir sudah diperbarui |

Skill asli tetap di folder Hermes agar terbaca oleh Hermes. Salinan portabelnya
ada di `skill\job-hunter\` supaya orang lain bisa memasangnya setelah clone.

## Alur data

```
Dashboard / setup.py / tracker.py
        │
        ├─ profil.yaml     (data pelamar + kriteria)
        ├─ sumber.yaml     (sumber lowongan aktif)
        └─ lamaran.xlsx    (tracker)
                │
                └─ dibaca oleh skill job-hunter (Hermes)
                        │
                        ├─ cari lowongan
                        ├─ susun draft
                        ├─ kirim via himalaya (butuh approval)
                        └─ pantau balasan + follow-up
```

## Perintah penting

Path mengandung spasi, jadi **pakai tanda kutip**:

```powershell
# Dashboard
& "D:\Project Saya\JobHunter\Buka Dashboard.bat"
python "D:\Project Saya\JobHunter\dashboard\app.py"

# Cek kesiapan
python "D:\Project Saya\JobHunter\scripts\doctor.py"
python "D:\Project Saya\JobHunter\scripts\doctor.py" --online

# Setup
python "D:\Project Saya\JobHunter\scripts\setup.py" profil
python "D:\Project Saya\JobHunter\scripts\setup.py" email

# Tracker
python "D:\Project Saya\JobHunter\scripts\tracker.py" list
python "D:\Project Saya\JobHunter\scripts\tracker.py" list --json
```

Dashboard: <http://127.0.0.1:8770>

## Status saat ini

- Proyek sudah pindah ke `D:\Project Saya\JobHunter`.
- Semua path internal, dokumentasi, skill, dan cron sudah diperbarui.
- Tracker kosong, belum ada lamaran.
- Profil, CV, dan kriteria belum diisi.
- Email agen `jobhntr01@gmail.com` sudah terhubung dan terverifikasi (IMAP + SMTP).
- Tes kirim ke `sulthony008@gmail.com` berhasil; email internal juga berhasil.
- Alias folder Gmail memakai nama lokal: `[Gmail]/Surat Terkirim`, `[Gmail]/Draf`,
  `[Gmail]/Tong Sampah` (dideteksi otomatis oleh `setup.py`).
- Cron JobHunter masih **paused** menunggu email agen siap.

## Backup

Sebelum dipindahkan, salinan proyek lama dibuat di:

`C:\Users\WIN 10\AppData\Local\Temp\JobHunter_backup_20261022.zip`
