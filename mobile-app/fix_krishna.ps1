Add-Type -AssemblyName System.Drawing
$imgPath = "d:\dharmaai---inner-balance-companion\mobile-app\assets\krishna.png"
$fixedPath = "d:\dharmaai---inner-balance-companion\mobile-app\assets\krishna_fixed.png"
$img = [System.Drawing.Image]::FromFile($imgPath)
$img.Save($fixedPath, [System.Drawing.Imaging.ImageFormat]::Png)
$img.Dispose()
Remove-Item $imgPath
Rename-Item $fixedPath "krishna.png"
Write-Host "Done - converted JPEG to real PNG"
