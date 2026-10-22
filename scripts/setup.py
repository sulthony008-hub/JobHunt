r"""Setup interaktif JobHunter (profil + koneksi email).

Contoh:
    python scripts/setup.py profil
    python scripts/setup.py email
    python scripts/setup.py check

Tidak ada data yang dikirim ke mana pun. Password Gmail hanya ditulis ke
%USERPROFILE%\.config\himalaya\app-password.txt dan tidak ditampilkan.
"""

from __future__ import annotations

import getpass
import json
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

import yaml

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

ROOT = Path(os.environ.get("JOBHUNTER_ROOT", Path(__file__).resolve().parent.parent))
PROFIL = ROOT / "profil.yaml"
CV = ROOT / "cv" / "CV.pdf"
HIMALAYA = Path(os.environ.get("HIMALAYA_BIN", shutil.which("himalaya") or r"D:\Hermes\bin\himalaya.exe"))
CONFIG_DIR = Path.home() / ".config" / "himalaya"
CONFIG = CONFIG_DIR / "config.toml"
PASSWORD = CONFIG_DIR / "app-password.txt"

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def load_profil() -> dict:
    if PROFIL.exists():
        data = yaml.safe_load(PROFIL.read_text(encoding="utf-8")) or {}
        if isinstance(data, dict):
            return data
    return {}


def save_profil(data: dict) -> None:
    header = (
        "# Profil pelamar & kriteria lowongan.\n"
        "# Dibuat/diperbarui oleh scripts/setup.py. Boleh diedit manual.\n\n"
    )
    body = yaml.safe_dump(data, allow_unicode=True, sort_keys=False, default_flow_style=False)
    PROFIL.write_text(header + body, encoding="utf-8")


def ask(label: str, current="") -> str:
    shown = f" [{current}]" if current not in ("", None, []) else ""
    value = input(f"{label}{shown}: ").strip()
    return value if value else ("" if current is None else str(current))


def ask_list(label: str, current) -> list[str]:
    if isinstance(current, list):
        shown = ", ".join(str(item) for item in current)
    else:
        shown = ""
    raw = ask(f"{label} (pisahkan dengan koma)", shown)
    return [part.strip() for part in raw.split(",") if part.strip()]


def ask_int(label: str, current):
    while True:
        raw = ask(f"{label} (angka rupiah, kosongkan jika tidak ada)", "" if current is None else current)
        if not raw:
            return None
        try:
            return int(raw.replace(".", "").replace(",", ""))
        except ValueError:
            print("  ! Masukkan angka, contoh 8000000")


