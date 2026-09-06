<#
.SYNOPSIS
部署脚本，支持3种模式：all / backend / frontend
all: 更新backend+frontend
backend:仅更新backend
frontend:仅更新frontend
1.复制指定目录到本地git仓库E:\Workspace\codenote
2.git add / commit(运行时输入注释) / push
3.plink/pscp上传到远程服务器执行docker‑compose
#>
# ====================== 编码修复：放在脚本最开头 ======================
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
$env:LANG = "zh_CN.UTF‑8"
# ====================================================================

# ====================== 配置区，在这里修改所有参数 ======================
# 部署模式可选值： all | backend | frontend
$DeployMode        = "all"

$LocalBackendPath  = "C:\Users\admin\AppData\Roaming\TRAE SOLO CN\ModularData\ai-agent\work-mode-projects\6a9265097db7f0ef5ac0b8da\backend"
$LocalFrontendPath = "C:\Users\admin\AppData\Roaming\TRAE SOLO CN\ModularData\ai-agent\work-mode-projects\6a9265097db7f0ef5ac0b8da\frontend"
$GitWorkspace      = "E:\Workspace\codenote"   #本地git仓库目录
$RemoteHost        = "192.168.1.109"
$RemoteUser        = "root"
$RemotePassword    = "123456"
$RemoteBaseDir     = "/v1/codenote"
# ======================================================================

#region 模式校验
$allowModes = @("all","backend","frontend")
if(-not ($allowModes -contains $DeployMode)){
    Write-Error "DeployMode 模式错误！可选：all / backend / frontend"
    pause
    exit 10
}
Write-Host "🚀 当前部署模式：$DeployMode" -ForegroundColor Cyan
#endregion

#region 目录校验
# 根据模式按需校验源目录
if( ($DeployMode -eq "all") -or ($DeployMode -eq "backend") ){
    if (-not (Test-Path $LocalBackendPath -PathType Container)) {
        Write-Error "Backend目录不存在: $LocalBackendPath"
        pause
        exit 1
    }
}
if( ($DeployMode -eq "all") -or ($DeployMode -eq "frontend") ){
    if (-not (Test-Path $LocalFrontendPath -PathType Container)) {
        Write-Error "Frontend目录不存在: $LocalFrontendPath"
        pause
        exit 1
    }
}
if (-not (Test-Path $GitWorkspace -PathType Container)) {
    Write-Error "Git仓库目录不存在: $GitWorkspace"
    pause
    exit 1
}
Write-Host "✅ 本地目录校验通过" -ForegroundColor Cyan
#endregion

#region 步骤A：选择性复制文件到Git仓库
Write-Host "`n[A] 复制文件到本地Git仓库 $GitWorkspace" -ForegroundColor Cyan
$destBackend = Join-Path $GitWorkspace "backend"
$destFrontend = Join-Path $GitWorkspace "frontend"

if( ($DeployMode -eq "all") -or ($DeployMode -eq "backend") ){
    Write-Host "👉 复制 backend"
    if(Test-Path $destBackend){
        Remove-Item $destBackend -Recurse -Force
    }
    Copy-Item -Path $LocalBackendPath -Destination $GitWorkspace -Recurse -Force
}

if( ($DeployMode -eq "all") -or ($DeployMode -eq "frontend") ){
    Write-Host "👉 复制 frontend"
    if(Test-Path $destFrontend){
        Remove-Item $destFrontend -Recurse -Force
    }
    Copy-Item -Path $LocalFrontendPath -Destination $GitWorkspace -Recurse -Force
}
Write-Host "✅ 文件复制完成" -ForegroundColor Cyan
#endregion

#region 步骤B：Git操作，运行时输入commit注释
Write-Host "`n[B] 执行Git提交" -ForegroundColor Cyan
Set-Location $GitWorkspace
$commitMsg = Read-Host -Prompt "请输入git commit注释信息"
if([string]::IsNullOrWhiteSpace($commitMsg)){
    Write-Warning "commit注释为空，跳过git提交"
}
else{
    git -c core.safecrlf=false -c core.autocrlf=false add . 2>&1
    git -c core.safecrlf=false -c core.autocrlf=false commit -m "$commitMsg" 2>&1
    git push
    if ($LASTEXITCODE -ne 0) {
        Write-Warning "git操作返回非0，请检查git输出"
    }
}
#endregion

#region 步骤C：远程docker‑compose down
Write-Host "`n[C] 远程执行 docker-compose down" -ForegroundColor Cyan
$cmdDown = "cd $RemoteBaseDir ; docker-compose down 2>&1"
& plink.exe -batch -utf8 -pw $RemotePassword "$RemoteUser@$RemoteHost" $cmdDown
if ($LASTEXITCODE -ne 0) {
    Write-Warning "docker-compose down 返回非0，容器可能未运行，继续"
}
#endregion

#region 步骤D：选择性上传
Write-Host "`n[D] 开始上传文件到服务器" -ForegroundColor Cyan
if( ($DeployMode -eq "all") -or ($DeployMode -eq "backend") ){
    Write-Host "👉 上传 backend"
    & pscp.exe -batch -utf8 -pw $RemotePassword -r $destBackend "$RemoteUser@$RemoteHost`:$RemoteBaseDir/"
    if ($LASTEXITCODE -ne 0) {
        Write-Error "backend上传失败"
        pause
        exit 2
    }
}
if( ($DeployMode -eq "all") -or ($DeployMode -eq "frontend") ){
    Write-Host "👉 上传 frontend"
    & pscp.exe -batch -utf8 -pw $RemotePassword -r $destFrontend "$RemoteUser@$RemoteBaseDir/"
    if ($LASTEXITCODE -ne 0) {
        Write-Error "frontend上传失败"
        pause
        exit 3
    }
}
#endregion

#region 步骤F：build && up‑d
Write-Host "`n[F] 执行 docker-compose build --no-cache && docker-compose up -d" -ForegroundColor Cyan
$cmdDeploy = "cd $RemoteBaseDir ; docker-compose build --no-cache && docker-compose up -d 2>&1"
& plink.exe -batch -utf8 -pw $RemotePassword "$RemoteUser@$RemoteHost" $cmdDeploy
if ($LASTEXITCODE -ne 0) {
    Write-Error "部署执行失败"
    pause
    exit 4
}
#endregion

Write-Host "`n🎉 全部任务执行完成" -ForegroundColor Green
pause
