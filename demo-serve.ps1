# Static preview server for PCs without Node.js (demo mode: records stay in each browser)
#   powershell -ExecutionPolicy Bypass -File demo-serve.ps1   -> http://localhost:8090
param([int]$Port = 8090)
$root = $PSScriptRoot
$types = @{ ".html" = "text/html; charset=utf-8"; ".js" = "text/javascript; charset=utf-8"; ".css" = "text/css; charset=utf-8" }
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
$listener.Start()
Write-Host "Demo preview: http://localhost:$Port/  (admin: /admin.html)"
while ($listener.IsListening) {
  $ctx = $listener.GetContext()
  $rel = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath.TrimStart('/'))
  if ($rel -eq "") { $rel = "index.html" }
  $file = [IO.Path]::GetFullPath((Join-Path $root $rel))
  $res = $ctx.Response
  if ($file.StartsWith($root) -and (Test-Path $file -PathType Leaf) -and $types.ContainsKey([IO.Path]::GetExtension($file))) {
    $bytes = [IO.File]::ReadAllBytes($file)
    $res.ContentType = $types[[IO.Path]::GetExtension($file)]
    $res.OutputStream.Write($bytes, 0, $bytes.Length)
  } else { $res.StatusCode = 404 }
  $res.Close()
}
