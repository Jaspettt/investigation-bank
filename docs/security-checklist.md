# Security Checklist

```bash
go test ./...
go build ./...
govulncheck ./...
gosec ./...
```

If `govulncheck` or `gosec` are missing:

```bash
go install golang.org/x/vuln/cmd/govulncheck@latest
go install github.com/securego/gosec/v2/cmd/gosec@latest
```

# SAST

& "C:\Users\Kosin\goProjs\bin\gosec.exe" ./...

# SCA

$env:GOTOOLCHAIN='go1.25.9'

go install golang.org/x/vuln/cmd/govulncheck@latest
& "C:\Users\Kosin\goProjs\bin\govulncheck.exe" ./...
