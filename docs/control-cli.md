# PrintHub automation control CLI

The `printhub` control CLI wraps the existing bridge HTTP and WebSocket services. It is separate from the existing offline print-analysis CLI. It does not start a server, add MCP, or contact a physical printer. Node 20+ is required.

## Build and isolated development server

```sh
pnpm install --frozen-lockfile
pnpm test:control
VPH_HOST=127.0.0.1 VPH_MDNS=0 VPH_HTTP_PORT=18081 VPH_TCP_PORT=19100 node packages/bridge/dist/cli.js
```

Use unused ports. Never point tests at a running user's hub. `VPH_HOST` sets the bridge listener; `VPH_MDNS=0` disables advertisement. Existing defaults remain unchanged: the bridge normally listens on `0.0.0.0`, advertises mDNS, permits CORS `*`, and has no HTTP authentication. A CLI URL of `localhost` does **not** restrict server exposure. Do not expose this unauthenticated service to an untrusted network. Only use trusted hub origins. The client rejects credentials in URLs and HTTP redirects.

## Commands

Use the built entry point for machine consumption (package-manager wrappers may print extra stdout):

```sh
node packages/bridge/dist/control-cli.js --help
node packages/bridge/dist/control-cli.js schema
node packages/bridge/dist/control-cli.js health --url http://127.0.0.1:18081
node packages/bridge/dist/control-cli.js status --url http://127.0.0.1:18081
node packages/bridge/dist/control-cli.js config-get --url http://127.0.0.1:18081
node packages/bridge/dist/control-cli.js config-set --args '{"scenario":"paper-out"}' --url http://127.0.0.1:18081
node packages/bridge/dist/control-cli.js print-raw --file receipt.bin --wait --request-id receipt-test-1 --url http://127.0.0.1:18081
node packages/bridge/dist/control-cli.js print-image --file label.png --protocol tspl --width 384 --wait --url http://127.0.0.1:18081
node packages/bridge/dist/control-cli.js jobs-wait --job-id job-ID --timeout-ms 5000 --url http://127.0.0.1:18081
```

`--timeout-ms` bounds the whole network operation, default 10000, range 1–300000. SIGINT/SIGTERM cancel observation and abort in-flight HTTP; cancellation cannot undo an already accepted job or configuration change. Print files must be regular files of 1 byte–20 MiB. Raw bytes are preserved exactly. Image capture is the existing converter's generated print payload, not the uploaded image bytes. `--width` is 1–4096. Unknown, duplicate, or command-inappropriate flags fail as invalid usage.

`jobs-wait` observes **new events only**, with an optional exact job ID. There is no server history lookup or durable replay. Without an ID it returns the first job observed after subscribing. `print-* --wait` subscribes before submitting and checks the WebSocket hub instance, then correlates the returned HTTP `jobId` to the complete event. Small and chunked payloads are reassembled and validated; missing, repeated, malformed or oversized chunks fail closed. Capture memory is bounded (20 MiB per job, 40 MiB aggregate bytes, at most 32 jobs/incomplete assemblies). Busy unrelated traffic can exceed those limits; use an isolated hub for deterministic tests.

The HTTP raw path applies print rejection but does not simulate TCP timing/ACK delays. The image HTTP path also bypasses some simulation faults. Use the actual TCP path to test device timing, polls, ACKs and connection behavior. A successful capture means the **virtual bridge** processed and broadcast bytes, never that a receipt physically printed.

## Safe configuration backup and restore

```sh
node packages/bridge/dist/control-cli.js config-backup --file run-backup.json --url http://127.0.0.1:18081
# Read hubInstanceId and revision from that response; replace the example values below.
node packages/bridge/dist/control-cli.js config-set --args '{"scenario":"slow","printDelayMs":1000}' --hub-instance-id INSTANCE_FROM_BACKUP --expected-revision 0 --url http://127.0.0.1:18081
# Use the revision returned by your successful config-set, not a freshly fetched revision.
node packages/bridge/dist/control-cli.js config-restore --file run-backup.json --expected-revision 1 --url http://127.0.0.1:18081
```

