#!/bin/bash
# 3D-Artmaker Installer fuer Renkforce RF1000 / RF2000 / RF2000 v2
# Klipper auf Raspberry Pi oder MKS SKIPR.
#
#   bash 3dartmaker-install.sh            Fragen wie im Config Creator, Config erzeugen und installieren
#   3DArtmaker-upgrade                    alle 3D-Artmaker-Pakete auf den neuesten Stand
#   Optionen: --probe (nur zeigen, nichts aendern), --text (ohne Dialogfenster), --ja (alle Fragen mit Ja)
#
# Repo: https://github.com/Dennis02121978/3D-Artmaker
set -uo pipefail

VERSION="dev"
REPO="Dennis02121978/3D-Artmaker"
KLIPPER_FORK="https://github.com/Dennis02121978/klipper.git"
CREATOR_URL="https://3d-artmaker.de/config-creator.php"
LIBDIR="/usr/local/lib/3dartmaker"
STATE="/etc/3dartmaker/installer.conf"
STATE_DIR="/etc/3dartmaker"
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
# apt als eigener systemd-Auftrag: Bricht die Sitzung ab (SSH, System Terminal in Mainsail),
# laeuft die Installation trotzdem sauber zu Ende. Die Ausgabe geht in eine Datei (kein Abbruch
# durch eine geschlossene Sitzung) und wird hier live mitgelesen.
sapt() {
    if [ "$PROBE" = 1 ]; then say "  [Probe] sudo $*"; return 0; fi
    if ! command -v systemd-run >/dev/null || [ ! -d /run/systemd/system ]; then
        srun env DEBIAN_FRONTEND=noninteractive "$@"; return
    fi
    local u="3dartmaker-apt-$STAMP-$RANDOM" out rc pos=0 st
    out=$(sudo mktemp /var/log/3dartmaker-apt.XXXXXX) || { srun env DEBIAN_FRONTEND=noninteractive "$@"; return; }
    sudo chmod 644 "$out"
    echo "$(date '+%F %T') \$ $* (systemd: $u)" >> "$LOG"
    sudo systemd-run --quiet --collect --unit="$u" --setenv=DEBIAN_FRONTEND=noninteractive /bin/sh -c \
        'o="$1"; shift; "$@" >>"$o" 2>&1; echo $? >"$o.rc"' sh "$out" "$@" || { sudo rm -f "$out"; return 1; }
    while :; do
        st=0; [ -e "$out.rc" ] && st=1
        tail -c +$((pos + 1)) "$out" | tee -a "$LOG"; pos=$(stat -c %s "$out")
        [ "$st" = 1 ] && break
        systemctl is-active --quiet "$u" || [ -e "$out.rc" ] || { sleep 1; [ -e "$out.rc" ] || break; }
        sleep 1
    done
    rc=$(cat "$out.rc" 2>/dev/null || echo 1)
    sudo rm -f "$out" "$out.rc"
    return "$rc"
}
# Laeuft der Installer im System Terminal von Mainsail (ttyd)?
in_web_terminal() {
    local p=$$ c
    while [ "${p:-1}" -gt 1 ]; do
        c=$(ps -o comm= -p "$p" 2>/dev/null); [ "$c" = ttyd ] && return 0
        p=$(ps -o ppid= -p "$p" 2>/dev/null | tr -d ' ')
    done
    return 1
}
# Arbeiten an Dateien des Klipper-Benutzers (git, pip, Config, Sicherungen) als dieser Benutzer
as_user() { if [ "$(id -u)" = 0 ] && [ -n "$KUSER" ] && [ "$KUSER" != root ]; then sudo -u "$KUSER" -H "$@"; else "$@"; fi; }
urun() { run as_user "$@"; }

# ---------------------------------------------------------------- Dialoge
# Dialogfenster mit whiptail, sonst einfache Textfragen.
W_H=22; W_W=76

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
        local lh=$(( $# / 2 )); [ "$lh" -gt 10 ] && lh=10
        whiptail --title "$t" --notags --default-item "$def" --ok-button "Weiter" --cancel-button "Abbrechen" \
            --menu "$x" $W_H $W_W "$lh" "$@" 3>&1 1>&2 2>&3 || { echo "__abbruch__"; return 1; }
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

ui_input() {  # Titel Text Vorgabe -> Eingabe auf stdout (Abbrechen = Vorgabe, Rueckgabe 1)
    if [ "$YES" = 1 ]; then echo "$3"; return 0; fi
    if [ "$UI" = whiptail ]; then
        whiptail --title "$1" --ok-button "OK" --cancel-button "Zurück" --inputbox "$2" $W_H $W_W "$3" 3>&1 1>&2 2>&3 \
            || { echo "$3"; return 1; }
        return 0
    fi
    local a
    { echo; echo "${B}$1${N}"; printf '%b\n' "$2"; printf "[%s] " "$3"; } >&2
    read -r a; echo "${a:-$3}"
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
    s=$(curl -fs --max-time 3 "http://127.0.0.1:${1:-7125}/printer/objects/query?print_stats=state" 2>/dev/null \
        | python3 -c 'import json,sys; print(json.load(sys.stdin)["result"]["status"]["print_stats"]["state"])' 2>/dev/null)
    [ "$s" = printing ] || [ "$s" = paused ]
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
            else need_sudo; sapt apt-get upgrade -y; fi
        fi
    fi
}

# ---------------------------------------------------------------- Auswahl
FW="klipper"; BOARD=""; MODEL=""; EXTR=""; FIL=""; PKGS=""; CONFIG_CHOICE=""
TARGET_DIR="printer_data"; SERVICE="klipper"; PCOUNT=1; PNUM=1; PNAME=""

choose() {
    local defb=atmega; [ "$DEVICE" = skipr ] && defb=skipr
    BOARD=$(ui_menu "Schritt 1 von 4: Board" "Welches Board steuert deinen Drucker?" "$defb" \
        atmega "Renkforce-Board mit ATmega2560 (original)" \
        skipr  "MKS SKIPR (Umbau, Klipper direkt auf dem Board)") ; abort_if "$BOARD"

    MODEL=$(ui_menu "Schritt 2 von 4: Drucker" "Welcher Drucker?" rf2000 \
        rf1000   "Renkforce RF1000" \
        rf2000   "Renkforce RF2000" \
        rf2000v2 "Renkforce RF2000 v2") ; abort_if "$MODEL"

    if [ "$BOARD" = skipr ]; then
        EXTR=$(ui_menu "Schritt 3 von 4: Extruder" "Welche Extruder hat dein Drucker?" 2in1 \
            2in1   "2in1-Hotend (zwei Extruder, eine Düse)" \
            single "Single Extruder (eine Düse)") ; abort_if "$EXTR"
    else
        EXTR=$(ui_menu "Schritt 3 von 4: Extruder" "Welche Extruder hat dein Drucker?" dual \
            single "Single Extruder (eine Düse)" \
            dual   "Dual Extruder (zwei Düsen)") ; abort_if "$EXTR"
    fi
    local deff=2.85; [ "$MODEL" = rf2000v2 ] && deff=1.75
    FIL=$(ui_menu "Schritt 4 von 4: Filament" "Welcher Filamentdurchmesser?" "$deff" \
        1.75 "1,75 mm" \
        2.85 "2,85 mm" \
        3.00 "3,00 mm") ; abort_if "$FIL"
}

choose_packages() {
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

find_creator_zips() {
    find "$KHOME/$TARGET_DIR/config" "$KHOME/$TARGET_DIR/gcodes" "$KHOME" -maxdepth 1 -type f \
        \( -iname 'klipper-configs*.zip' -o -iname '*config*.zip' \) 2>/dev/null | sort -u | head -8
}

choose_config() {
    choose_target
    local def=gen
    [ -f "$KHOME/$TARGET_DIR/config/printer.cfg" ] && def=keep
    CONFIG_CHOICE=$(ui_menu "Klipper-Config" "Woher soll die Klipper-Config kommen?\n\nDer Installer kann sie wie der Config Creator erzeugen. Er stellt dazu dieselben Fragen und sichert vorher den ganzen Config-Ordner.\n($CREATOR_URL)" "$def" \
        gen     "Config erzeugen (Fragen wie im Config Creator)" \
        creator "ZIP aus dem Config Creator (vorher in Mainsail hochladen)" \
        keep    "Config nicht ändern") ; abort_if "$CONFIG_CHOICE"
    [ "$CONFIG_CHOICE" = gen ] && ask_config
    return 0
}

summary_text() {
    local b m e c t
    case "$BOARD" in atmega) b="Renkforce-Board (ATmega2560)" ;; skipr) b="MKS SKIPR" ;; esac
    case "$MODEL" in rf1000) m="RF1000" ;; rf2000) m="RF2000" ;; rf2000v2) m="RF2000 v2" ;; esac
    case "$EXTR" in single) e="Single" ;; dual) e="Dual (zwei Düsen)" ;; 2in1) e="2in1-Hotend" ;; esac
    case "$CONFIG_CHOICE" in gen) c="erzeugen wie im Config Creator" ;; creator) c="ZIP aus dem Config Creator" ;; *) c="nicht ändern" ;; esac
    t="Drucker:   $m, $e, ${FIL/./,} mm\nBoard:     $b\nFirmware:  Klipper\n"
    t+="Pakete:    $(echo ${PKGS:-keine})\nConfig:    $c\n"
    [ "$TARGET_DIR" != printer_data ] && t+="Ordner:    ~/$TARGET_DIR\n"
    [ "$THEME" = 1 ] && t+="Design:    3D-Artmaker Design für Mainsail\n"
    [ "$CONFIG_CHOICE" = gen ] && t+="$(config_summary)\n"
    [ "$BOARD" = atmega ] && [ "$FORK" = 0 ] && t+="Klipper:   auf den RF-Fork umstellen\n"
    t+="Befehl:    3DArtmaker-upgrade wird angelegt\n"
    echo "$t"
}

