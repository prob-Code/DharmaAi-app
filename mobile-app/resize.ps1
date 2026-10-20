Add-Type -AssemblyName System.Drawing

$iconPath = "C:\Users\ojass\.gemini\antigravity\brain\a55a058f-6c76-4b67-8846-db4ac805bc0d\saarthi_app_icon_1783768547256.png"
$iconDest = "C:\Users\ojass\.gemini\antigravity\brain\a55a058f-6c76-4b67-8846-db4ac805bc0d\Saarthi_Icon_512.png"

$img = [System.Drawing.Image]::FromFile($iconPath)
$bmp = New-Object System.Drawing.Bitmap 512, 512
$graph = [System.Drawing.Graphics]::FromImage($bmp)
$graph.DrawImage($img, 0, 0, 512, 512)
$bmp.Save($iconDest, [System.Drawing.Imaging.ImageFormat]::Png)
$img.Dispose()
$bmp.Dispose()
$graph.Dispose()

$featPath = "C:\Users\ojass\.gemini\antigravity\brain\a55a058f-6c76-4b67-8846-db4ac805bc0d\saarthi_feature_graphic_1783768565515.png"
$featDest = "C:\Users\ojass\.gemini\antigravity\brain\a55a058f-6c76-4b67-8846-db4ac805bc0d\Saarthi_Feature_1024.png"

$featImg = [System.Drawing.Image]::FromFile($featPath)
$featBmp = New-Object System.Drawing.Bitmap 1024, 500
$featGraph = [System.Drawing.Graphics]::FromImage($featBmp)
# Center crop the 1024x1024 image to 1024x500
$srcRect = New-Object System.Drawing.Rectangle 0, 262, 1024, 500
$destRect = New-Object System.Drawing.Rectangle 0, 0, 1024, 500
$featGraph.DrawImage($featImg, $destRect, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)
$featBmp.Save($featDest, [System.Drawing.Imaging.ImageFormat]::Png)
$featImg.Dispose()
$featBmp.Dispose()
$featGraph.Dispose()