Backup exclusively creates a file (mode `0600` where supported); it never overwrites an existing backup. The file contains `{schemaVersion:1, origin, hubInstanceId, revision, config}`. Both backup stdout and `config-get` return the snapshot; backup also includes `file`.

The new `/sim/config/snapshot` and `/sim/config/compare-and-set` routes delegate to the existing configuration service. All writers through `setPrinterSimConfig`, including legacy HTTP/UI writers, increment a process-local revision. Compare-and-set checks instance and revision synchronously before changing configuration, preventing check/write races. Changes may disconnect TCP clients when the scenario becomes offline, just as in the existing UI.

`config-set` without preconditions takes a current snapshot then uses CAS, suitable for an intentional interactive change. For an automated backup/change/restore workflow, pass the backup's explicit `--hub-instance-id` and `--expected-revision`; do not fetch a newer baseline and overwrite an intervening change. Supported scenarios are `normal`, `paper-out`, `cover-open`, `offline`, `slow`, `reject-job`. Other fields are `statusDelayMs` (0–30000), `printDelayMs` (0–60000), `blockPrintOnFault`, `rejectPrint`, and `logEvents` (booleans).

Restore checks the backup origin and instance and requires an explicit expected current revision. A restart or concurrent modification causes `CONFIG_CONFLICT`; it will not overwrite the newer state. After a timeout/unknown config-set outcome, do not guess a restore revision or fetch one merely to force restoration. Inspect the hub and decide whether the state is yours to change. A backup is not a lease, and request IDs are not idempotency keys.

## Machine contract and failure handling

All commands except help emit exactly one JSON object on stdout:

```json
{"schemaVersion":1,"requestId":"receipt-test-1","ok":true,"result":{"jobId":"job-ID","hubInstanceId":"INSTANCE","job":{"id":"job-ID","byteLength":42},"payloadBase64":"..."}}
```

The example job metadata is abbreviated. `--wait` includes full bridge metadata, exact captured `payloadBase64`, and both HTTP `jobId` and observed `job.id`. Without `--wait`, print returns the HTTP acceptance object. Error shape:

```json
{"schemaVersion":1,"requestId":"receipt-test-1","ok":false,"error":{"code":"RESULT_UNKNOWN","message":"Print accepted but capture was not confirmed; do not blindly retry","details":{"jobId":"job-ID"},"jobId":"job-ID"}}
```

Exit codes: 0 success; 1 execution/HTTP/conflict/capture failure; 2 invalid usage; 3 unknown mutation/capture outcome; 130 SIGINT; 143 SIGTERM. Common codes include `INVALID_ARGUMENT`, `CONFIG_CONFLICT`, `HTTP_ERROR`, `CONNECTION_FAILED`, `CONNECTION_CLOSED`, `TIMEOUT`, `CANCELLED`, `INVALID_STREAM`, `CAPTURE_LIMIT`, `INSTANCE_CHANGED`, and `RESULT_UNKNOWN`. An explicit HTTP failure does not guarantee all side effects were absent (for example, cash-drawer commands may be scanned before rejection).

The client never retries a print POST or config mutation automatically. Dropped, malformed, or oversized successful mutation responses are unknown outcomes, not acknowledgements. A failed wait after accepted print is also unknown observation outcome and includes the accepted job ID. Inspect existing hub UI/history or your retained capture evidence before deciding to resubmit; the CLI cannot query historical jobs. `requestId` is caller correlation only, not durable server-side deduplication. Preserve output and exit status, and keep sensitive receipt payloads out of logs/public repositories.

## Verification

`pnpm test:control` builds prerequisites and runs existing bridge tests plus control integration tests. Fixtures use temporary directories and ephemeral loopback HTTP/WebSocket servers around the real bridge methods. Coverage includes raw/image submission, pre-response capture and chunk assembly, config backup/CAS/conflict/instance protection, malformed streams, timeout/cancellation, explicit rejection, lost responses, malformed acknowledgements and bounded response reading. They do not need a running hub, network printer, or physical device.