def cmd_profil() -> int:
    data = load_profil()
    kriteria = data.get("kriteria") or {}
    pengiriman = data.get("pengiriman") or {}
    notifikasi = data.get("notifikasi") or {}

    print("=== Profil pelamar ===")
    data["nama_lengkap"] = ask("Nama lengkap", data.get("nama_lengkap", ""))
    data["email_agen"] = ask("Email Gmail agen", data.get("email_agen", ""))
    data["no_hp"] = ask("No. HP", data.get("no_hp", ""))
    data["kota_domisili"] = ask("Kota domisili", data.get("kota_domisili", ""))
    data["linkedin"] = ask("LinkedIn", data.get("linkedin", ""))
    data["portfolio"] = ask("Portfolio", data.get("portfolio", ""))
    data["cv_path"] = str(CV).replace("\\", "/")

    print("\n=== Kriteria lowongan ===")
    kriteria["posisi"] = ask_list("Posisi yang dicari", kriteria.get("posisi", []))
    kriteria["lokasi"] = ask_list("Lokasi", kriteria.get("lokasi", []))
    kriteria["mode"] = [
        item.lower() for item in ask_list("Mode kerja (remote/hybrid/onsite)", kriteria.get("mode", []))
    ]
    kriteria["gaji_min"] = ask_int("Gaji minimum", kriteria.get("gaji_min"))
    kriteria["level"] = [
        item.lower() for item in ask_list("Level (magang/entry/junior/mid/senior)", kriteria.get("level", []))
    ]
    kriteria["industri"] = ask_list("Industri", kriteria.get("industri", []))
    kriteria["kata_kunci_wajib"] = ask_list("Kata kunci wajib", kriteria.get("kata_kunci_wajib", []))
    kriteria["kata_kunci_hindari"] = ask_list(
        "Kata kunci yang dihindari", kriteria.get("kata_kunci_hindari", [])
    )
    data["kriteria"] = kriteria

    data["sumber"] = ask_list("Sumber lowongan", data.get("sumber", ["JobStreet", "Glints", "Kalibrr", "Dealls"]))

    pengiriman.setdefault("mode", "draft_approval")
    pengiriman.setdefault("batas_per_hari", 10)
    pengiriman.setdefault("follow_up_hari", 7)
    pengiriman.setdefault("follow_up_maksimal", 2)
    pengiriman.setdefault("kirim_dari_email_agen", True)
    data["pengiriman"] = pengiriman
    notifikasi.setdefault("telegram", False)
    data["notifikasi"] = notifikasi
    data.setdefault("tracker", str(ROOT / "lamaran.xlsx").replace("\\", "/"))

    save_profil(data)
    print(f"\nOK: profil disimpan -> {PROFIL}")

    if data["email_agen"] and not EMAIL_RE.match(data["email_agen"]):
        print("  ! Format email_agen terlihat tidak valid.")
    if not CV.exists():
        print(f"  ! CV belum ada: {CV}  (taruh CV PDF di sana)")
    print("Langkah berikut: python D:\\Project Saya\\JobHunter\\scripts\\setup.py email")
    return 0


def _short_path(path: Path) -> str:
    """Windows 8.3 path (tanpa spasi) supaya cmd /c type tidak pecah."""
    try:
        import ctypes

        buffer = ctypes.create_unicode_buffer(32768)
        result = ctypes.windll.kernel32.GetShortPathNameW(str(path), buffer, len(buffer))
        if result:
            value = buffer.value
            if value and " " not in value:
                return value
    except Exception:
        pass
    return str(path)


def _gmail_aliases() -> dict:
    """Deteksi nama folder Gmail (bisa lokal: Surat Terkirim, Draf, ...)."""
    try:
        result = subprocess.run(
            [str(HIMALAYA), "folder", "list", "-a", "gmail", "-o", "json"],
            capture_output=True,
            text=True,
            timeout=30,
        )
    except (OSError, subprocess.TimeoutExpired):
        return {}
    if result.returncode != 0:
        return {}
    try:
        folders = json.loads(result.stdout or "[]")
    except json.JSONDecodeError:
        return {}
    aliases = {}
    for folder in folders:
        if not isinstance(folder, dict):
            continue
        desc = str(folder.get("desc") or "")
        name = str(folder.get("name") or "")
        if "\\Sent" in desc:
            aliases["sent"] = name
        if "\\Drafts" in desc:
            aliases["drafts"] = name
        if "\\Trash" in desc:
            aliases["trash"] = name
    return aliases


def sync_folder_aliases() -> None:
    aliases = _gmail_aliases()
    if not aliases or not CONFIG.exists():
        return
    text = CONFIG.read_text(encoding="utf-8")
    for key, value in aliases.items():
        text = re.sub(
            rf'(?m)^folder\.aliases\.{key} = ".*"$',
            f'folder.aliases.{key} = "{value}"',
            text,
        )
    CONFIG.write_text(text, encoding="utf-8")