# ---------------------------------------------------------------- Config wie im Config Creator
# Der Generator ist derselbe JavaScript-Code wie im Config Creator (rf_generator.js, beim Release
# hinter "exit" als nie ausgefuehrtes Here-Document angehaengt). Er laeuft mit quickjs (qjs) oder Node.js.
GEN_JS=""; JS=(); FORM=""

prepare_generator() {
    [ -n "$GEN_JS" ] && return 0
    local self here; self=$(readlink -f "$0"); here=$(dirname "$self")
    GEN_JS="$WORK/rf_generator.js"
    if grep -q '^# __RF_GENERATOR__$' "$self"; then
        sed -n '/^# __RF_GENERATOR__$/,/^__RF_GENERATOR_END__$/p' "$self" | sed '1,2d;$d' > "$GEN_JS"
    elif [ -f "$here/rf_generator.js" ]; then cp "$here/rf_generator.js" "$GEN_JS"
    else fail "Der Config-Generator fehlt im Installer"; fi
    if command -v qjs >/dev/null; then JS=(qjs --std)
    elif command -v node >/dev/null; then JS=(node)
    elif command -v nodejs >/dev/null; then JS=(nodejs)
    else
        # quickjs nur herunterladen und entpacken, nicht installieren (1,9 MB, kein sudo noetig)
        say "Lade quickjs für den Config-Generator (wird nicht installiert) …"
        mkdir -p "$WORK/qjs"
        if (cd "$WORK/qjs" && apt-get download quickjs >>"$LOG" 2>&1) \
            && dpkg-deb -x "$(ls "$WORK"/qjs/quickjs_*.deb | head -1)" "$WORK/qjs/root" 2>>"$LOG" \
            && [ -x "$WORK/qjs/root/usr/bin/qjs" ]; then
            JS=("$WORK/qjs/root/usr/bin/qjs" --std)
        else
            ui_yesno "JavaScript" "Der Config-Generator braucht quickjs oder Node.js.\nquickjs gibt es für dieses System nicht.\n\nNode.js jetzt installieren (apt install nodejs)?" \
                || fail "Ohne quickjs oder Node.js kann der Installer keine Config erzeugen. Nimm dann den Config Creator im Browser und lade die ZIP hoch."
            need_sudo; sapt apt-get install -y nodejs || fail "nodejs konnte nicht installiert werden"
            if command -v node >/dev/null; then JS=(node); else JS=(nodejs); fi
        fi
    fi
    chmod -R a+rX "$WORK"
    gen defaults atmega single rf2000 >/dev/null 2>>"$LOG" || fail "Der Config-Generator läuft nicht (${JS[*]}), siehe $LOG"
    ok "Config-Generator bereit (${JS[0]##*/})"
}
gen() { "${JS[@]}" "$GEN_JS" "$@"; }

# Formularwerte wie im Config Creator (JSON in $FORM): v:feld, c:haken (ja/nein), r:auswahl
fget() {
    python3 -c 'import json,sys
v = json.load(open(sys.argv[1])).get(sys.argv[2], "")
print(("ja" if v else "nein") if isinstance(v, bool) else v)' "$FORM" "$1"
}
fset() {
    python3 - "$FORM" "$1" "$2" <<'PY'
import json, sys
f, k, v = sys.argv[1:4]
d = json.load(open(f))
d[k] = (v in ("ja", "true", "1", "on")) if k.startswith("c:") else v
json.dump(d, open(f, "w"), ensure_ascii=False)
PY
}
st() {   # berechneter Wert aus dem Generator (wie im Creator)
    gen state "$FORM" | python3 -c 'import json,sys; v=json.load(sys.stdin)[sys.argv[1]]; print(("ja" if v else "nein") if isinstance(v,bool) else v)' "$1"
}

is_num() { [[ "$1" =~ ^-?[0-9]+([.][0-9]+)?$ ]]; }

