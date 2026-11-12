#!/bin/bash
# 3D-Artmaker Installer fuer Renkforce RF1000 / RF2000 / RF2000 v2
# Klipper oder Marlin, Raspberry Pi oder MKS SKIPR.
#
#   bash 3dartmaker-install.sh            Auswahl wie im Config Creator, dann installieren
#   3DArtmaker-upgrade                    alle 3D-Artmaker-Pakete auf den neuesten Stand
#   Optionen: --probe (nur zeigen, nichts aendern), --text (ohne Dialogfenster), --ja (alle Fragen mit Ja)
#
# Repo: https://github.com/Dennis02121978/3D-Artmaker
set -uo pipefail

VERSION="dev"
REPO="Dennis02121978/3D-Artmaker"
MARLIN_REPO="Dennis02121978/Marlin-RFxxxx"
KLIPPER_FORK="https://github.com/Dennis02121978/klipper.git"
CREATOR_URL="https://3d-artmaker.de/config-creator.php"
LIBDIR="/usr/local/lib/3dartmaker"
STATE="/etc/3dartmaker/installer.conf"
OUR_PACKAGES="rf-update rf-multi rf-bootlogo rf-terminal skipr-update skipr-filament skipr-bootlogo"
TITLE="3D-Artmaker Installer"

PROBE=0; TEXT=0; YES=0; MODE=install
ARGS=("$@")
case "$(basename "$0")" in *upgrade*) MODE=upgrade ;; esac
for a in "$@"; do
    case "$a" in
        upgrade) MODE=upgrade ;;
        install) MODE=install ;;
        --probe|--dry-run) PROBE=1 ;;
        --text) TEXT=1 ;;
        --ja|--yes|-y) YES=1 ;;
        --version) echo "$VERSION"; exit 0 ;;
        -h|--help) sed -n '2,9p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
        *) echo "Unbekannte Option: $a" >&2; exit 2 ;;
    esac
done

case "${LC_ALL:-}${LANG:-}" in *UTF-8*|*utf8*|*UTF8*) ;; *) export LC_ALL=C.UTF-8 ;; esac
[ -t 0 ] && [ -t 1 ] && command -v whiptail >/dev/null && [ "$TEXT" = 0 ] && UI=whiptail || UI=text

WORK=$(mktemp -d /tmp/3dartmaker.XXXXXX)
trap 'rm -rf "$WORK"' EXIT
# Wird der Installer mit sudo gestartet, gehoeren Protokoll und Sicherungen trotzdem dem Benutzer
RUSER=${SUDO_USER:-$(id -un)}
RHOME=$(getent passwd "$RUSER" | cut -d: -f6); RHOME=${RHOME:-$HOME}
LOG="$RHOME/3dartmaker-install.log"
touch "$LOG" 2>/dev/null && [ "$(id -u)" = 0 ] && chown "$RUSER": "$LOG" 2>/dev/null
STAMP=$(date +%Y%m%d_%H%M%S)

# ---------------------------------------------------------------- Ausgabe
B=$'\e[1m'; G=$'\e[32m'; Y=$'\e[33m'; R=$'\e[31m'; N=$'\e[0m'
[ -t 1 ] || { B=; G=; Y=; R=; N=; }
CHK=(); CAPTURE=0
say()  { echo "$*"; echo "$(date '+%F %T') $*" >> "$LOG"; }
ok()   { say "${G}✔${N} $*"; [ "$CAPTURE" = 1 ] && CHK+=("✔ $*"); return 0; }
warn() { say "${Y}!${N} $*"; [ "$CAPTURE" = 1 ] && CHK+=("! $*"); return 0; }
info() { say "$*"; [ "$CAPTURE" = 1 ] && CHK+=("$*"); return 0; }
fail() { say "${R}✘ $*${N}"; exit 1; }
head1(){ echo; say "${B}== $* ==${N}"; }

# Fuehrt einen Befehl aus, im Probelauf wird er nur angezeigt.
run() {
    if [ "$PROBE" = 1 ]; then say "  [Probe] $*"; return 0; fi
    echo "$(date '+%F %T') \$ $*" >> "$LOG"
    "$@" 2>&1 | tee -a "$LOG"
    return "${PIPESTATUS[0]}"
}
srun() { run sudo "$@"; }
# Arbeiten an Dateien des Klipper-Benutzers (git, pip, Config, Sicherungen) als dieser Benutzer
as_user() { if [ "$(id -u)" = 0 ] && [ -n "$KUSER" ] && [ "$KUSER" != root ]; then sudo -u "$KUSER" -H "$@"; else "$@"; fi; }
urun() { run as_user "$@"; }

# ---------------------------------------------------------------- Dialoge
# Dialogfenster mit whiptail, sonst einfache Textfragen.
W_H=20; W_W=74

ui_msg() {   # Titel Text
    if [ "$UI" = whiptail ]; then whiptail --title "$1" --msgbox "$2" $W_H $W_W
    else echo; echo "${B}$1${N}"; printf '%b\n' "$2"; [ "$YES" = 1 ] || { printf "Weiter mit Enter … "; read -r _; }; fi
}

ui_yesno() { # Titel Text [nein] -> 0 = ja
    if [ "$YES" = 1 ]; then [ "${3:-}" = nein ] && return 1 || return 0; fi
    if [ "$UI" = whiptail ]; then
        if [ "${3:-}" = nein ]; then whiptail --title "$1" --defaultno --yes-button "Ja" --no-button "Nein" --yesno "$2" $W_H $W_W
        else whiptail --title "$1" --yes-button "Ja" --no-button "Nein" --yesno "$2" $W_H $W_W; fi
        return $?
    fi
    local d="J/n"; [ "${3:-}" = nein ] && d="j/N"
    echo; echo "${B}$1${N}"; printf '%b\n' "$2"; printf "[%s] " "$d"; read -r a
    case "${a:-x}" in j|J|ja|Ja|y|Y) return 0 ;; n|N|nein|Nein) return 1 ;; esac
    [ "${3:-}" = nein ] && return 1 || return 0
}

