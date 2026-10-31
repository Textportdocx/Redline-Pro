# Redline Pro - free self-signing (Redline Studio - textportdocx.in)
# Run in PowerShell next to the .exe files:  powershell -ExecutionPolicy Bypass -File Sign-RedlinePro.ps1
$ErrorActionPreference = 'Stop'
$subject = 'CN=Redline Studio, O=Redline Studio, L=textportdocx.in, C=IN'
$pfx = Join-Path $PSScriptRoot 'RedlineStudio-CodeSign.pfx'
$cer = Join-Path $PSScriptRoot 'RedlineStudio-CodeSign.cer'
$cert = Get-ChildItem Cert:\CurrentUser\My -CodeSigningCert | Where-Object { $_.Subject -eq $subject } | Select-Object -First 1
if (-not $cert) {
  Write-Host 'Creating Redline Studio signing certificate (valid 5 years)...'
  $cert = New-SelfSignedCertificate -Type CodeSigningCert -Subject $subject -KeyAlgorithm RSA -KeyLength 3072 `
    -HashAlgorithm SHA256 -CertStoreLocation Cert:\CurrentUser\My -NotAfter (Get-Date).AddYears(5)
  $pw = Read-Host 'Choose a password to back up the certificate' -AsSecureString
  Export-PfxCertificate -Cert $cert -FilePath $pfx -Password $pw | Out-Null
  Export-Certificate -Cert $cert -FilePath $cer | Out-Null
  Write-Host "Backup saved: $pfx  (keep it private!)"
}
Get-ChildItem $PSScriptRoot -Filter 'RedlinePro-*.exe' | ForEach-Object {
  Write-Host "Signing $($_.Name)..."
  $r = Set-AuthenticodeSignature -FilePath $_.FullName -Certificate $cert -HashAlgorithm SHA256 -TimestampServer 'http://timestamp.digicert.com'
  Write-Host "  -> $($r.Status)"
  $h = (Get-FileHash $_.FullName -Algorithm SHA256).Hash
  "$h  $($_.Name)" | Add-Content (Join-Path $PSScriptRoot 'SHA256SUMS.txt')
}
Write-Host ''
Write-Host 'Done. Publish SHA256SUMS.txt on textportdocx.in. Next (free): upload each exe at'
Write-Host 'https://www.microsoft.com/en-us/wdsi/filesubmission  (Software developer -> "Incorrectly detected").'