def write_config(email: str) -> None:
    password_path = _short_path(PASSWORD)
    command = f"cmd /c type {password_path}"
    if " " in password_path:
        # Fallback: wrapper .cmd di folder tanpa spasi (D:\Hermes\bin).
        wrapper = HIMALAYA.parent / "read-app-password.cmd"
        wrapper.write_text(
            f'@echo off\r\ntype "{PASSWORD}"\r\n',
            encoding="utf-8",
        )
        command = str(wrapper)
    toml_command = command.replace("\\", "\\\\")
    config = f'''# Konfigurasi himalaya untuk agen JobHunter.
# Password dibaca dari file terpisah, bukan dari file ini.
[accounts.gmail]
email = "{email}"
display-name = "JobHunter"
default = true
backend.type = "imap"
backend.host = "imap.gmail.com"
backend.port = 993
backend.encryption.type = "tls"
backend.login = "{email}"
backend.auth.type = "password"
backend.auth.cmd = "{toml_command}"
message.send.backend.type = "smtp"
message.send.backend.host = "smtp.gmail.com"
message.send.backend.port = 587
message.send.backend.encryption.type = "start-tls"
message.send.backend.login = "{email}"
message.send.backend.auth.type = "password"
message.send.backend.auth.cmd = "{toml_command}"
folder.aliases.inbox = "INBOX"
folder.aliases.sent = "[Gmail]/Sent Mail"
folder.aliases.drafts = "[Gmail]/Drafts"
folder.aliases.trash = "[Gmail]/Trash"
'''
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    CONFIG.write_text(config, encoding="utf-8")
    sync_folder_aliases()


def restrict(path: Path) -> None:
    user = Path.home().name
    try:
        subprocess.run(
            ["icacls", str(path), "/inheritance:r", "/grant:r", f"{user}:(F)"],
            check=False,
            capture_output=True,
            text=True,
        )
    except OSError:
        pass


def test_connection() -> bool:
    try:
        result = subprocess.run(
            [str(HIMALAYA), "envelope", "list", "-a", "gmail", "-f", "INBOX", "-s", "1", "-o", "json"],
            capture_output=True,
            text=True,
            timeout=45,
        )
    except (OSError, subprocess.TimeoutExpired) as exc:
        print(f"  ! Gagal menjalankan himalaya: {exc}")
        return False
    if result.returncode == 0:
        sync_folder_aliases()
        print("OK: koneksi IMAP berhasil (INBOX terbaca).")
        return True
    detail = (result.stderr or result.stdout).strip()
    print("  ! Koneksi IMAP gagal:")
    print("   ", detail[:600])
    if "Invalid credentials" in detail or "AUTHENTICATIONFAILED" in detail:
        print("    Gmail menolak kredensial. Yang dipakai harus App Password 16 karakter,")
        print("    bukan password akun biasa. Aktifkan 2FA lalu buat App Password baru:")
        print("    https://myaccount.google.com/apppasswords")
    else:
        print("    Cek: 2FA aktif, app password 16 karakter, IMAP diaktifkan di Gmail.")
    return False


def cmd_email() -> int:
    data = load_profil()
    print("=== Koneksi email agen ===")
    print("Pakai Gmail khusus agen + App Password (bukan password akun).")
    print("Buat di: https://myaccount.google.com/apppasswords\n")

    email = ask("Alamat Gmail agen", data.get("email_agen", ""))
    if not EMAIL_RE.match(email):
        print("! Alamat email tidak valid.")
        return 1

    password = getpass.getpass("App Password 16 karakter (tidak akan ditampilkan): ")
    password = re.sub(r"\s+", "", password)
    if len(password) != 16:
        print(f"! App password harus 16 karakter, yang dimasukkan {len(password)}.")
        return 1

    CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    PASSWORD.write_text(password + "\n", encoding="utf-8", newline="\n")
    restrict(PASSWORD)
    write_config(email)

    data["email_agen"] = email
    save_profil(data)
    print(f"OK: config ditulis -> {CONFIG}")
    print(f"OK: app password disimpan -> {PASSWORD} (akses dibatasi)")

    if not HIMALAYA.exists():
        print(f"! himalaya tidak ditemukan: {HIMALAYA}")
        return 1
    return 0 if test_connection() else 1


def cmd_check() -> int:
    from doctor import main as doctor_main

    return doctor_main()


def main() -> int:
    command = sys.argv[1] if len(sys.argv) > 1 else "profil"
    actions = {"profil": cmd_profil, "email": cmd_email, "check": cmd_check}
    if command not in actions:
        print("Perintah: profil | email | check")
        return 2
    return actions[command]()


if __name__ == "__main__":
    raise SystemExit(main())
