# Meta-Repo Scaffold Templates

These templates are used by `dt catalog scaffold` to generate the meta-repo directory layout.

## Files Generated

| File              | Purpose                                 |
| ----------------- | --------------------------------------- |
| `architecture.md` | High-level architectural overview       |
| `domains.md`      | Business domain registry                |
| `glossary.md`     | Canonical term definitions              |
| `conventions.md`  | Shared development conventions          |
| `platform.yaml`   | Platform/infrastructure configuration   |
| `registry.yaml`   | Service registry for `dt catalog build` |

## Directories Generated

| Directory             | Purpose                       |
| --------------------- | ----------------------------- |
| `adr/`                | Architecture Decision Records |
| `catalog/`            | Generated catalog output      |
| `catalog/flows/`      | Flow definitions              |
| `catalog/components/` | Mirrored component manifests  |
| `schemas/`            | Shared JSON schemas           |

## CI Templates

| File                      | Purpose                                   |
| ------------------------- | ----------------------------------------- |
| `catalog-rebuild.yml`     | GitHub Actions scheduled rebuild workflow |
| `bitbucket-pipelines.yml` | Bitbucket Pipelines scheduled rebuild     |

## Usage

```bash
# Generate scaffold in current directory
dt catalog scaffold

# Generate scaffold in a specific directory
dt catalog scaffold --out ./my-meta-repo

# Overwrite existing files
dt catalog scaffold --out ./my-meta-repo --force
```
