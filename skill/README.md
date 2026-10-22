# Skill Hermes: job-hunter

Folder ini berisi salinan skill Hermes `job-hunter` supaya orang lain bisa
mereplikasi otomasi JobHunter. Dashboard dan tracker tetap bisa dipakai tanpa
Hermes; skill ini hanya dibutuhkan untuk pencarian/lamaran/pemantauan otomatis.

## Instal ke Hermes

1. Cari folder home Hermes. Di mesin ini: `D:\Hermes`.
   Skill harus berada di:

   ```
   <HERMES_HOME>\skills\productivity\job-hunter\
   ├─ SKILL.md
   └─ references\klasifikasi-balasan.md
   ```

2. Salin isi folder ini ke sana:

   ```powershell
   $dest = "D:\Hermes\skills\productivity\job-hunter"
   New-Item -ItemType Directory -Path $dest -Force | Out-Null
   Copy-Item ".\skill\job-hunter\*" $dest -Recurse -Force
   ```

   Ganti `D:\Hermes` kalau Hermes-mu di lokasi lain.

3. Cek skill terpasang:

   ```powershell
   hermes skills list
   ```

   Pastikan `job-hunter` muncul dengan status `enabled`.

## Menjalankan agen

Jalankan Hermes dengan working directory di root proyek, lalu minta:

> Gunakan skill job-hunter. Baca profil.yaml dan sumber.yaml, cari lowongan
> yang aktif, tambahkan kandidat ke tracker, dan jangan kirim email tanpa
> approval.

Contoh:

```powershell
cd "D:\Project Saya\JobHunter"
hermes chat --in "D:\Project Saya\JobHunter" -s job-hunter
```

Atau one-shot:

```powershell
hermes chat --in "D:\Project Saya\JobHunter" -s job-hunter --oneshot -q "Gunakan skill job-hunter. Cari lowongan sesuai profil.yaml dan sumber.yaml, tambahkan ke tracker, jangan kirim email."
```

Path di dalam `SKILL.md` bersifat **relatif terhadap root proyek**, jadi
pastikan workdir Hermes menunjuk ke folder proyek.

## Cron opsional

Buat setelah email agen siap. Ganti `<PROJECT>` dengan path clone.

```powershell
# Pantau inbox tiap 30 menit
hermes cron create "*/30 * * * *" "Gunakan skill job-hunter. Periksa INBOX email agen dengan himalaya, cocokkan dengan lamaran berstatus Terkirim/Follow-up/Screening/Interview/Tes di tracker, baca thread yang relevan, lalu klasifikasikan dan perbarui tracker. Jangan kirim atau balas email apa pun." --name "JobHunter - Pantau Inbox" --skill job-hunter --workdir "<PROJECT>" --deliver local --paused

# Follow-up harian 09:00
hermes cron create "0 9 * * *" "Gunakan skill job-hunter. Cari lamaran Terkirim yang sudah 7 hari atau lebih dan belum ada balasan. Siapkan draft follow-up di drafts/, maksimal 2 per lamaran. JANGAN kirim; minta approval." --name "JobHunter - Follow-up Harian" --skill job-hunter --workdir "<PROJECT>" --deliver local --paused

# Laporan pagi 07:00
hermes cron create "0 7 * * *" "Gunakan skill job-hunter. Buat laporan pipeline dari tracker: jumlah per status, lamaran baru, interview/tes/offer terdekat, follow-up jatuh tempo, dan yang perlu keputusan pengguna. Jangan ubah tracker atau kirim email." --name "JobHunter - Laporan Pagi" --skill job-hunter --workdir "<PROJECT>" --deliver local --paused
```

Aktifkan dengan `hermes cron resume <id>` setelah email/App Password siap.

## Tanpa Hermes

Tanpa Hermes, temanmu tetap bisa:

- membuka dashboard,
- mengelola tracker,
- upload CV,
- mengatur sumber lowongan,
- tes koneksi email.

Yang tidak tersedia tanpa Hermes adalah pencarian/lamaran/pemantauan otomatis.
