# Erzeugt die Rollenspiel-Audios mit edge-tts (Microsoft-Neuralstimmen).
#
# Voraussetzung (einmalig, im normalen Terminal ausserhalb der DSH-Sandbox):
#   pip install edge-tts
#
# Aufruf aus dem Projektordner (Windows PowerShell):
#   powershell -ExecutionPolicy Bypass -File tools\make-roleplay-audio.ps1
#
# Optional:
#   powershell -ExecutionPolicy Bypass -File tools\make-roleplay-audio.ps1 -EdgeTts "C:\Pfad\zu\edge-tts.exe"
#
# Die Dateien landen in assets\audio\roleplay\ und heissen 01-waiter.mp3, 01-du.mp3 usw.

param(
  [string]$EdgeTts = "edge-tts",
  [string]$OutDir = ""
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
if (-not $OutDir) { $OutDir = Join-Path $root "assets\audio\roleplay" }
if (-not (Test-Path $OutDir)) { New-Item -ItemType Directory -Path $OutDir -Force | Out-Null }

if (-not (Get-Command $EdgeTts -ErrorAction SilentlyContinue)) {
  throw "edge-tts nicht gefunden. Bitte zuerst installieren: pip install edge-tts (oder -EdgeTts mit vollem Pfad angeben)."
}

$lines = Get-Content (Join-Path $PSScriptRoot "roleplay-lines.json") -Raw -Encoding UTF8 | ConvertFrom-Json
Write-Host "Erzeuge $($lines.Count) Dateien in $OutDir"

foreach ($l in $lines) {
  $target = Join-Path $OutDir $l.file
  Write-Host ("  -> " + $l.file + "  (" + $l.voice + ")")
  & $EdgeTts --voice $l.voice --text $l.text --write-media $target
  if ($LASTEXITCODE -ne 0) { throw "edge-tts ist bei $($l.file) fehlgeschlagen (Exit $LASTEXITCODE)." }
  if (-not (Test-Path $target)) { throw "Datei wurde nicht erzeugt: $target" }
}

Write-Host ""
Write-Host "Fertig. Jetzt im Projektordner: git status"
Write-Host "Die MP3s liegen unter assets\audio\roleplay\ und koennen eingecheckt werden."
