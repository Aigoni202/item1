# 批量压缩图片到 200 KB 以内。
# 默认不覆盖原图，输出到同级 compressed-images 目录。
# 用法：
#   powershell -ExecutionPolicy Bypass -File .\tools\compress-images.ps1
#   powershell -ExecutionPolicy Bypass -File .\tools\compress-images.ps1 -InputRoot .\miniprogram -OutputRoot .\compressed-images

param(
  [string]$InputRoot = ".\miniprogram",
  [string]$OutputRoot = ".\compressed-images",
  [int]$MaxKB = 200,
  [int]$MaxDimension = 1600
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$inputPath = (Resolve-Path -LiteralPath $InputRoot).Path
$outputPath = [System.IO.Path]::GetFullPath((Join-Path (Get-Location) $OutputRoot))
$extensions = @(".jpg", ".jpeg", ".png", ".bmp", ".gif", ".webp")
$maxBytes = $MaxKB * 1024

function Get-JpegCodec {
  return [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() |
    Where-Object { $_.MimeType -eq "image/jpeg" } |
    Select-Object -First 1
}

function Save-JpegUnderLimit {
  param(
    [System.Drawing.Image]$Image,
    [string]$Destination,
    [int]$LimitBytes,
    [int]$Dimension
  )

  $scale = [Math]::Min(
    1.0,
    [Math]::Min($Dimension / [double]$Image.Width, $Dimension / [double]$Image.Height)
  )
  $width = [Math]::Max(1, [int][Math]::Round($Image.Width * $scale))
  $height = [Math]::Max(1, [int][Math]::Round($Image.Height * $scale))
  $codec = Get-JpegCodec

  # 通过质量二分搜索，在尽量保留清晰度的同时控制文件大小。
  $bestBytes = $null
  $bestQuality = 0
  $qualityLow = 35
  $qualityHigh = 92

  for ($attempt = 0; $attempt -lt 8; $attempt++) {
    $quality = [int][Math]::Floor(($qualityLow + $qualityHigh) / 2)
    $bitmap = New-Object System.Drawing.Bitmap(
      $width,
      $height,
      [System.Drawing.Imaging.PixelFormat]::Format24bppRgb
    )
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.Clear([System.Drawing.Color]::White)
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $graphics.DrawImage($Image, 0, 0, $width, $height)

    $temp = Join-Path ([System.IO.Path]::GetTempPath()) ([System.Guid]::NewGuid().ToString() + ".jpg")
    $parameters = New-Object System.Drawing.Imaging.EncoderParameters(1)
    $parameters.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter(
      [System.Drawing.Imaging.Encoder]::Quality,
      [int64]$quality
    )
    $bitmap.Save($temp, $codec, $parameters)
    $graphics.Dispose()
    $bitmap.Dispose()
    $parameters.Dispose()

    $bytes = (Get-Item -LiteralPath $temp).Length
    if ($bytes -le $LimitBytes) {
      $bestBytes = $bytes
      $bestQuality = $quality
      $qualityLow = $quality + 1
      Remove-Item -LiteralPath $temp -Force
    } else {
      $qualityHigh = $quality - 1
      Remove-Item -LiteralPath $temp -Force
    }
  }

  if ($null -eq $bestBytes) {
    throw "无法将图片压缩到 $MaxKB KB 以内：$($Image.Width)x$($Image.Height)"
  }

  $bitmap = New-Object System.Drawing.Bitmap(
    $width,
    $height,
    [System.Drawing.Imaging.PixelFormat]::Format24bppRgb
  )
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.Clear([System.Drawing.Color]::White)
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $graphics.DrawImage($Image, 0, 0, $width, $height)
  $parameters = New-Object System.Drawing.Imaging.EncoderParameters(1)
  $parameters.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter(
    [System.Drawing.Imaging.Encoder]::Quality,
    [int64]$bestQuality
  )
  $bitmap.Save($Destination, $codec, $parameters)
  $parameters.Dispose()
  $graphics.Dispose()
  $bitmap.Dispose()
}

$files = Get-ChildItem -LiteralPath $inputPath -Recurse -File |
  Where-Object {
    $extensions -contains $_.Extension.ToLowerInvariant() -and $_.Length -gt $maxBytes
  }

if (!$files) {
  Write-Output "没有超过 $MaxKB KB 的图片。"
  exit 0
}

foreach ($file in $files) {
  $relative = $file.FullName.Substring($inputPath.Length).TrimStart("\/")
  $destination = Join-Path $outputPath ([System.IO.Path]::ChangeExtension($relative, ".jpg"))
  $destinationDirectory = Split-Path -Parent $destination
  New-Item -ItemType Directory -Path $destinationDirectory -Force | Out-Null

  $image = [System.Drawing.Image]::FromFile($file.FullName)
  try {
    Save-JpegUnderLimit -Image $image -Destination $destination -LimitBytes $maxBytes -Dimension $MaxDimension
  } finally {
    $image.Dispose()
  }

  $result = Get-Item -LiteralPath $destination
  Write-Output ("{0} -> {1} KB" -f $file.FullName, [Math]::Round($result.Length / 1KB, 1))
}
