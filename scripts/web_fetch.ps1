<#
web_fetch.ps1 — 走 Windows 网络栈做 web fetch (Invoke-WebRequest)
支持: GET 单 URL, 返回 body (HTML / text)
不走 firecrawl, 不依赖 WSL 网络
#>

param(
    [Parameter(Mandatory=$true)][string]$Url,
    [int]$TimeoutSec = 15,
    [int]$MaxBytes = 5242880  # 5 MB
)

$ErrorActionPreference = "Stop"
$result = @{
    url = $Url
    ok = $false
    status = 0
    bytes = 0
    body = ""
    contentType = ""
    error = $null
}

try {
    $req = [System.Net.HttpWebRequest]::Create($Url)
    $req.Timeout = $TimeoutSec * 1000
    $req.ReadWriteTimeout = $TimeoutSec * 1000
    $req.UserAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    $req.AllowAutoRedirect = $true
    $req.Headers.Add("Accept-Language", "zh-CN,zh;q=0.9,en;q=0.8")

    $resp = $req.GetResponse()
    $result.status = [int]$resp.StatusCode
    $result.contentType = $resp.ContentType

    $stream = $resp.GetResponseStream()
    $ms = New-Object System.IO.MemoryStream
    $stream.CopyTo($ms)
    $bytes = $ms.ToArray()
    $result.bytes = $bytes.Length

    if ($bytes.Length -gt $MaxBytes) {
        $result.body = [System.Text.Encoding]::UTF8.GetString($bytes[0..$MaxBytes]) + "\n[TRUNCATED at $MaxBytes bytes]"
    } else {
        $result.body = [System.Text.Encoding]::UTF8.GetString($bytes)
    }
    $result.ok = ($result.status -ge 200 -and $result.status -lt 400)
} catch [System.Net.WebException] {
    $result.error = $_.Exception.Message
    if ($_.Exception.Response) {
        $result.status = [int]$_.Exception.Response.StatusCode
    }
} catch {
    $result.error = $_.Exception.Message
}

$result | ConvertTo-Json -Depth 3 -Compress
