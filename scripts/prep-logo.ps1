Add-Type -AssemblyName System.Drawing

function Process-Logo([string]$srcPath, [string]$destPath, [bool]$forDark) {
  $src = [System.Drawing.Bitmap]::FromFile($srcPath)
  $w = $src.Width
  $h = $src.Height
  $minX = $w; $minY = $h; $maxX = 0; $maxY = 0
  for ($y = 0; $y -lt $h; $y++) {
    for ($x = 0; $x -lt $w; $x++) {
      $c = $src.GetPixel($x, $y)
      if ($c.R -lt 245 -or $c.G -lt 245 -or $c.B -lt 245) {
        if ($x -lt $minX) { $minX = $x }
        if ($y -lt $minY) { $minY = $y }
        if ($x -gt $maxX) { $maxX = $x }
        if ($y -gt $maxY) { $maxY = $y }
      }
    }
  }
  $pad = 8
  $minX = [Math]::Max(0, $minX - $pad)
  $minY = [Math]::Max(0, $minY - $pad)
  $maxX = [Math]::Min($w - 1, $maxX + $pad)
  $maxY = [Math]::Min($h - 1, $maxY + $pad)
  $cw = $maxX - $minX + 1
  $ch = $maxY - $minY + 1
  $out = New-Object System.Drawing.Bitmap $cw, $ch
  $out.SetResolution($src.HorizontalResolution, $src.VerticalResolution)
  for ($y = 0; $y -lt $ch; $y++) {
    for ($x = 0; $x -lt $cw; $x++) {
      $c = $src.GetPixel($minX + $x, $minY + $y)
      if ($c.R -gt 242 -and $c.G -gt 242 -and $c.B -gt 242) {
        $out.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(0, 255, 255, 255))
      } elseif ($forDark) {
        if ($c.B -gt ($c.R + 25) -and $c.B -gt ($c.G + 10)) {
          $out.SetPixel($x, $y, $c)
        } else {
          $out.SetPixel($x, $y, [System.Drawing.Color]::FromArgb($c.A, 255, 255, 255))
        }
      } else {
        $out.SetPixel($x, $y, $c)
      }
    }
  }
  $src.Dispose()
  $out.Save($destPath, [System.Drawing.Imaging.ImageFormat]::Png)
  $out.Dispose()
}

$root = "c:\Users\juanm\Documents\@Desarrollo\RRHH"
Process-Logo "$root\logo.png" "$root\public\logo.png" $false
Process-Logo "$root\logo.png" "$root\public\logo-light.png" $true
Copy-Item -Force "$root\public\logo.png" "$root\src\app\icon.png"
Copy-Item -Force "$root\public\logo.png" "$root\src\app\apple-icon.png"
Write-Output "done"
