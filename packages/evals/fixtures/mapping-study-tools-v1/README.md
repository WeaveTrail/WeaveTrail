# Authored mapping-study tool controls

These controls test recording contracts, scoring, selection and family analysis.
They are **not model measurements**, approved selection records, independently
reviewed evaluation inputs or evidence of AI gains. All data and tariffs are
synthetic; latencies are authored test values. Status stays `UNSEALED` and the
protocol is `PLANNED`.

`SELECT/` uses the draft SELECT inputs; `AUDIT/` uses the first two authored
families per stratum. `scripts/capture-mapping-study-controls.mts` derives the
bytes from `mapping-study-v1`, frozen DEV B0/B1 configurations and explicit control
assignments. Reproduction, metrics and limitations are documented in
[the tool guide](../../../../docs/MAPPING_STUDY_TOOLS.md).

Captured on Linux x64, Node.js 22.18.0, pnpm 10.33.2. Expected JSON is canonical
with a trailing newline; golden checks never overwrite it. The B1 development
summary's source checksum is refreshed when its shared scorer is exported;
its records, arithmetic and counts are unchanged.
