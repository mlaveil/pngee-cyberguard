# PNGee CyberGuard Endpoint Agent

This directory contains the cross-platform reference endpoint agent used to exercise the durable telemetry contract.

## Runtime

- Node.js 22+
- Windows or Linux
- HTTPS connection to the CyberGuard server
- Enrollment token issued by an administrator

## Configuration

Set:

- `CYBERGUARD_URL` — base URL of the CyberGuard server
- `CYBERGUARD_ENROLLMENT_TOKEN` — one-time enrollment token for first registration
- `CYBERGUARD_AGENT_STATE` — optional path for persisted agent identity; defaults to `~/.pngee-cyberguard/agent.json`
- `CYBERGUARD_HEARTBEAT_SECONDS` — optional heartbeat interval; defaults to the server-advertised 30 seconds

After enrollment the agent persists its endpoint ID, agent ID, and device key locally. The device key is never sent as a header; telemetry requests are authenticated with an HMAC-SHA256 signature.

## Collection

The agent sends:

- signed heartbeat telemetry
- CPU, memory, disk, process-count and logged-in-user system telemetry
- firewall and antivirus status when available from the host OS
- normalized security events from Windows Event Log or Linux journald when available
- periodic service-state telemetry

The collector is intentionally conservative: command failures are treated as unavailable telemetry rather than as a reason to terminate the agent.
