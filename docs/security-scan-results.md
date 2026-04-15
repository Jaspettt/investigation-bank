# Security Scan Results

Date: 2026-04-11

## SAST (`gosec`)

Command:

```bash
gosec ./...
```

Result:

- Issues: `0`
- Status: `PASS`

## SCA (`govulncheck`)

Command:

```bash
govulncheck ./...
```

Current environment note:

- Scanner failed due to local Go toolchain mismatch in this machine (`application built with go1.24`, module requires `go1.25`).
- This is an environment/tooling issue, not an application finding.

To run:

```bash
go toolchain install go1.25.9
go env -w GOTOOLCHAIN=go1.25.9
govulncheck ./...
```