# Mehrere Werte als Liste zeigen, einzeln aendern: Titel Text feld "Bezeichnung" Einheit …
edit_values() {
    local t="$1" x="$2"; shift 2
    local spec=("$@") i sel v
    [ "$YES" = 1 ] && return 0
    if [ "$UI" != whiptail ]; then
        { echo; echo "${B}$t${N}"; printf '%b\n' "$x"; } >&2
        for ((i=0; i<${#spec[@]}; i+=3)); do
            while :; do
                v=$(ui_input "$t" "${spec[i+1]}${spec[i+2]:+ ($(unit "${spec[i+2]}"))}" "$(fget "${spec[i]}")"); v=${v/,/.}
                is_num "$v" && break; echo "Bitte eine Zahl eingeben." >&2
            done
            fset "${spec[i]}" "$v"
        done
        return 0
    fi
    while :; do
        local opts=(weiter "➜ Weiter mit diesen Werten")
        for ((i=0; i<${#spec[@]}; i+=3)); do
            opts+=("${spec[i]}" "$(printf '%-36s %s %s' "${spec[i+1]}:" "$(fget "${spec[i]}" | tr . ,)" "$(unit "${spec[i+2]}")")")
        done
        sel=$(ui_menu "$t" "$x\n\nZum Ändern einen Wert wählen, dann Enter." weiter "${opts[@]}"); abort_if "$sel"
        [ "$sel" = weiter ] && return 0
        for ((i=0; i<${#spec[@]}; i+=3)); do [ "${spec[i]}" = "$sel" ] && break; done
        v=$(ui_input "$t" "${spec[i+1]}${spec[i+2]:+ in $(unit "${spec[i+2]}")}:" "$(fget "$sel" | tr . ,)") || continue
        v=${v/,/.}
        if is_num "$v"; then fset "$sel" "$v"; else ui_msg "$t" "„$v“ ist keine Zahl. Der Wert bleibt unverändert."; fi
    done
}
unit() { case "$1" in mm) echo "mm" ;; C) echo "°C" ;; s) echo "s" ;; pc) echo "%" ;; d) echo "Digits" ;; n) echo "Messwerte" ;; st) echo "Steps/mm" ;; *) echo "$1" ;; esac; }

ask_bool() {   # feld Titel Text
    local d=""; [ "$(fget "$1")" = ja ] || d=nein
    if ui_yesno "$2" "$3" $d; then fset "$1" ja; else fset "$1" nein; fi
}

# Drucker an diesem Pi (rf-multi): fuer welchen Ordner wird die Config erzeugt?
choose_target() {
    TARGET_DIR=printer_data; SERVICE=klipper; PCOUNT=1; PNUM=1; PNAME=""
    [ "$BOARD" = atmega ] || return 0
    local d n names=() i=2
    for d in "$KHOME"/printer_*_data; do
        [ -d "$d/config" ] || continue
        n=${d##*/printer_}; names+=("${n%_data}")
    done
    [ ${#names[@]} -gt 0 ] || return 0
    local opts=(printer_data "Drucker 1 (~/printer_data, Mainsail ohne Port)")
    for n in "${names[@]}"; do opts+=("printer_${n}_data" "Drucker $i: $n (~/printer_${n}_data)"); i=$((i+1)); done
    TARGET_DIR=$(ui_menu "Drucker an diesem Pi" "An diesem Pi laufen mehrere Drucker (rf-multi).\nFür welchen soll die Config sein?" printer_data "${opts[@]}"); abort_if "$TARGET_DIR"
    PCOUNT=$(( ${#names[@]} + 1 ))
    if [ "$TARGET_DIR" != printer_data ]; then
        PNAME=${TARGET_DIR#printer_}; PNAME=${PNAME%_data}; SERVICE="klipper-$PNAME"
        i=2; for n in "${names[@]}"; do [ "$n" = "$PNAME" ] && PNUM=$i; i=$((i+1)); done
    fi
}

current_serial() {   # serial aus [mcu] der vorhandenen printer.cfg
    awk '/^\[mcu\]/{m=1;next} /^\[/{m=0} m&&/^serial:/{print $2; exit}' "$KHOME/$TARGET_DIR/config/printer.cfg" 2>/dev/null
}

# Alle Fragen des Config Creators, Seite fuer Seite
ask_config() {
    prepare_generator
    FORM="$WORK/form.json"
    gen defaults "$BOARD" "$EXTR" "$MODEL" > "$FORM" 2>>"$LOG" || fail "Vorgaben konnten nicht erzeugt werden (siehe $LOG)"
    local saved="$STATE_DIR/config-$TARGET_DIR.json"
    if [ -f "$saved" ] && python3 - "$saved" "$BOARD" "$EXTR" "$MODEL" <<'PY'
import json, sys
d = json.load(open(sys.argv[1]))
sys.exit(0 if (d.get("board"), d.get("r:ext"), d.get("v:model")) == tuple(sys.argv[2:5]) else 1)
PY
    then
        ui_yesno "Letzte Eingaben" "Für diesen Drucker gibt es Eingaben vom $(date -r "$saved" '+%d.%m.%Y %H:%M').\n\nAls Vorgabe übernehmen?" && cp "$saved" "$FORM"
    fi
    fset board "$BOARD"; fset fw klipper; fset pcount "$PCOUNT"; fset pnum "$PNUM"
    [ -n "$PNAME" ] && fset v:pname "$PNAME"
    fset r:fil "$FIL"
    local mname; case "$MODEL" in rf1000) mname="RF1000" ;; rf2000) mname="RF2000" ;; *) mname="RF2000 v2" ;; esac

    # Seite Drucker: Masse, LED, Display
    edit_values "Drucker: Maße" "Bauraum des $mname. Die Vorgaben sind am Drucker gemessen.\nY-Home vor dem Bett: so weit steht die Düse am Y-Schalter vor der Bettkante.\nY frei vorne: Streifen für die Prime Line (im Slicer gesperrt)." \
        v:xmax "X max" mm v:ytravel "Y-Fahrweg ab Schalter" mm v:zmax "Z max" mm \
        v:yhome "Y-Home vor dem Bett" mm v:yfront "Y frei vorne (Prime Line)" mm
    if [ "$BOARD" = skipr ]; then
        ask_bool c:led "LED" "Ist ein LED-Streifen (Neopixel an PC5, 10 LEDs) angeschlossen?\n\nDann kommen led_progress.cfg und die Makros Licht_an / Licht_aus dazu."
    else
        # RGB-LED (rf_led.cfg) gehört bei RF2000 und RF2000 v2 immer dazu, der RF1000 hat keine
        if [ "$MODEL" = rf1000 ]; then fset c:led nein; else fset c:led ja; fi
        # Display und Menü (rf_display.cfg) gehören beim ATmega2560 immer dazu, ohne Nachfrage:
        # Der Firmware-Updater zeigt seine Meldung über RF_DISPLAY_SIGNAL aus dieser Datei.
        fset c:rfdisp ja
    fi

    # Seite Hotend: Duese, Extruder-Schritte, Duesenversatz
    local nz; nz=$(fget v:nozzle)
    nz=$(ui_menu "Hotend: Düse" "Welche Düse ist eingebaut?" "$nz" 0.2 "0,2 mm" 0.3 "0,3 mm" 0.4 "0,4 mm" 0.5 "0,5 mm" 0.6 "0,6 mm" 0.7 "0,7 mm" 0.8 "0,8 mm"); abort_if "$nz"
    fset v:nozzle "$nz"
    edit_values "Hotend: Extruder" "Schritte des Extrudermotors pro mm Filament bei $(st microsteps) Mikroschritten.\nDaraus wird rotation_distance berechnet (jetzt $(st rot | tr . ,))." \
        v:esteps "Extruder Steps pro mm" st
    if [ "$EXTR" = dual ]; then
        edit_values "Hotend: Düsenversatz" "Versatz der zweiten Düse. Klipper addiert ihn zu den Koordinaten:\nLiegt Düse 2 rechts von Düse 1, ist offset_x negativ. Später mit OFFSET_TEST prüfen." \
            v:offx "offset_x" mm v:offy "offset_y" mm
        # Seite Filament (nur Dual): Vorgaben fuer den Duesenversatz-Test
        local ft; ft=$(fget r:ftype)
        ft=$(ui_menu "Filament" "Filament-Typ für den Düsenversatz-Test (OFFSET_TEST)?" "$ft" \
            pla "PLA (195 °C, Bett 65 °C)" petg "PETG (220 °C, Bett 75 °C)" manual "Manuell (eigene Temperaturen)"); abort_if "$ft"
        fset r:ftype "$ft"
        case "$ft" in
            pla)  fset v:ftemp 195; fset v:fbed 65 ;;
            petg) fset v:ftemp 220; fset v:fbed 75 ;;
            *)    edit_values "Filament" "Temperaturen für OFFSET_TEST." v:ftemp "Düsentemperatur" C v:fbed "Betttemperatur" C ;;
        esac
    fi

    # Seite Anschluesse: MCU serial, Z-Endstop, Heissmessung
    local cur ports=() p opts=() def sel
    cur=$(current_serial); [ -n "$cur" ] || cur=$(fget v:serial)
    if [ "$BOARD" = skipr ]; then ports=(/dev/ttyS0 "${STM_PORTS[@]}"); else ports=("${FTDI_PORTS[@]}"); fi
    def=$cur
    [ "$BOARD" = atmega ] && [ ${#FTDI_PORTS[@]} -eq 1 ] && [ "$TARGET_DIR" = printer_data ] && def=${FTDI_PORTS[0]}
    # SKIPR: interne Verbindung, ausser die alte Config nutzt schon einen passenden Anschluss
    [ "$BOARD" = skipr ] && case "$cur" in /dev/ttyS*|*stm32*|*Klipper*) ;; *) def=/dev/ttyS0 ;; esac
    opts+=("$cur" "$cur  (bisher)")
    for p in "${ports[@]}"; do [ "$p" = "$cur" ] || opts+=("$p" "$p  (gefunden)"); done
    opts+=(__andere__ "Anderen Anschluss eingeben")
    sel=$(ui_menu "Anschlüsse: MCU serial" "Über welchen Anschluss spricht Klipper mit dem Board?\n(Liste: ls /dev/serial/by-id/)" "$def" "${opts[@]}"); abort_if "$sel"
    [ "$sel" = __andere__ ] && sel=$(ui_input "MCU serial" "Anschluss des Boards:" "$cur")
    fset v:serial "$sel"
    edit_values "Anschlüsse: Z-Endstop" "Z min ist der Weg, den Z unter 0 weiterfahren darf (Überfahrweg, negativ).\nRF1000-Endschalter etwa -0,8 mm, Lichtschranke -1,2 mm, SKIPR -0,8 mm." \
        v:zmin "Z min / Überfahrweg" mm
    ask_bool c:zinv "Z-Endstop" "Endstop-Pin $(fget v:zpin) invertieren (\"!\" davor)?\n\nSo ist es bei allen Renkforce-Druckern. Nach dem Start mit QUERY_ENDSTOPS prüfen: frei = open."
    if [ "$EXTR" != 2in1 ]; then
        ask_bool c:hp "Heißmessung" "Vor jedem Druck heiß mit PROBE messen und den Z-Offset setzen?\n\nDie Düse berührt dabei das Bett an einem Zufallspunkt. Das Mesh muss wie in bed_calibrate aufgenommen sein."
        [ "$(fget c:hp)" = ja ] && edit_values "Heißmessung" "Zufallspunkt in X und Y zwischen „von“ und „bis“, Wartezeit nach dem Aufheizen." \
            v:hpmin "Zufallspunkt von" mm v:hpmax "Zufallspunkt bis" mm v:hpwait "Wartezeit nach dem Aufheizen" s
    fi

    # Seite DMS (nur Renkforce-Board)
    if [ "$BOARD" = atmega ]; then
        ask_bool c:guard "DMS" "Notfall-Pause und Flow-Kompensation über den DMS einbinden?\n\n(Modul rf1000_pressure_guard aus dem RF-Klipper)"
        if [ "$(fget c:guard)" = ja ]; then
            ask_bool c:eon "DMS: Notfall-Pause" "Notfall-Pause verwenden?\n\nPausiert den Druck, wenn die Kraft an der Düse zu groß wird (Verstopfung, Düse im Bett)."
            [ "$(fget c:eon)" = ja ] && edit_values "DMS: Notfall-Pause" "Grenzen in der Einheit von LCP_READ, Mittelwert über die letzten Messwerte." \
                v:emin "Pause unter (negativ)" d v:emax "Pause über" d v:esamp "Mittelwert über" n
            ask_bool c:fon "DMS: Flow-Kompensation" "Flow-Kompensation verwenden?\n\nPasst Extrusion und Vorschub an, wenn der Druck an der Düse steigt."
            [ "$(fget c:fon)" = ja ] && edit_values "DMS: Flow-Kompensation" "Zwischen „Flow ab“ und „Volle Wirkung“ steigt die Korrektur linear an." \
                v:fmin "Flow ab" d v:fmax "Volle Wirkung bei" d v:fpct "Extrusion bei voller Wirkung" pc v:vpct "Vorschub bei voller Wirkung" pc v:fminz "Korrektur erst ab Z" mm
            ask_bool c:digits "DMS: Kurve" "Kurve „Digits“ in Mainsail anzeigen?\n\nZeigt die Kraft des DMS live, praktisch zum Einstellen der Grenzen."
        fi
    fi

    # Dateien erzeugen (noch nicht einspielen)
    rm -rf "$WORK/gen"; mkdir -p "$WORK/gen"
    gen generate "$FORM" "$WORK/gen" > "$WORK/gen.list" 2>>"$LOG" || fail "Config konnte nicht erzeugt werden (siehe $LOG)"
    chmod -R a+rX "$WORK"
    ok "Config erzeugt: $(tr '\n' ' ' < "$WORK/gen.list")"
}

config_summary() {
    gen state "$FORM" | python3 -c '
import json, sys
s = json.load(sys.stdin)
f = lambda v: ("%g" % v).replace(".", ",")
print("Maße:      X %s × Y %s × Z %s mm, Y-Home %s mm vor dem Bett" % (f(s["xmax"]), f(s["ymax"]), f(s["zmax"]), f(s["yhome"])))
print("Hotend:    Düse %s mm, rotation_distance %s%s" % (f(s["nozzle"]), f(s["rot"]), ", Versatz X %s / Y %s" % (f(s["offx"]), f(s["offy"])) if s["dual"] else ""))
x = ["LED" if s["led"] else "", "RF-Display" if s["rfdisp"] else "", "Heißmessung" if s["hp"] else ""]
if s["board"] == "atmega":
    x.append("DMS-Schutz" if s["guard"] else "ohne DMS-Schutz")
print("Optionen:  %s" % (", ".join(v for v in x if v) or "keine"))
print("Anschluss: %s, Z-Endstop %s" % (s["serial"], s["zpin"]))'
    echo "Dateien:   $(tr '\n' ' ' < "$WORK/gen.list")"
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
    if [[ " $* " == *" rf-terminal "* ]] && pkg_installed rf-terminal && in_web_terminal; then
        say "Hinweis: Du arbeitest im System Terminal. Es bleibt offen, die neue Version startet nach dem Abmelden."
    fi
    sapt apt-get install -y --allow-downgrades "${debs[@]}" || fail "Installation fehlgeschlagen (siehe $LOG)"
    ok "Installiert: $*"
}

backup_config() {
    local name="config-$STAMP.tar.gz"; [ "$TARGET_DIR" != printer_data ] && name="config-${PNAME}-$STAMP.tar.gz"
    [ -d "$KHOME/$TARGET_DIR/config" ] || return 0
    urun mkdir -p "$KHOME/3dartmaker-backup"
    urun tar czf "$KHOME/3dartmaker-backup/$name" -C "$KHOME/$TARGET_DIR" config
    ok "Config gesichert: ~/3dartmaker-backup/$name"
}

# SAVE_CONFIG-Block (PID, Mesh, Z-Endstop …) der alten printer.cfg an die neue haengen.
# Abschnitte, die es in der neuen Config nicht gibt (z. B. extruder1 nach Wechsel auf Single), fallen weg.
keep_autosave() {   # alte printer.cfg, neue printer.cfg -> Ausgabe: behaltene und entfernte Abschnitte
    python3 - "$1" "$2" <<'PY'
import re, sys
old, new = sys.argv[1], sys.argv[2]
try:
    o = open(old, encoding="utf-8").read()
except OSError:
    sys.exit(0)
mark = "#*# <---------------------- SAVE_CONFIG ---------------------->"
i = o.find(mark)
if i < 0:
    sys.exit(0)
lines = o[i:].splitlines()
head, secs, cur = [], [], None
for l in lines:
    m = re.match(r"#\*# \[([^\]]+)\]\s*$", l)
    if m:
        cur = [m.group(1), [l]]; secs.append(cur)
    elif cur is None:
        head.append(l)
    else:
        cur[1].append(l)
n = open(new, encoding="utf-8").read()
have = set(re.findall(r"(?m)^\[([^\]]+)\]", n))
keep = [x for x in secs if x[0] in have or x[0].startswith("bed_mesh ") or x[0] == "input_shaper"]
drop = [x[0] for x in secs if x not in keep]
if not keep:
    sys.exit(0)
body = "\n".join(head + [l for x in keep for l in x[1]])
open(new, "w", encoding="utf-8").write(n.rstrip("\n") + "\n\n" + body.rstrip("\n") + "\n")
print("behalten: " + ", ".join(x[0] for x in keep))
if drop:
    print("entfernt: " + ", ".join(drop))
PY
}

install_generated() {
    head1 "Config einspielen (wie im Config Creator erzeugt)"
    local c="$KHOME/$TARGET_DIR/config" out="$WORK/gen" r
    [ -d "$c" ] || fail "Config-Ordner $c fehlt"
    backup_config
    if grep -qs '^#\*# <-* SAVE_CONFIG' "$c/printer.cfg"; then
        if ui_yesno "Kalibrierwerte" "Die bisherige printer.cfg enthält gespeicherte Kalibrierwerte (SAVE_CONFIG: PID, Bed Mesh, Z-Endstop …).\n\nIn die neue printer.cfg übernehmen?\n(Abschnitte, die es dort nicht mehr gibt, fallen weg.)"; then
            r=$(keep_autosave "$c/printer.cfg" "$out/printer.cfg") && [ -n "$r" ] && while IFS= read -r l; do ok "SAVE_CONFIG $l"; done <<< "$r"
        fi
    fi
    chmod -R a+rX "$WORK"
    local f; for f in $(cat "$WORK/gen.list"); do urun cp -f "$out/$f" "$c/$f"; done
    zmax_strip_if_missing "$c/printer.cfg"
    ok "Eingespielt nach ~/$TARGET_DIR/config: $(tr '\n' ' ' < "$WORK/gen.list")"
    if [ "$PROBE" = 1 ]; then say "  [Probe] Eingaben gespeichert in $STATE_DIR/config-$TARGET_DIR.json"
    else sudo mkdir -p "$STATE_DIR"; sudo install -m 644 "$FORM" "$STATE_DIR/config-$TARGET_DIR.json"; fi
    CONFIG_CHANGED=1
}

unpack_into_config() {   # ZIP [Unterordner]
    local zip="$1" sub="${2:-}" c="$KHOME/$TARGET_DIR/config"
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
    zmax_strip_if_missing "$c/printer.cfg"
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

# Config "nicht ändern": Beim ATmega2560 fehlen Display-Menü und Update-Meldung (rf_display.cfg)
# und beim RF2000 / RF2000 v2 die RGB-LED (rf_led.cfg) oft in einer älteren Config. Die Dateien
# und die Abschnitte [display], [save_variables], [led led] kommen aus dem Generator,
# alles andere in der printer.cfg bleibt.
ensure_rf_display() {
    [ "$BOARD" = atmega ] || return 0
    local c="$KHOME/$TARGET_DIR/config"
    [ -f "$c/printer.cfg" ] || return 0
    local want_led=0 have_disp=0 have_led=1
    [ "$MODEL" != rf1000 ] && want_led=1
    if [ -f "$c/rf_display.cfg" ] && grep -qs '^\[include rf_display.cfg\]' "$c/printer.cfg" \
       && grep -qs 'RF_DISPLAY_SIGNAL' "$c/rf_display.cfg"; then have_disp=1; fi
    if [ "$want_led" = 1 ]; then
        have_led=0
        if [ -f "$c/rf_led.cfg" ] && grep -qs '^\[include rf_led.cfg\]' "$c/printer.cfg" \
           && grep -qs '^\[led led\]' "$c/printer.cfg"; then have_led=1; fi
    fi
    [ "$have_disp" = 1 ] && [ "$have_led" = 1 ] && return 0
    head1 "Display-Menü, Update-Meldung und LED ergänzen (rf_display.cfg, rf_led.cfg)"
    prepare_generator
    FORM="$WORK/form.json"
    gen defaults "$BOARD" "$EXTR" "$MODEL" > "$FORM" 2>>"$LOG" || { warn "Display-Vorgaben konnten nicht erzeugt werden (siehe $LOG)"; return 0; }
    fset board "$BOARD"; fset fw klipper; fset pcount "$PCOUNT"; fset pnum "$PNUM"
    [ -n "$PNAME" ] && fset v:pname "$PNAME"
    fset r:fil "$FIL"; fset c:rfdisp ja
    if [ "$want_led" = 1 ]; then fset c:led ja; else fset c:led nein; fi
    gen generate "$FORM" "$WORK/gen" > "$WORK/gen.list" 2>>"$LOG" || { warn "Display-Config konnte nicht erzeugt werden (siehe $LOG)"; return 0; }
    chmod -R a+rX "$WORK"
    [ -f "$WORK/gen/rf_display.cfg" ] && [ -f "$WORK/gen/printer.cfg" ] || { warn "Generator hat keine rf_display.cfg geliefert"; return 0; }
    [ "$want_led" = 1 ] && [ ! -f "$WORK/gen/rf_led.cfg" ] && { warn "Generator hat keine rf_led.cfg geliefert"; return 0; }
    backup_config
    local tmp="$WORK/printer.patched"
    if python3 - "$c/printer.cfg" "$WORK/gen/printer.cfg" "$tmp" "$want_led" <<'PY'
import re, sys
old, new, out, want_led = sys.argv[1:5]
O = open(old, encoding="utf-8").read().split("\n")
N = open(new, encoding="utf-8").read().split("\n")
def head(l): return l.strip().lower()
def is_start(l): return re.match(r"\[[^\]]+\]\s*$", l) is not None
def is_end(l): return is_start(l) or l.startswith("#*# <")
def section(lines, name):          # (von, bis) der Zeilen oder None
    for i, l in enumerate(lines):
        if head(l) == name:
            j = i + 1
            while j < len(lines) and not is_end(lines[j]): j += 1
            return i, j
    return None
names = ["[display]", "[save_variables]"] + (["[led led]"] if want_led == "1" else [])
includes = ["[include rf_display.cfg]"] + (["[include rf_led.cfg]"] if want_led == "1" else [])
for name in names:
    s = section(N, name)
    if not s: continue
    body = N[s[0]:s[1]]
    while body and not body[-1].strip(): body.pop()
    body.append("")
    o = section(O, name)
    if o: O[o[0]:o[1]] = body
    else:
        k = next((i for i, l in enumerate(O) if l.startswith("#*# <")), len(O))
        O[k:k] = body
for line in includes:
    if not any(head(l) == line for l in O):
        inc = [i for i, l in enumerate(O) if l.lower().startswith("[include ")]
        O.insert(inc[-1] + 1 if inc else 0, line)
open(out, "w", encoding="utf-8").write("\n".join(O))
PY
    then
        urun cp -f "$WORK/gen/rf_display.cfg" "$c/rf_display.cfg"
        [ "$want_led" = 1 ] && urun cp -f "$WORK/gen/rf_led.cfg" "$c/rf_led.cfg"
        urun cp -f "$tmp" "$c/printer.cfg"
        ok "rf_display.cfg$([ "$want_led" = 1 ] && echo ' und rf_led.cfg') ergänzt, printer.cfg angepasst (Sicherung in ~/3dartmaker-backup)"
        CONFIG_CHANGED=1
    else warn "printer.cfg konnte nicht angepasst werden, nichts geändert"; fi
}

apply_config() {
    case "$CONFIG_CHOICE" in
        keep|"") ensure_rf_display; return 0 ;;
        gen) install_generated; return 0 ;;
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
    esac
    CONFIG_CHANGED=1
}
CONFIG_CHANGED=0

# ---------------------------------------------------------------- Mainsail-Design
# Ordner .theme im Config-Ordner des Druckers (Release-Datei mainsail-theme.tar.gz).
# Die navi.json mit den Menüpunkten der Pakete bleibt unberührt.
THEME=0
THEME_FILES="custom.css logo.svg sidebar-logo.svg sidebar-background.svg favicon.png"

theme_dirs() {   # Datenordner (printer_data, printer_*_data), in denen unser Design liegt
    local d
    for d in "$KHOME/printer_data" "$KHOME"/printer_*_data; do
        grep -qs '3D-Artmaker Design' "$d/config/.theme/custom.css" && echo "$d"
    done
    return 0
}

theme_fetch() {   # laedt mainsail-theme.tar.gz und entpackt nach $WORK/theme
    [ -d "$WORK/theme/.theme" ] && return 0
    release_download mainsail-theme.tar.gz
    mkdir -p "$WORK/theme" && tar xzf "$WORK/mainsail-theme.tar.gz" -C "$WORK/theme" || return 1
    chmod -R a+rX "$WORK/theme"
}

theme_copy() {   # Datenordner
    local d="$1" f
    urun mkdir -p "$d/config/.theme"
    for f in $THEME_FILES; do urun cp -f "$WORK/theme/.theme/$f" "$d/config/.theme/$f"; done
}

choose_theme() {
    [ "$HAS_MAINSAIL" = 1 ] || return 0
    ui_yesno "Mainsail-Design" "3D-Artmaker Design für Mainsail einspielen?\n\nMarineblau mit dem 3D-Artmaker Logo, Ordner ~/$TARGET_DIR/config/.theme. Die Menüpunkte (System Terminal, Firmware-Update) bleiben.\nEntfernen: Ordner .theme löschen.\n3DArtmaker-upgrade hält das Design aktuell." && THEME=1
    return 0
}

install_theme() {
    [ "$THEME" = 1 ] || return 0
    head1 "Mainsail-Design"
    theme_fetch || { warn "Design konnte nicht geladen werden, übersprungen"; return 0; }
    theme_copy "$KHOME/$TARGET_DIR"
    ok "Design eingespielt nach ~/$TARGET_DIR/config/.theme (Mainsail mit Strg+F5 neu laden)"
}

upgrade_theme() {   # nur, wo das Design schon liegt
    local dirs d f same
    dirs=$(theme_dirs); [ -n "$dirs" ] || return 0
    head1 "Mainsail-Design"
    theme_fetch || { warn "Design konnte nicht geladen werden, übersprungen"; return 0; }
    for d in $dirs; do
        same=1
        for f in $THEME_FILES; do cmp -s "$WORK/theme/.theme/$f" "$d/config/.theme/$f" || same=0; done
        if [ "$same" = 1 ]; then ok "~/${d##*/}: Design ist aktuell"
        else theme_copy "$d"; ok "~/${d##*/}: Design aktualisiert (Mainsail mit Strg+F5 neu laden)"; fi
    done
}

restart_klipper() {
    [ "$CONFIG_CHANGED" = 1 ] || return 0
    if printer_busy; then warn "Gerade läuft ein Druck. Klipper bitte nach dem Druck neu starten."; return; fi
    run sudo systemctl restart "$SERVICE" && ok "Klipper neu gestartet ($SERVICE)"
}

# ---------------------------------------------------------------- Z-Max-Endstop (RF2000 / RF2000 v2)
# [rf_z_max] braucht rf_z_max.py aus dem RF-Klipper. Ohne das Modul startet Klipper nicht.
zmax_module() { [ -f "$KHOME/klipper/klippy/extras/rf_z_max.py" ]; }

zmax_strip_if_missing() {   # printer.cfg: [rf_z_max] entfernen, solange Klipper das Modul nicht hat
    [ "$PROBE" = 1 ] && return 0
    zmax_module && return 0
    grep -qs '^\[rf_z_max\]' "$1" || return 0
    awk '/^\[rf_z_max\]/{s=1;next} s&&(/^[[:space:]]*$/||/^\[/){s=0} !s' "$1" > "$WORK/nozmax.cfg"
    chmod a+r "$WORK/nozmax.cfg"; chmod a+x "$WORK"
    urun cp -f "$WORK/nozmax.cfg" "$1"
    warn "Z-Max-Endstop noch nicht eingetragen, dafür ist Klipper zu alt. Erst Firmware-Update in Mainsail ausführen, dann 3DArtmaker-upgrade."
}

# Aendert nur RF2000 und RF2000 v2 auf dem ATmega2560 (an den Pins erkannt) ohne [rf_z_max].
# Rueckgabe 0 = Config braucht den Z-Max-Endstop. Mit Zielordner werden dort die
# geaenderten Dateien geschrieben.
zmax_patch() {   # Config-Ordner [Zielordner]
    python3 - "$1" "${2:-}" <<'PY'
import os, re, sys
cfg, out = sys.argv[1], sys.argv[2]
def read(name):
    try:
        with open(os.path.join(cfg, name), encoding="utf-8", newline="") as f:
            return f.read()
    except (OSError, UnicodeDecodeError):
        return ""
printer = read("printer.cfg")
active = printer.split("\n#*# <")[0].replace("\r", "")
def value(section, key):
    m = re.search(r"(?ms)^\[%s\][ \t]*$(.*?)(?=^\[|\Z)" % re.escape(section), active)
    v = m and re.search(r"(?m)^%s[ \t]*[:=][ \t]*([^#;\n]*)" % key, m.group(1))
    return v.group(1).strip().lstrip("^~!").strip() if v else ""
if not (value("stepper_x", "endstop_pin") == "PC2"
        and value("stepper_z", "endstop_pin") == "PC6"
        and value("drv8711 stepper_z", "cs_pin") == "PB6"):
    sys.exit(1)
texts = [active]
for name in re.findall(r"(?m)^\[include ([^\]*?]+)\]", active):
    texts.append(read(name.strip()).replace("\r", ""))
for text in texts:
    if re.search(r"(?m)^\[rf_z_max\]", text):
        sys.exit(1)
    # PH1 schon anders belegt: nichts anfassen
    if any(re.search(r"\bPH1\b", l.split("#")[0]) for l in text.split("\n")):
        sys.exit(1)
if not re.search(r"(?m)^\[stepper_x\]", active):
    sys.exit(1)
if not out:
    sys.exit(0)
def write(name, text):
    with open(os.path.join(out, name), "w", encoding="utf-8", newline="") as f:
        f.write(text)
nl = "\r\n" if "\r\n" in printer else "\n"
block = nl.join([
    "# Z-Max-Endstop am unteren Ende der Z-Achse (Repetier Z_MAX_PIN PH1). Ist er ausgeloest,",
    "# faehrt das Bett nicht weiter nach unten. Objekt ausgeben faehrt bis zum Schalter,",
    "# hoechstens bis seek_limit. Braucht rf_z_max.py aus dem Klipper-Fork.",
    "# Test: Schalter von Hand druecken, QUERY_ENDSTOPS muss dann z_max:TRIGGERED melden.",
    "[rf_z_max]", "pin: ^!PH1", "seek_limit: 210", "", ""])
write("printer.cfg", re.sub(r"(?m)^\[stepper_x\]", lambda m: block + m.group(0), printer, count=1))
# Objekt ausgeben: bis zum Schalter statt auf eine feste Hoehe
display = read("rf_display.cfg")
if "RF_Z_MAX_SEEK" not in display:
    nl = "\r\n" if "\r\n" in display else "\n"
    old = "    G1 Z{th.axis_maximum.z - 5} F540"
    new = nl.join(["    {% if 'rf_z_max' in printer %}",
                   "    # RF2000: bis zum Z-Max-Endstop, nie weiter",
                   "    RF_Z_MAX_SEEK", "    {% else %}", old, "    {% endif %}"])
    pat = r"(?ms)(^\[gcode_macro _RF_OUTPUT_OBJECT\](?:(?!^\[).)*?)^%s(?=\r?$)" % re.escape(old)
    text, n = re.subn(pat, lambda m: m.group(1) + new, display)
    if n == 1:
        write("rf_display.cfg", text)
sys.exit(0)
PY
}

klipper_service_for() {   # Datenordner -> Dienst, der dessen printer.cfg nutzt
    local u t
    for u in $(systemctl list-unit-files 'klipper*.service' --no-legend 2>/dev/null | awk '{print $1}'); do
        t=$(systemctl cat "$u" 2>/dev/null)
        [[ "$t" == *"$1/config/printer.cfg"* || "$t" == *"$1/systemd/"* ]] && { echo "$u"; return 0; }
    done
    return 1
}

moonraker_port() {   # Datenordner
    local p
    p=$(awk '/^\[/{s=($0 ~ /^\[server\]/)} s&&/^port[ \t]*[:=]/{sub(/^port[ \t]*[:=][ \t]*/,""); print int($0); exit}' "$1/config/moonraker.conf" 2>/dev/null)
    echo "${p:-7125}"
}

klipper_state() {   # Moonraker-Port -> ready, startup, error, shutdown oder leer
    curl -fs --max-time 3 "http://127.0.0.1:$1/printer/info" 2>/dev/null \
        | python3 -c 'import json,sys; print(json.load(sys.stdin)["result"]["state"])' 2>/dev/null
}

klipper_wait() {   # Moonraker-Port -> 0 = bereit
    local i s
    sleep 5
    for i in $(seq 30); do
        s=$(klipper_state "$1")
        [ "$s" = ready ] && return 0
        [ "$s" = error ] && [ "$i" -gt 5 ] && return 1
        sleep 2
    done
    return 1
}

upgrade_zmax() {
    [ "$FORK" = 1 ] || return 0
    local d todo=()
    for d in "$KHOME/printer_data" "$KHOME"/printer_*_data; do
        [ -f "$d/config/printer.cfg" ] && zmax_patch "$d/config" && todo+=("$d")
    done
    [ ${#todo[@]} -gt 0 ] || return 0
    head1 "Z-Max-Endstop (RF2000 / RF2000 v2)"
    if ! zmax_module; then
        warn "Dafür ist Klipper noch zu alt. Erst in Mainsail Firmware-Update → Update starten, danach 3DArtmaker-upgrade noch einmal ausführen."
        return 0
    fi
    local list=""; for d in "${todo[@]}"; do list+="  ~/${d##*/}\n"; done
    ui_yesno "Z-Max-Endstop" "Z-Max-Endstop (Pin PH1) eintragen? Das Bett fährt dann nicht weiter nach unten, wenn der Schalter ausgelöst ist.\n\n$list\nprinter.cfg bekommt [rf_z_max], \"Objekt ausgeben\" in rf_display.cfg fährt bis zum Schalter. Vorher wird die Config gesichert, danach startet Klipper neu." || return 0
    local name c svc port before new f
    for d in "${todo[@]}"; do
        name=${d##*/}; c="$d/config"; port=$(moonraker_port "$d")
        if printer_busy "$port"; then warn "~/$name: Es läuft ein Druck, übersprungen. Bitte später noch einmal."; continue; fi
        svc=$(klipper_service_for "$d") || { warn "~/$name: Klipper-Dienst nicht gefunden, übersprungen"; continue; }
        if [ "$PROBE" = 1 ]; then say "  [Probe] ~/$name: [rf_z_max] eintragen, $svc neu starten"; continue; fi
        need_sudo
        urun mkdir -p "$KHOME/3dartmaker-backup"
        urun tar czf "$KHOME/3dartmaker-backup/config-$name-zmax-$STAMP.tar.gz" -C "$d" config \
            || { warn "~/$name: Sicherung fehlgeschlagen, nichts geändert"; continue; }
        new="$WORK/zmax-$name"; mkdir -p "$new/neu" "$new/alt"
        zmax_patch "$c" "$new/neu" || { warn "~/$name: Config konnte nicht angepasst werden, nichts geändert"; continue; }
        before=$(klipper_state "$port")
        for f in "$new/neu"/*.cfg; do cp "$c/${f##*/}" "$new/alt/"; done
        chmod a+x "$WORK"; chmod -R a+rX "$new"
        for f in "$new/neu"/*.cfg; do urun cp -f "$f" "$c/${f##*/}"; done
        [ -f "$new/neu/rf_display.cfg" ] || grep -qs RF_Z_MAX_SEEK "$c/rf_display.cfg" \
            || warn "~/$name: \"Objekt ausgeben\" nicht angepasst (eigenes Makro). Der Endstop schützt trotzdem."
        run sudo systemctl restart "$svc"
        if klipper_wait "$port"; then
            ok "~/$name: Z-Max-Endstop eingetragen, $svc neu gestartet"
        elif [ "$before" = ready ]; then
            for f in "$new/alt"/*.cfg; do urun cp -f "$f" "$c/${f##*/}"; done
            run sudo systemctl restart "$svc"
            warn "~/$name: Klipper wurde nicht bereit, die alte Config ist wieder eingespielt (siehe klippy.log)"
            continue
        else
            warn "~/$name: eingetragen. Klipper war schon vorher nicht bereit, bitte in Mainsail prüfen."
        fi
        warn "~/$name: Jetzt den Schalter testen: QUERY_ENDSTOPS meldet frei z_max:open und von Hand gedrückt z_max:TRIGGERED. Sonst \"Objekt ausgeben\" nicht benutzen."
    done
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

    upgrade_theme

    if [ -d "$KHOME/klipper/.git" ] && [ "$FORK" = 1 ]; then
        head1 "Klipper (RF-Fork)"
        as_user git -C "$KHOME/klipper" fetch -q origin 2>/dev/null || warn "git fetch für Klipper fehlgeschlagen"
        local behind; behind=$(as_user git -C "$KHOME/klipper" rev-list --count HEAD..origin/master 2>/dev/null || echo 0)
        if [ "${behind:-0}" -gt 0 ]; then
            warn "Klipper: $behind neue Änderung(en). Aktualisiere Klipper und Firmware zusammen in Mainsail: Firmware-Update → Update starten."
        else ok "Klipper ist aktuell"; fi
    fi

    upgrade_zmax

    head1 "Betriebssystem"
    [ "$PROBE" = 1 ] || { need_sudo; sudo apt-get update -qq >>"$LOG" 2>&1; }
    UPGRADABLE=$(apt-get -s upgrade 2>/dev/null | grep -c '^Inst ' || true)
    if [ "${UPGRADABLE:-0}" -gt 0 ]; then
        warn "$UPGRADABLE Systempakete können aktualisiert werden"
        if ui_yesno "Systemupdates" "$UPGRADABLE Pakete des Betriebssystems aktualisieren (apt upgrade)?" nein; then
            if printer_busy; then warn "Gerade läuft ein Druck, übersprungen."; else need_sudo; sapt apt-get upgrade -y; fi
        fi
    else ok "System ist aktuell"; fi
    echo; ok "Fertig. Protokoll: $LOG"
}

# ---------------------------------------------------------------- Ablauf
do_install() {
    [ "$(id -u)" = 0 ] && [ -z "${SUDO_USER:-}" ] && warn "Starte den Installer am besten als normaler Benutzer (pi oder mks), nicht als root."
    ui_msg "$TITLE" "Willkommen beim 3D-Artmaker Installer (Version $VERSION).\n\nEr prüft dein System, fragt wie im Renkforce Config Creator nach deinem Drucker und installiert dann, was du auswählst:\n\n• Klipper-Config wie im Config Creator erzeugen (Renkforce-Board mit ATmega2560 oder MKS SKIPR)\n• RF-Klipper, Firmware-Update, System Terminal, Logo\n\nMarlin ist nicht Teil des Installers (Firmware von github.com/Dennis02121978/Marlin-RFxxxx selbst flashen).\n\nVor jeder Änderung wird nachgefragt.$( [ "$PROBE" = 1 ] && echo '\n\nPROBELAUF: Es wird nichts verändert.')"
    check_system
    choose
    ensure_klipper_base
    choose_packages
    choose_config
    choose_theme
    ui_yesno "Zusammenfassung" "$(summary_text)\nSo installieren?" || { say "Abgebrochen."; exit 0; }
    need_sudo
    switch_fork
    # shellcheck disable=SC2086
    install_packages $PKGS
    apply_config
    restart_klipper
    install_theme
    install_commands
    local next="Fertig!\n\n"
    next+="• Lade Mainsail im Browser mit F5 neu.\n"
    [ "$BOARD" = atmega ] && next+="• Mainsail → Firmware-Update → Update starten (schreibt Klipper aufs Board).\n"
    [ "$BOARD" = skipr ] && [[ " $PKGS " == *" skipr-update "* ]] && next+="• Mainsail → Firmware-Update → Update starten.\n"
    [[ " $PKGS " == *" rf-terminal "* ]] && next+="• Neu: Menüpunkt System Terminal.\n"
    if [ "$CONFIG_CHOICE" = gen ]; then
        next+="• Nach dem ersten Start: bed_calibrate (Bezugspunkt und Mesh), PID mit PID_Tuning_…\n"
        next+="• Slicer: siehe ~/$TARGET_DIR/config/LIESMICH.txt und die Ausgabe unten.\n"
    else
        next+="• Slicer-Einstellungen: Config Creator, Seite Anleitung.\n"
    fi
    next+="\nSpäter alles aktualisieren mit:\n   3DArtmaker-upgrade\n\nProtokoll: $LOG"
    ui_msg "Fertig" "$next"
    if [ "$CONFIG_CHOICE" = gen ]; then
        head1 "Slicer (OrcaSlicer)"
        gen slicer "$FORM" | tee -a "$LOG"
    fi
    echo; ok "Fertig. Später aktualisieren mit: 3DArtmaker-upgrade"
}

if [ "$MODE" = upgrade ]; then do_upgrade; else do_install; fi
exit $?
