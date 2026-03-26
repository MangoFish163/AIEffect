# 修复文件编码为 UTF-8 with BOM
$content = Get-Content 'script/start-dev.ps1' -Raw -Encoding UTF8
$utf8Bom = New-Object System.Text.UTF8Encoding $true
[System.IO.File]::WriteAllText('script/start-dev.ps1', $content, $utf8Bom)
Write-Host "编码修复完成"
