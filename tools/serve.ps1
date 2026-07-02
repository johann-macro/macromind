# ============================================================
# MacroMind - Minimaler statischer Dev-Server (PowerShell)
# Kein Node/Python noetig. Start:
#   powershell -NoProfile -ExecutionPolicy Bypass -File tools\serve.ps1
# Dann im Browser: http://localhost:8123/
# ============================================================
$root = Split-Path -Parent $PSScriptRoot
$port = 8123

$mime = @{
  '.html'        = 'text/html; charset=utf-8'
  '.js'          = 'application/javascript; charset=utf-8'
  '.css'         = 'text/css; charset=utf-8'
  '.svg'         = 'image/svg+xml'
  '.webmanifest' = 'application/manifest+json'
  '.json'        = 'application/json; charset=utf-8'
  '.png'         = 'image/png'
  '.ico'         = 'image/x-icon'
  '.txt'         = 'text/plain; charset=utf-8'
}

$listener = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Loopback, $port)
$listener.Start()
Write-Host "MacroMind dev server laeuft: http://localhost:$port/"

while ($true) {
  $client = $listener.AcceptTcpClient()
  try {
    $stream = $client.GetStream()
    # Wichtig: Timeout, damit spekulative Browser-Verbindungen ohne Request
    # den (sequenziellen) Server nicht dauerhaft blockieren
    $stream.ReadTimeout = 1500
    $reader = New-Object System.IO.StreamReader($stream)
    $requestLine = $reader.ReadLine()
    while ($true) {
      $line = $reader.ReadLine()
      if ($null -eq $line -or $line -eq '') { break }
    }
    if ($requestLine -match '^GET\s+(\S+)\s') {
      $path = $Matches[1].Split('?')[0]
      if ($path -eq '/') { $path = '/index.html' }
      $path = [uri]::UnescapeDataString($path)
      $candidate = Join-Path $root ($path.TrimStart('/') -replace '/', '\')
      $file = [System.IO.Path]::GetFullPath($candidate)
      if ($file.StartsWith($root, [System.StringComparison]::OrdinalIgnoreCase) -and (Test-Path $file -PathType Leaf)) {
        $bytes = [System.IO.File]::ReadAllBytes($file)
        $ext = [System.IO.Path]::GetExtension($file).ToLower()
        $ct = $mime[$ext]
        if (-not $ct) { $ct = 'application/octet-stream' }
        $header = "HTTP/1.1 200 OK`r`nContent-Type: $ct`r`nContent-Length: $($bytes.Length)`r`nCache-Control: no-store`r`nConnection: close`r`n`r`n"
      } else {
        $bytes = [System.Text.Encoding]::UTF8.GetBytes('404 Not Found')
        $header = "HTTP/1.1 404 Not Found`r`nContent-Type: text/plain`r`nContent-Length: $($bytes.Length)`r`nConnection: close`r`n`r`n"
      }
      $hb = [System.Text.Encoding]::ASCII.GetBytes($header)
      $stream.Write($hb, 0, $hb.Length)
      $stream.Write($bytes, 0, $bytes.Length)
      $stream.Flush()
    }
  } catch { }
  finally { $client.Close() }
}
