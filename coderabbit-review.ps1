# CodeRabbit Full Repository Review Script
# Reviews each commit sequentially from oldest to newest (no overlap, no gaps)
#
# Usage: .\coderabbit-review.ps1
#        .\coderabbit-review.ps1 -MaxCommits 10       # only last 10 commits
#        .\coderabbit-review.ps1 -SleepSeconds 90     # wait between reviews
#        .\coderabbit-review.ps1 -MaxRetries 5        # retries on failure
#        .\coderabbit-review.ps1 -StartFrom 50        # resume from commit #50

param(
    [int]$MaxCommits = 0,
    [int]$SleepSeconds = 90,
    [int]$MaxRetries = 3,
    [int]$StartFrom = 1
)

# Ensure we're in a git repo
if (-not (Test-Path .git)) {
    Write-Host "ERROR: Not a git repository. Run this from your project root." -ForegroundColor Red
    exit 1
}

# Get all commit hashes oldest-to-newest
$commits = @(git rev-list --reverse HEAD)
$total = $commits.Count
Write-Host "Total commits in repo: $total" -ForegroundColor Cyan

if ($MaxCommits -gt 0 -and $MaxCommits -lt $total) {
    $commits = $commits[($total - $MaxCommits)..($total - 1)]
    $total = $commits.Count
    Write-Host "Limiting review to last $MaxCommits commits" -ForegroundColor Cyan
}

$reviewCount = $total - 1
$failed = @()
$startTime = Get-Date

Write-Host "Will review $reviewCount commits (sleep ${SleepSeconds}s between each)" -ForegroundColor Cyan
Write-Host "Estimated time: ~$([math]::Round(($reviewCount * ($SleepSeconds + 30)) / 60, 0)) minutes" -ForegroundColor Cyan

if ($StartFrom -gt 1) {
    Write-Host "Resuming from commit #$StartFrom" -ForegroundColor Yellow
}

for ($i = $StartFrom; $i -lt $total; $i++) {
    $baseHash = $commits[$i - 1]
    $currentHash = $commits[$i]
    $commitMsg = git log --oneline -1 $currentHash

    Write-Host "`n[$i/$reviewCount] Reviewing: $commitMsg" -ForegroundColor Yellow
    Write-Host "  Base: $($baseHash.Substring(0,7)) -> Current: $($currentHash.Substring(0,7))" -ForegroundColor DarkGray

    $success = $false
    $attempt = 0

    while (-not $success -and $attempt -lt $MaxRetries) {
        $attempt++

        if ($attempt -gt 1) {
            Write-Host "  Retry $attempt/$MaxRetries after rate limit wait..." -ForegroundColor DarkYellow
            Start-Sleep -Seconds 360  # 6 min wait on retry (rate limit recovery)
        }

        $output = coderabbit review --prompt-only --type committed --base-commit $baseHash 2>&1
        $outputStr = $output -join "`n"

        if ($LASTEXITCODE -eq 0) {
            $success = $true
            Write-Host "  OK" -ForegroundColor Green
        } elseif ($outputStr -match "Rate limit") {
            Write-Host "  Rate limited. Will retry..." -ForegroundColor DarkYellow
        } else {
            Write-Host "  FAILED: $($outputStr | Select-Object -Last 3)" -ForegroundColor Red
            break  # Non-rate-limit error, skip retries
        }
    }

    if (-not $success) {
        $failed += "[$i] $commitMsg"
    }

    # Wait between reviews (skip on last)
    if ($i -lt $reviewCount) {
        Write-Host "  Waiting ${SleepSeconds}s..." -ForegroundColor DarkGray
        Start-Sleep -Seconds $SleepSeconds
    }
}

# Summary
$elapsed = (Get-Date) - $startTime
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host " DONE" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Reviewed: $reviewCount commits in $([math]::Round($elapsed.TotalMinutes, 1)) minutes"

if ($failed.Count -gt 0) {
    Write-Host "`nFailed ($($failed.Count)):" -ForegroundColor Red
    $failed | ForEach-Object { Write-Host "  - $_" -ForegroundColor Red }
    Write-Host "`nTo retry failed commits, re-run with -StartFrom N" -ForegroundColor Yellow
} else {
    Write-Host "All commits reviewed successfully." -ForegroundColor Green
}
