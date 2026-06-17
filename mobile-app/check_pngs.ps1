
    $assetsDir = "d:\dharmaai---inner-balance-companion\mobile-app\assets"
$pngs = Get-ChildItem -Path $assetsDir -Filter "*.png"
foreach ($f in $pngs) {
    $bytes = [System.IO.File]::ReadAllBytes($f.FullName)
    $header = ($bytes[0..3] | ForEach-Object { $_.ToString("X2") }) -join " "
    $isJPEG = ($bytes[0] -eq 0xFF -and $bytes[1] -eq 0xD8)
    $isPNG = ($bytes[0] -eq 0x89 -and $bytes[1] -eq 0x50 -and $bytes[2] -eq 0x4E -and $bytes[3] -eq 0x47)
    $status = if ($isPNG) { "OK (real PNG)" } elseif ($isJPEG) { "PROBLEM (JPEG in .png file!)" } else { "UNKNOWN format" }
    Write-Host "$($f.Name): $header - $status"
}