ui_menu() {  # Titel Text Vorgabe tag text tag text …  -> Auswahl auf stdout
    local t="$1" x="$2" def="$3"; shift 3
    if [ "$YES" = 1 ]; then echo "$def"; return 0; fi
    if [ "$UI" = whiptail ]; then
        whiptail --title "$t" --notags --default-item "$def" --ok-button "Weiter" --cancel-button "Abbrechen" \
            --menu "$x" $W_H $W_W 8 "$@" 3>&1 1>&2 2>&3 || { echo "__abbruch__"; return 1; }
        return 0
    fi
    local tags=() i=1 a
    { echo; echo "${B}$t${N}"; printf '%b\n' "$x"; } >&2
    while [ $# -gt 0 ]; do
        tags+=("$1"); local m=" "; [ "$1" = "$def" ] && m="*"
        printf "  %s%d) %s\n" "$m" "$i" "$2" >&2; shift 2; i=$((i+1))
    done
    printf "Nummer [Enter = *]: " >&2; read -r a
    if [ -z "$a" ]; then echo "$def"
    elif [[ "$a" =~ ^[0-9]+$ ]] && [ "$a" -ge 1 ] && [ "$a" -le ${#tags[@]} ]; then echo "${tags[$((a-1))]}"
    else echo "$def"; fi
}

ui_check() { # Titel Text tag text on|off …  -> ausgewaehlte Tags, durch Leerzeichen getrennt
    local t="$1" x="$2"; shift 2
    if [ "$YES" = 1 ]; then
        local out=""; while [ $# -gt 0 ]; do [ "$3" = on ] && out="$out $1"; shift 3; done; echo "$out"; return 0
    fi
    if [ "$UI" = whiptail ]; then
        whiptail --title "$t" --separate-output --ok-button "Weiter" --cancel-button "Abbrechen" \
            --checklist "$x\n\nLeertaste = an/aus, Enter = weiter" $W_H $W_W 8 "$@" 3>&1 1>&2 2>&3 | tr '\n' ' ' \
            || { echo "__abbruch__"; return 1; }
        return 0
    fi
    local out="" a
    { echo; echo "${B}$t${N}"; printf '%b\n' "$x"; } >&2
    while [ $# -gt 0 ]; do
        local d="j/N"; [ "$3" = on ] && d="J/n"
        printf "  %-16s %s [%s] " "$1" "$2" "$d" >&2; read -r a
        case "${a:-x}" in j|J|y|Y) out="$out $1" ;; n|N) ;; *) [ "$3" = on ] && out="$out $1" ;; esac
        shift 3
    done
    echo "$out"
}

abort_if() { [ "$1" = "__abbruch__" ] && { say "Abgebrochen. Es wurde nichts weiter geändert."; exit 0; }; }

# ---------------------------------------------------------------- Hilfen
need_sudo() {
    [ "$PROBE" = 1 ] && return 0
    [ "$(id -u)" = 0 ] && return 0
    sudo -n true 2>/dev/null && return 0
    say "Für die Installation braucht der Installer Administratorrechte (sudo)."
    sudo -v || fail "Ohne sudo geht es nicht."
}

gh_latest() {  # Repo -> Tag der neuesten Version
    curl -fsSL --max-time 20 "https://api.github.com/repos/$1/releases/latest" 2>/dev/null \
        | python3 -c 'import json,sys; print(json.load(sys.stdin)["tag_name"])' 2>/dev/null
}

fetch() {      # URL Ziel
    curl -fsSL --retry 3 --max-time 300 -o "$2" "$1"
}

pkg_version() { dpkg-query -W -f='${Version}' "$1" 2>/dev/null || true; }
pkg_installed() { [ "$(dpkg-query -W -f='${Status}' "$1" 2>/dev/null)" = "install ok installed" ]; }

state_get() { [ -f "$STATE" ] && sed -n "s/^$1=//p" "$STATE" | tail -1; }
state_set() {
    [ "$PROBE" = 1 ] && { say "  [Probe] $STATE: $1=$2"; return; }
    sudo mkdir -p "$(dirname "$STATE")"
    { [ -f "$STATE" ] && grep -v "^$1=" "$STATE"; echo "$1=$2"; } > "$WORK/state"
    sudo install -m 644 "$WORK/state" "$STATE"
}

printer_busy() {  # 0 = gerade Druck oder Pause
    local s
    s=$(curl -fs --max-time 3 "http://127.0.0.1:7125/printer/objects/query?print_stats=state" 2>/dev/null \
        | python3 -c 'import json,sys; print(json.load(sys.stdin)["result"]["status"]["print_stats"]["state"])' 2>/dev/null)
    [ "$s" = printing ] || [ "$s" = paused ] && return 0
    # Repetier-Server (Marlin): laeuft bei einem Drucker ein Auftrag?
    curl -fs --max-time 3 http://127.0.0.1:3344/printer/list 2>/dev/null \
        | python3 -c 'import json,sys; d=json.load(sys.stdin); sys.exit(0 if any(p.get("job","none")!="none" for p in d.get("data",[])) else 1)' 2>/dev/null
}

# ---------------------------------------------------------------- Systempruefung
DEVICE=""; DEVICE_NAME=""; OS_NAME=""; ARCH=""
HAS_KLIPPER=0; HAS_MOONRAKER=0; HAS_MAINSAIL=0; KUSER=""; KHOME=""; FORK=0
FTDI_PORTS=(); STM_PORTS=(); HAS_SPI_LCD=0; HAS_ST7796=0; UPGRADABLE=0

detect() {
    OS_NAME=$( . /etc/os-release 2>/dev/null; echo "${PRETTY_NAME:-unbekannt}")
    ARCH=$(dpkg --print-architecture 2>/dev/null || uname -m)
    local model=""
    [ -r /proc/device-tree/model ] && model=$(tr -d '\0' < /proc/device-tree/model)
    if [[ "$model" == Raspberry* ]]; then DEVICE=pi; DEVICE_NAME="$model"
    elif [ -f /etc/armbian-release ] || [[ "$model" == *[Mm]akerbase* ]] || [[ "$model" == *SKIPR* ]] || [[ "$model" == *rk3328* ]]; then
        DEVICE=skipr; DEVICE_NAME="${model:-Armbian} (MKS SKIPR)"
    else DEVICE=other; DEVICE_NAME="${model:-$(uname -m)}"; fi

    systemctl cat klipper.service >/dev/null 2>&1 && HAS_KLIPPER=1
    systemctl cat moonraker.service >/dev/null 2>&1 && HAS_MOONRAKER=1
    [ -f /etc/nginx/sites-available/mainsail ] && HAS_MAINSAIL=1
    KUSER=$(systemctl show -p User --value klipper.service 2>/dev/null || true)
    [ -n "$KUSER" ] || KUSER=$(id -un)
    KHOME=$(getent passwd "$KUSER" | cut -d: -f6)
    [[ "$(as_user git -C "$KHOME/klipper" remote get-url origin 2>/dev/null)" == *Dennis02121978/klipper* ]] && FORK=1

    local p
    for p in /dev/serial/by-id/*; do
        [ -e "$p" ] || continue
        case "$p" in *FTDI*|*FT232*) FTDI_PORTS+=("$p") ;; *stm32*|*Klipper*) STM_PORTS+=("$p") ;; esac
    done
    ls /dev/fb1 >/dev/null 2>&1 && HAS_SPI_LCD=1
    grep -qs fb_st7796 /proc/modules /etc/modules-load.d/* 2>/dev/null && HAS_ST7796=1
    return 0
}

check_system() {
    head1 "Systemprüfung"
    detect
    CAPTURE=1
    info "Gerät:   $DEVICE_NAME"
    info "System:  $OS_NAME ($ARCH)"
    case "$ARCH" in arm64|armhf|amd64) ok "Architektur wird unterstützt" ;; *) warn "Architektur $ARCH ist nicht getestet" ;; esac

    if curl -fsI --max-time 10 https://github.com >/dev/null 2>&1; then ok "Internet erreichbar"
    else fail "Keine Verbindung zu github.com. Prüfe Netzwerk und Internet."; fi

    local free; free=$(df -Pm / | awk 'NR==2{print $4}')
    if [ "${free:-0}" -lt 500 ]; then warn "Nur ${free} MB frei auf der Speicherkarte"; else ok "Speicher frei: ${free} MB"; fi

    local missing=() c
    for c in curl python3 git wget; do command -v "$c" >/dev/null || missing+=("$c"); done
    command -v whiptail >/dev/null || missing+=("whiptail")
    if [ ${#missing[@]} -gt 0 ]; then
        warn "Es fehlen Programme: ${missing[*]}"
        if ui_yesno "Fehlende Programme" "Diese Programme fehlen und werden gebraucht:\n\n  ${missing[*]}\n\nJetzt installieren?"; then
            need_sudo; srun apt-get update -qq; srun apt-get install -y "${missing[@]}"
            [ -t 0 ] && [ -t 1 ] && command -v whiptail >/dev/null && [ "$TEXT" = 0 ] && UI=whiptail
        else fail "Ohne diese Programme geht es nicht weiter."; fi
    else ok "Benötigte Programme vorhanden"; fi

    say "Suche nach Systemupdates …"
    if [ "$PROBE" = 0 ]; then need_sudo; sudo apt-get update -qq >>"$LOG" 2>&1 || warn "apt-get update meldet einen Fehler (siehe $LOG)"; fi
    UPGRADABLE=$(apt-get -s upgrade 2>/dev/null | grep -c '^Inst ' || true)
    if [ "${UPGRADABLE:-0}" -gt 0 ]; then warn "$UPGRADABLE Systempakete können aktualisiert werden"
    else ok "System ist aktuell"; fi

    [ "$HAS_KLIPPER" = 1 ] && ok "Klipper gefunden (Benutzer $KUSER)" || info "- Klipper: nicht installiert"
    [ "$HAS_MOONRAKER" = 1 ] && ok "Moonraker gefunden" || info "- Moonraker: nicht installiert"
    [ "$HAS_MAINSAIL" = 1 ] && ok "Mainsail gefunden" || info "- Mainsail: nicht installiert"
    [ "$FORK" = 1 ] && ok "Klipper nutzt schon den RF-Fork (Dennis02121978/klipper)"
    [ ${#FTDI_PORTS[@]} -gt 0 ] && ok "Renkforce-Board (ATmega2560) am USB: ${#FTDI_PORTS[@]}"
    [ ${#STM_PORTS[@]} -gt 0 ] && ok "Klipper-Board (STM32) am USB: ${#STM_PORTS[@]}"
    local p v pk=""
    for p in $OUR_PACKAGES; do v=$(pkg_version "$p"); [ -n "$v" ] && pk+=" $p $v,"; done
    [ -n "$pk" ] && info "Installiert:${pk%,}"
    CAPTURE=0
    [ "$UI" = whiptail ] && ui_msg "Systemprüfung" "$(printf '%s\n' "${CHK[@]}")"

    if [ "${UPGRADABLE:-0}" -gt 0 ]; then
        if ui_yesno "Systemupdates" "$UPGRADABLE Pakete des Betriebssystems können aktualisiert werden.\n\nJetzt aktualisieren (apt upgrade)? Das kann einige Minuten dauern.\nWährend eines Drucks besser später machen." nein; then
            if printer_busy; then warn "Gerade läuft ein Druck, das Systemupdate wird übersprungen."
            else need_sudo; srun env DEBIAN_FRONTEND=noninteractive apt-get upgrade -y; fi
        fi
    fi
}

# ---------------------------------------------------------------- Auswahl
FW=""; BOARD=""; MODEL=""; EXTR=""; FIL=""; PKGS=""; CONFIG_CHOICE=""

choose() {
    local defb=atmega; [ "$DEVICE" = skipr ] && defb=skipr
    BOARD=$(ui_menu "Schritt 1 von 5: Board" "Welches Board steuert deinen Drucker?" "$defb" \
        atmega "Renkforce-Board mit ATmega2560 (original)" \
        skipr  "MKS SKIPR (Umbau, Klipper direkt auf dem Board)") ; abort_if "$BOARD"

    if [ "$BOARD" = skipr ]; then FW=klipper
    else
        FW=$(ui_menu "Schritt 2 von 5: Firmware" "Welche Firmware soll der Drucker bekommen?" klipper \
            klipper "Klipper (mit Mainsail, Raspberry Pi steuert den Drucker)" \
            marlin  "Marlin RFxxxx (Firmware auf dem Board, z. B. mit Repetier-Server)") ; abort_if "$FW"
    fi

    MODEL=$(ui_menu "Schritt 3 von 5: Drucker" "Welcher Drucker?" rf2000 \
        rf1000   "Renkforce RF1000" \
        rf2000   "Renkforce RF2000" \
        rf2000v2 "Renkforce RF2000 v2") ; abort_if "$MODEL"

    if [ "$BOARD" = skipr ]; then
        EXTR=$(ui_menu "Schritt 4 von 5: Extruder" "Welche Extruder hat dein Drucker?" 2in1 \
            2in1   "Zwei Extruder an einem 2in1-Hotend" \
            dual   "Zwei Extruder, zwei Düsen" \
            single "Ein Extruder") ; abort_if "$EXTR"
    else
        EXTR=$(ui_menu "Schritt 4 von 5: Extruder" "Welche Extruder hat dein Drucker?" dual \
            single "Single Extruder (eine Düse)" \
            dual   "Dual Extruder (zwei Düsen)") ; abort_if "$EXTR"
    fi
    local deff=285; [ "$MODEL" = rf2000v2 ] && deff=175
    FIL=$(ui_menu "Schritt 5 von 5: Filament" "Welcher Filamentdurchmesser?" "$deff" \
        175 "1,75 mm" \
        285 "2,85 mm (3 mm)") ; abort_if "$FIL"
}

choose_packages() {
    [ "$FW" = klipper ] || { PKGS=""; return; }
    local term=on; [ "$HAS_MAINSAIL" = 1 ] || term=off
    if [ "$BOARD" = atmega ]; then
        local logo=off multi=off; [ "$HAS_SPI_LCD" = 1 ] && [ "$DEVICE" = pi ] && logo=on
        PKGS=$(ui_check "Pakete" "Was soll installiert werden? (für Raspberry Pi mit Renkforce-Board)" \
            rf-update   "Firmware-Update per Knopfdruck in Mainsail" on \
            rf-terminal "System Terminal in Mainsail (wie SSH)" "$term" \
            rf-bootlogo "Logo beim Start auf dem Pi-Display" "$logo" \
            rf-multi    "Mehrere Drucker an einem Pi" "$multi") ; abort_if "$PKGS"
    else
        local fil=off logo=off; [ "$EXTR" = 2in1 ] && fil=on; [ "$HAS_ST7796" = 1 ] && logo=on
        PKGS=$(ui_check "Pakete" "Was soll installiert werden? (für MKS SKIPR)" \
            skipr-update   "Firmware-Update per Knopfdruck in Mainsail" on \
            rf-terminal    "System Terminal in Mainsail (wie SSH)" "$term" \
            skipr-filament "Filament-Anzeige für das 2in1-Hotend" "$fil" \
            skipr-bootlogo "Logo beim Start auf dem Display" "$logo") ; abort_if "$PKGS"
    fi
}

ready_config_name() {   # passende fertige Config aus dem Release
    [ "$BOARD" = atmega ] && [ "$EXTR" = dual ] || return 1
    case "$MODEL" in rf2000v2) echo RF2000v2_DualExtruder ;; rf2000) echo RF2000_DualExtruder_3mm ;; *) return 1 ;; esac
}

find_creator_zips() {
    find "$KHOME/printer_data/config" "$KHOME/printer_data/gcodes" "$KHOME" -maxdepth 1 -type f \
        \( -iname 'klipper-configs*.zip' -o -iname '*config*.zip' \) 2>/dev/null | sort -u | head -8
}

choose_config() {
    [ "$FW" = klipper ] || return
    local ready opts=() def=keep
    ready=$(ready_config_name) && { opts+=(ready "Fertige Config aus dem Release ($ready)"); def=ready; }
    opts+=(creator "ZIP aus dem Config Creator (vorher in Mainsail hochladen)")
    [ "$EXTR" = 2in1 ] && { opts+=(2in1 "2in1-Config (2in1_hotend.cfg) dazulegen"); def=2in1; }
    opts+=(keep "Config nicht ändern")
    # Vorhandene Config nicht als Vorgabe ueberschreiben
    [ -f "$KHOME/printer_data/config/printer.cfg" ] && def=keep
    CONFIG_CHOICE=$(ui_menu "Klipper-Config" "Woher soll die Klipper-Config kommen?\n\nEine eigene Config für dein Modell erzeugt der Config Creator:\n$CREATOR_URL\nDie ZIP lädst du in Mainsail unter Maschine in den Config-Ordner hoch." "$def" "${opts[@]}") ; abort_if "$CONFIG_CHOICE"
}

summary_text() {
    local b f m e c t
    case "$BOARD" in atmega) b="Renkforce-Board (ATmega2560)" ;; skipr) b="MKS SKIPR" ;; esac
    case "$FW" in klipper) f="Klipper" ;; marlin) f="Marlin RFxxxx" ;; esac
    case "$MODEL" in rf1000) m="RF1000" ;; rf2000) m="RF2000" ;; rf2000v2) m="RF2000 v2" ;; esac
    case "$EXTR" in single) e="Single" ;; dual) e="Dual (zwei Düsen)" ;; 2in1) e="2in1-Hotend" ;; esac
    case "$CONFIG_CHOICE" in ready) c="fertige Config $(ready_config_name)" ;; creator) c="ZIP aus dem Config Creator" ;;
        2in1) c="2in1_hotend.cfg dazulegen" ;; *) c="nicht ändern" ;; esac
    t="Drucker:   $m, $e, ${FIL:0:1},${FIL:1} mm\nBoard:     $b\nFirmware:  $f\n"
    [ "$FW" = klipper ] && t+="Pakete:   ${PKGS:- keine}\nConfig:    $c\n"
    [ "$FW" = klipper ] && [ "$BOARD" = atmega ] && [ "$FORK" = 0 ] && t+="Klipper:   auf den RF-Fork umstellen\n"
    [ "$FW" = marlin ] && t+="Marlin:    Marlin_$(marlin_asset_model)_$(marlin_variant).zip flashen\n"
    t+="Befehl:    3DArtmaker-upgrade wird angelegt\n"
    echo "$t"
}

# ---------------------------------------------------------------- Klipper
ensure_klipper_base() {
    if [ "$HAS_KLIPPER" = 1 ] && [ "$HAS_MOONRAKER" = 1 ] && [ "$HAS_MAINSAIL" = 1 ]; then return 0; fi
    local miss=""; [ "$HAS_KLIPPER" = 1 ] || miss+=" Klipper"; [ "$HAS_MOONRAKER" = 1 ] || miss+=" Moonraker"; [ "$HAS_MAINSAIL" = 1 ] || miss+=" Mainsail"
    if ui_yesno "Grundinstallation fehlt" "Es fehlen:$miss\n\nDiese installierst du am einfachsten mit KIAUH (Klipper Installation And Update Helper).\nSoll KIAUH jetzt heruntergeladen und gestartet werden?\n\nIn KIAUH: 1) Install → Klipper, Moonraker, Mainsail.\nDanach den 3D-Artmaker Installer noch einmal starten."; then
        [ "$RUSER" = root ] && fail "KIAUH darf nicht als root laufen. Starte den Installer als normaler Benutzer (z. B. pi)."
        local ru=(); [ "$(id -u)" = 0 ] && ru=(sudo -u "$RUSER" -H)
        [ -d "$RHOME/kiauh" ] || run "${ru[@]}" git clone https://github.com/dw-0/kiauh.git "$RHOME/kiauh"
        [ "$PROBE" = 1 ] || "${ru[@]}" "$RHOME/kiauh/kiauh.sh"
        say "Starte danach den Installer erneut: bash $0"
        exit 0
    fi
    fail "Ohne Klipper, Moonraker und Mainsail kann die Klipper-Variante nicht eingerichtet werden."
}

switch_fork() {
    [ "$BOARD" = atmega ] && [ "$FORK" = 0 ] || return 0
    head1 "Klipper auf den RF-Fork umstellen"
    local k="$KHOME/klipper"
    if [ -n "$(as_user git -C "$k" status --porcelain 2>/dev/null)" ]; then
        warn "Im Klipper-Ordner gibt es eigene Änderungen:"; as_user git -C "$k" status --short | head -10
        ui_yesno "Klipper-Ordner" "Im Ordner $k gibt es eigene Änderungen.\nSie bleiben in der Sicherung erhalten, gehen im neuen Stand aber verloren.\n\nTrotzdem umstellen?" nein || { warn "Klipper bleibt unverändert."; return 0; }
    fi
    ui_yesno "Klipper umstellen" "Der RF1000/RF2000 braucht das Klipper aus\n$KLIPPER_FORK\n(RF-Module für DMS, Display, Z-Tasten …).\n\nVorher wird $k nach $k-backup-$STAMP gesichert.\nJetzt umstellen?" || return 0
    urun cp -a "$k" "$k-backup-$STAMP" || fail "Sicherung von $k fehlgeschlagen"
    urun git -C "$k" remote set-url origin "$KLIPPER_FORK"
    urun git -C "$k" fetch origin --tags || fail "git fetch fehlgeschlagen"
    urun git -C "$k" checkout -B master origin/master || fail "Umstellen fehlgeschlagen. Sicherung: $k-backup-$STAMP"
    urun "$KHOME/klippy-env/bin/pip" install -q -r "$k/scripts/klippy-requirements.txt" || warn "Python-Pakete für Klipper prüfen"
    FORK=1; ok "Klipper nutzt jetzt den RF-Fork. Die Firmware schreibst du danach in Mainsail mit Firmware-Update."
}

LATEST_TAG=""
release_download() {   # Dateien … -> in $WORK, geprueft gegen SHA256SUMS
    [ -n "$LATEST_TAG" ] || LATEST_TAG=$(gh_latest "$REPO")
    [ -n "$LATEST_TAG" ] || fail "Neueste Version von $REPO nicht gefunden"
    local base="https://github.com/$REPO/releases/download/$LATEST_TAG" f
    fetch "$base/SHA256SUMS" "$WORK/SHA256SUMS" || fail "SHA256SUMS nicht geladen"
    for f in "$@"; do
        fetch "$base/$f" "$WORK/$f" || fail "$f nicht geladen"
        (cd "$WORK" && grep " $f\$" SHA256SUMS | sha256sum -c --quiet) || fail "Prüfsumme von $f stimmt nicht"
        ok "$f geladen und geprüft"
    done
}

install_packages() {   # Paketnamen …
    [ $# -gt 0 ] || return 0
    head1 "Pakete installieren"
    [ -n "$LATEST_TAG" ] || LATEST_TAG=$(gh_latest "$REPO")
    local v=${LATEST_TAG#v} files=() p
    for p in "$@"; do files+=("${p}_${v}_all.deb"); done
    release_download "${files[@]}"
    if printer_busy; then fail "Gerade läuft ein Druck. Bitte nach dem Druck installieren."; fi
    need_sudo
    local debs=(); for p in "${files[@]}"; do debs+=("$WORK/$p"); done
    srun env DEBIAN_FRONTEND=noninteractive apt-get install -y --allow-downgrades "${debs[@]}" || fail "Installation fehlgeschlagen (siehe $LOG)"
    ok "Installiert: $*"
}

backup_config() {
    local c="$KHOME/printer_data/config"
    urun mkdir -p "$KHOME/3dartmaker-backup"
    urun tar czf "$KHOME/3dartmaker-backup/config-$STAMP.tar.gz" -C "$KHOME/printer_data" config
    ok "Config gesichert: ~/3dartmaker-backup/config-$STAMP.tar.gz"
}

unpack_into_config() {   # ZIP [Unterordner]
    local zip="$1" sub="${2:-}" c="$KHOME/printer_data/config"
    rm -rf "$WORK/cfg"; mkdir -p "$WORK/cfg"
    python3 -m zipfile -e "$zip" "$WORK/cfg/" || fail "ZIP lässt sich nicht entpacken"
    local src="$WORK/cfg"
    if [ -z "$sub" ]; then
        local dirs=("$WORK"/cfg/*/); [ -f "$WORK/cfg/printer.cfg" ] || { [ ${#dirs[@]} -eq 1 ] && [ -d "${dirs[0]}" ] && src="${dirs[0]%/}"; }
        if [ ! -f "$src/printer.cfg" ] && [ ${#dirs[@]} -gt 1 ]; then
            local opts=() d; for d in "${dirs[@]}"; do d=${d%/}; opts+=("${d##*/}" "${d##*/}"); done
            sub=$(ui_menu "Drucker wählen" "Die ZIP enthält mehrere Drucker. Welcher gehört zu diesem Mainsail?" "${opts[0]}" "${opts[@]}"); abort_if "$sub"
            src="$WORK/cfg/$sub"
        fi
    else src="$WORK/cfg/$sub"; fi
    [ -f "$src/printer.cfg" ] || fail "In der ZIP fehlt printer.cfg"
    say "Dateien: $(cd "$src" && ls | tr '\n' ' ')"
    chmod -R a+rX "$WORK"
    urun cp -f "$src"/*.cfg "$c/"
    [ -f "$src/LIESMICH.txt" ] && urun cp -f "$src/LIESMICH.txt" "$c/"
    fix_mcu_serial "$c/printer.cfg"
}

fix_mcu_serial() {   # printer.cfg: [mcu] serial auf das angeschlossene Board setzen
    local f="$1" cur port=""
    [ "$PROBE" = 1 ] && [ ! -f "$f" ] && return 0
    cur=$(awk '/^\[mcu\]/{m=1;next} /^\[/{m=0} m&&/^serial:/{print $2; exit}' "$f" 2>/dev/null)
    if [ "$BOARD" = atmega ] && [ ${#FTDI_PORTS[@]} -eq 1 ]; then port=${FTDI_PORTS[0]}
    elif [ "$BOARD" = skipr ] && [ ${#STM_PORTS[@]} -eq 1 ]; then port=${STM_PORTS[0]}; fi
    [ -n "$port" ] && [ "$cur" != "$port" ] || return 0
    if ui_yesno "Board-Anschluss" "In printer.cfg steht unter [mcu]:\n  serial: ${cur:-(leer)}\n\nAngeschlossen ist:\n  $port\n\nAnschluss in printer.cfg eintragen?"; then
        if [ "$PROBE" = 1 ]; then say "  [Probe] serial: $port in printer.cfg"; return; fi
        python3 - "$f" "$port" <<'PY'
import re,sys
f,port=sys.argv[1],sys.argv[2]; s=open(f).read()
m=re.search(r'(?ms)^\[mcu\]\s*\n(.*?)(?=^\[|\Z)',s)
body=m.group(1)
nb=re.sub(r'(?m)^serial:.*$','serial: '+port,body,1) if re.search(r'(?m)^serial:',body) else 'serial: '+port+'\n'+body
open(f,'w').write(s[:m.start(1)]+nb+s[m.end(1):])
PY
        ok "serial: $port eingetragen"
    fi
}

apply_config() {
    [ "$FW" = klipper ] || return 0
    case "$CONFIG_CHOICE" in
        keep|"") return 0 ;;
        ready)
            head1 "Fertige Config einspielen"
            local n; n=$(ready_config_name)
            release_download "$n.zip"
            backup_config
            unpack_into_config "$WORK/$n.zip" ;;
        creator)
            head1 "Config aus dem Config Creator einspielen"
            local zips=() z opts=()
            while IFS= read -r z; do [ -n "$z" ] && zips+=("$z"); done < <(find_creator_zips)
            if [ ${#zips[@]} -eq 0 ]; then
                ui_msg "Keine ZIP gefunden" "Keine ZIP aus dem Config Creator gefunden.\n\n1. Öffne $CREATOR_URL\n2. Stelle deinen Drucker ein und klicke auf „Alle als ZIP“.\n3. Lade die ZIP in Mainsail unter Maschine hoch.\n4. Starte den Installer noch einmal."
                return 0
            fi
            for z in "${zips[@]}"; do opts+=("$z" "${z#$KHOME/}  ($(date -r "$z" '+%d.%m.%Y %H:%M'))"); done
            z=$(ui_menu "ZIP wählen" "Welche ZIP soll eingespielt werden?" "${zips[0]}" "${opts[@]}"); abort_if "$z"
            backup_config
            unpack_into_config "$z" ;;
        2in1)
            head1 "2in1-Config dazulegen"
            local c="$KHOME/printer_data/config" url="https://raw.githubusercontent.com/$REPO/main/config/2in1_hotend.cfg"
            backup_config
            fetch "$url" "$WORK/2in1_hotend.cfg" || fail "2in1_hotend.cfg nicht geladen"
            chmod a+rX "$WORK" "$WORK/2in1_hotend.cfg"
            urun cp -f "$WORK/2in1_hotend.cfg" "$c/2in1_hotend.cfg"
            if ! grep -qs '^\[include 2in1_hotend.cfg\]' "$c/printer.cfg"; then
                if ui_yesno "printer.cfg" "Soll die Zeile\n  [include 2in1_hotend.cfg]\nin printer.cfg eingetragen werden?\n\nVorher die Pins und Strecken in 2in1_hotend.cfg prüfen (siehe INSTALLATION.md)." nein; then
                    urun sed -i '0,/^\[/s//[include 2in1_hotend.cfg]\n[/' "$c/printer.cfg"
                fi
            fi
            warn "Prüfe in 2in1_hotend.cfg die Pins der Filamentschalter und die Strecken (prime_dist, park_dist)." ;;
    esac
    CONFIG_CHANGED=1
}
CONFIG_CHANGED=0

restart_klipper() {
    [ "$CONFIG_CHANGED" = 1 ] || return 0
    if printer_busy; then warn "Gerade läuft ein Druck. Klipper bitte nach dem Druck neu starten."; return; fi
    run sudo systemctl restart klipper && ok "Klipper neu gestartet"
}

# ---------------------------------------------------------------- Marlin
marlin_asset_model() { case "$MODEL" in rf1000) echo RF1000 ;; rf2000) echo RF2000 ;; rf2000v2) echo RF2000v2 ;; esac; }
marlin_variant() { [ "$EXTR" = dual ] && echo Dual || echo Single; }

pick_ftdi_port() {
    if [ ${#FTDI_PORTS[@]} -eq 1 ]; then echo "${FTDI_PORTS[0]}"; return; fi
    if [ ${#FTDI_PORTS[@]} -eq 0 ]; then
        local u; u=$(ls /dev/ttyUSB* 2>/dev/null | head -1)
        [ -n "$u" ] && { echo "$u"; return; }
        echo ""; return
    fi
    local opts=() p; for p in "${FTDI_PORTS[@]}"; do opts+=("$p" "${p##*/}"); done
    p=$(ui_menu "Anschluss" "Mehrere Renkforce-Boards gefunden. Welches soll Marlin bekommen?" "${FTDI_PORTS[0]}" "${opts[@]}"); abort_if "$p"; echo "$p"
}

install_marlin() {
    head1 "Marlin flashen"
    command -v avrdude >/dev/null || {
        ui_yesno "avrdude fehlt" "Zum Flashen wird avrdude gebraucht.\nJetzt installieren?" || fail "Ohne avrdude kein Flashen."
        need_sudo; srun apt-get install -y avrdude; }
    local tag asset port hex
    tag=$(gh_latest "$MARLIN_REPO"); [ -n "$tag" ] || fail "Neueste Marlin-Version nicht gefunden"
    asset="Marlin_$(marlin_asset_model)_$(marlin_variant).zip"
    say "Marlin $tag: $asset"
    fetch "https://github.com/$MARLIN_REPO/releases/download/$tag/$asset" "$WORK/$asset" || fail "$asset nicht geladen"
    if fetch "https://github.com/$MARLIN_REPO/releases/download/$tag/SHA256SUMS" "$WORK/MSUMS" 2>/dev/null; then
        (cd "$WORK" && grep " $asset\$" MSUMS | sha256sum -c --quiet) || fail "Prüfsumme von $asset stimmt nicht"
        ok "$asset geladen und geprüft"
    else warn "$asset geladen (keine Prüfsummen im Release)"; fi
    mkdir -p "$WORK/marlin"; python3 -m zipfile -e "$WORK/$asset" "$WORK/marlin/" || fail "ZIP defekt"
    hex=$(find "$WORK/marlin" -name '*.hex' | head -1); [ -n "$hex" ] || fail "Keine .hex in $asset"

    port=$(pick_ftdi_port); [ -n "$port" ] || fail "Kein Renkforce-Board gefunden. Ist der Drucker eingeschaltet und per USB verbunden?"
    say "Anschluss: $port"

    if printer_busy; then fail "Der Drucker druckt gerade. Bitte erst nach dem Druck flashen."; fi
    local stopped=() s
    for s in klipper RepetierServer octoprint; do
        systemctl is-active --quiet "$s" 2>/dev/null && stopped+=("$s")
    done
    ui_yesno "Marlin flashen" "Firmware:  ${hex##*/} ($tag)\nModell:    $(marlin_asset_model) $(marlin_variant)\nAnschluss: $port\n\nVorher wird das EEPROM gesichert.\n${stopped:+Gestoppt werden kurz: ${stopped[*]}\n}\nDer Drucker darf dabei nicht drucken und nicht ausgeschaltet werden.\nJetzt flashen?" || { say "Nicht geflasht."; return 0; }
    need_sudo
    for s in "${stopped[@]}"; do srun systemctl stop "$s"; done
    urun mkdir -p "$KHOME/3dartmaker-backup"
    if run avrdude -patmega2560 -cwiring -P"$port" -b115200 -Ueeprom:r:"$KHOME/3dartmaker-backup/eeprom-$STAMP.hex":i -q -q; then
        ok "EEPROM gesichert: ~/3dartmaker-backup/eeprom-$STAMP.hex"
    else warn "EEPROM konnte nicht gesichert werden"; ui_yesno "Weiter?" "Das EEPROM wurde nicht gesichert. Trotzdem flashen?" nein || { for s in "${stopped[@]}"; do srun systemctl start "$s"; done; return 1; }; fi
    if run avrdude -patmega2560 -cwiring -P"$port" -b115200 -D -Uflash:w:"$hex":i; then
        ok "Marlin $tag geschrieben"
        state_set marlin_model "$(marlin_asset_model)_$(marlin_variant)"; state_set marlin_version "$tag"; state_set marlin_port "$port"
    else
        warn "Flashen fehlgeschlagen. Drucker aus- und einschalten und noch einmal versuchen."
    fi
    if printf '%s\n' "${stopped[@]}" | grep -qx klipper; then
        if ui_yesno "Klipper" "Klipper war aktiv. Mit Marlin braucht der Drucker Klipper nicht mehr.\nKlipper dauerhaft ausschalten (sonst stört es den Anschluss)?"; then
            srun systemctl disable klipper
            stopped=("${stopped[@]/klipper}")
        fi
    fi
    for s in "${stopped[@]}"; do [ -n "$s" ] && srun systemctl start "$s"; done
    ui_msg "Marlin ist drauf" "Nächste Schritte:\n\n• Verbindung zum Host (Repetier-Server, OctoPrint) mit 250000 Baud.\n• Nach dem ersten Start einmal M502 und M500 senden.\n• Heizbett-Scan M3010 mit Aufsicht, dann M3001.\n\nDetails: github.com/$MARLIN_REPO"
}

# ---------------------------------------------------------------- Befehle anlegen
install_commands() {
    head1 "Befehl 3DArtmaker-upgrade anlegen"
    local self; self=$(readlink -f "$0")
    need_sudo
    run sudo install -D -m 755 "$self" "$LIBDIR/3dartmaker.sh"
    run sudo ln -sf "$LIBDIR/3dartmaker.sh" /usr/local/bin/3DArtmaker-upgrade
    run sudo ln -sf "$LIBDIR/3dartmaker.sh" /usr/local/bin/3DArtmaker-install
    run sudo ln -sf "$LIBDIR/3dartmaker.sh" /usr/local/bin/3dartmaker-upgrade
    state_set firmware "$FW"; state_set board "$BOARD"; state_set model "$MODEL"; state_set extruder "$EXTR"; state_set filament "$FIL"
    ok "Befehle: 3DArtmaker-upgrade und 3DArtmaker-install"
}

# ---------------------------------------------------------------- Upgrade
self_update() {
    [ "$VERSION" = dev ] && return 0
    local tag; tag=$(gh_latest "$REPO") || return 0
    [ -n "$tag" ] || return 0
    dpkg --compare-versions "${tag#v}" gt "$VERSION" || return 0
    say "Neue Installer-Version ${tag#v} (installiert $VERSION) wird geladen …"
    LATEST_TAG=$tag; release_download 3dartmaker-install.sh
    if [ "$PROBE" = 1 ]; then say "  [Probe] Installer würde ersetzt"; return 0; fi
    sudo install -D -m 755 "$WORK/3dartmaker-install.sh" "$LIBDIR/3dartmaker.sh"
    ok "Installer aktualisiert, starte neu …"
    exec "$LIBDIR/3dartmaker.sh" upgrade "${ARGS[@]}"
}

do_upgrade() {
    echo "${B}3D-Artmaker Upgrade${N} (Installer $VERSION)"
    detect
    curl -fsI --max-time 10 https://github.com >/dev/null 2>&1 || fail "Keine Verbindung zu github.com"
    self_update
    LATEST_TAG=$(gh_latest "$REPO"); [ -n "$LATEST_TAG" ] || fail "Neueste Version nicht gefunden"
    local v=${LATEST_TAG#v} p cur todo=()
    head1 "3D-Artmaker-Pakete (neueste Version $v)"
    for p in $OUR_PACKAGES; do
        pkg_installed "$p" || continue
        cur=$(pkg_version "$p")
        if dpkg --compare-versions "$v" gt "$cur"; then say "  $p: $cur → ${Y}$v${N}"; todo+=("$p")
        else say "  $p: $cur ${G}aktuell${N}"; fi
    done
    if [ ${#todo[@]} -gt 0 ]; then
        if ui_yesno "Updates" "${#todo[@]} Paket(e) auf $v aktualisieren?\n\n  ${todo[*]}"; then install_packages "${todo[@]}"; fi
    else ok "Alle 3D-Artmaker-Pakete sind aktuell"; fi

    if [ -d "$KHOME/klipper/.git" ] && [ "$FORK" = 1 ]; then
        head1 "Klipper (RF-Fork)"
        as_user git -C "$KHOME/klipper" fetch -q origin 2>/dev/null || warn "git fetch für Klipper fehlgeschlagen"
        local behind; behind=$(as_user git -C "$KHOME/klipper" rev-list --count HEAD..origin/master 2>/dev/null || echo 0)
        if [ "${behind:-0}" -gt 0 ]; then
            warn "Klipper: $behind neue Änderung(en). Aktualisiere Klipper und Firmware zusammen in Mainsail: Firmware-Update → Update starten."
        else ok "Klipper ist aktuell"; fi
    fi

    local mm; mm=$(state_get marlin_model)
    if [ -n "$mm" ]; then
        head1 "Marlin"
        local mt cur_m; mt=$(gh_latest "$MARLIN_REPO"); cur_m=$(state_get marlin_version)
        if [ -n "$mt" ] && [ "$mt" != "$cur_m" ] && dpkg --compare-versions "${mt#v}" gt "${cur_m#v}"; then
            warn "Marlin $mt verfügbar (geflasht: $cur_m)"
            if ui_yesno "Marlin" "Marlin $mt ist verfügbar (geflasht: $cur_m).\nJetzt flashen?" nein; then
                MODEL=$(state_get model); EXTR=$(state_get extruder); install_marlin
            fi
        else ok "Marlin $cur_m ist aktuell"; fi
    fi

    head1 "Betriebssystem"
    [ "$PROBE" = 1 ] || { need_sudo; sudo apt-get update -qq >>"$LOG" 2>&1; }
    UPGRADABLE=$(apt-get -s upgrade 2>/dev/null | grep -c '^Inst ' || true)
    if [ "${UPGRADABLE:-0}" -gt 0 ]; then
        warn "$UPGRADABLE Systempakete können aktualisiert werden"
        if ui_yesno "Systemupdates" "$UPGRADABLE Pakete des Betriebssystems aktualisieren (apt upgrade)?" nein; then
            if printer_busy; then warn "Gerade läuft ein Druck, übersprungen."; else need_sudo; srun env DEBIAN_FRONTEND=noninteractive apt-get upgrade -y; fi
        fi
    else ok "System ist aktuell"; fi
    echo; ok "Fertig. Protokoll: $LOG"
}

# ---------------------------------------------------------------- Ablauf
do_install() {
    [ "$(id -u)" = 0 ] && [ -z "${SUDO_USER:-}" ] && warn "Starte den Installer am besten als normaler Benutzer (pi oder mks), nicht als root."
    ui_msg "$TITLE" "Willkommen beim 3D-Artmaker Installer (Version $VERSION).\n\nEr prüft dein System, fragt wie im Renkforce Config Creator nach deinem Drucker und installiert dann, was du auswählst:\n\n• Klipper: RF-Fork, Firmware-Update, System Terminal, Logo, Configs\n• Marlin: fertige Firmware für dein Modell flashen\n\nVor jeder Änderung wird nachgefragt.$( [ "$PROBE" = 1 ] && echo '\n\nPROBELAUF: Es wird nichts verändert.')"
    check_system
    choose
    if [ "$FW" = klipper ]; then
        ensure_klipper_base
        choose_packages
        choose_config
    fi
    ui_yesno "Zusammenfassung" "$(summary_text)\nSo installieren?" || { say "Abgebrochen."; exit 0; }
    need_sudo
    if [ "$FW" = klipper ]; then
        switch_fork
        # shellcheck disable=SC2086
        install_packages $PKGS
        apply_config
        restart_klipper
    else
        install_marlin
    fi
    install_commands
    local next="Fertig!\n\n"
    if [ "$FW" = klipper ]; then
        next+="• Lade Mainsail im Browser mit F5 neu.\n"
        [ "$BOARD" = atmega ] && next+="• Mainsail → Firmware-Update → Update starten (schreibt Klipper aufs Board).\n"
        [ "$BOARD" = skipr ] && [[ " $PKGS " == *" skipr-update "* ]] && next+="• Mainsail → Firmware-Update → Update starten.\n"
        [[ " $PKGS " == *" rf-terminal "* ]] && next+="• Neu: Menüpunkt System Terminal.\n"
        next+="• Slicer-Einstellungen: Config Creator, Seite Anleitung.\n"
    fi
    next+="\nSpäter alles aktualisieren mit:\n   3DArtmaker-upgrade\n\nProtokoll: $LOG"
    ui_msg "Fertig" "$next"
    echo; ok "Fertig. Später aktualisieren mit: 3DArtmaker-upgrade"
}

if [ "$MODE" = upgrade ]; then do_upgrade; else do_install; fi
