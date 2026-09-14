---
name: aws-ops
description: "AWS CLI command sets, resource tiers, cost inputs, backup and revert sources, and log table for infra-engineer. Use when planning or applying AWS infrastructure changes."
---

# AWS Operations (aws-ops)

Per-surface mechanism skill for `infra-engineer`. It supplies the AWS CLI command sets, resource tiers, cost inputs, backup and revert sources, and the AWS log table. It does not restate the agent's working loop, approval, revert, or backup rules — those live in the agent body. AWS has no native plan, so this skill provides the synthesized plan inputs: discovery commands, the delta, and the exact forward and revert commands per change kind.

---

> **RFC 2119 Notice:** The key words **MUST**, **MUST NOT**, **REQUIRED**, **SHALL**, **SHALL NOT**, **SHOULD**, **SHOULD NOT**, **RECOMMENDED**, **MAY**, and **OPTIONAL** in this document are to be interpreted as described in [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119).

## Tool declaration

| Field         | Value                                                                                                                                                      |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `name`        | `aws`                                                                                                                                                      |
| `probe`       | `aws --version` (expects `aws-cli/2.x`)                                                                                                                    |
| `floor`       | AWS CLI `2.15` minimum; major `2.x` REQUIRED. A `1.x` install is `below-floor`.                                                                            |
| `auth_probe`  | `aws sts get-caller-identity --output json`                                                                                                                |
| `remediation` | "Install AWS CLI v2 (`2.15`+) from the AWS docs and run `aws configure` or set a named profile; this skill never auto-installs and offers no v1 fallback." |

Any non-`ok` tool-check result blocks the phase with the remediation string. All parseable output uses `--output json`. Identity is asserted by comparing `Account` from `sts get-caller-identity` with the target environment's `aws.account_id`; a mismatch is `wrong-identity` and blocks.

## Resource tiers

| Tier            | AWS resources                                                                                                   |
| --------------- | --------------------------------------------------------------------------------------------------------------- |
| **foundation**  | VPC, subnets, route tables, internet/NAT gateways, ECS cluster, ECR registry, IAM roles/trust, KMS keys         |
| **application** | ECS service, task definition, target group, security group, Secrets Manager secret, ACM certificate, DNS record |

Foundation resources are **discovery-only**: this skill provides no apply commands for them. A foundation change is routed to the environment's `tier0_tool` (cdk, terraform, cloudformation) with `status: routed-to-<tool>`; the agent never writes foundation resources directly.

## Command sets per change kind

Every command references secrets by ARN or name, never by value. Forward and revert are paired so `rollback.sh` can be generated.

### Discover (read-only)

```sh
aws sts get-caller-identity --output json
aws ecs list-clusters --output json
aws ecs list-services --cluster "$CLUSTER" --output json
aws ecs describe-services --cluster "$CLUSTER" --services "$SVC" --output json
aws ecr describe-repositories --output json
aws elbv2 describe-target-groups --output json
aws elbv2 describe-target-health --target-group-arn "$TG_ARN" --output json
aws iam list-attached-role-policies --role-name "$ROLE" --output json
aws secretsmanager list-secrets --output json
aws acm list-certificates --output json
```

### Build and push image (ECR)

- Forward:
  ```sh
  aws ecr get-login-password --region "$REGION" | docker login --username AWS --password-stdin "$ACCOUNT.dkr.ecr.$REGION.amazonaws.com"
  docker build -t "$REPO:$TAG" .
  docker push "$ACCOUNT.dkr.ecr.$REGION.amazonaws.com/$REPO:$TAG"
  ```
- Revert: redeploy the previous image tag (see ECS below); images are immutable, so no delete is required for revert.

### Create and update ECS service and task definition

- Forward:
  ```sh
  aws ecs register-task-definition --cli-input-json file://taskdef.json --output json
  aws ecs update-service --cluster "$CLUSTER" --service "$SVC" --task-definition "$FAMILY:$REV" --output json
  ```
- Verify: `aws ecs describe-services --cluster "$CLUSTER" --services "$SVC" --query 'services[0].deployments' --output json` shows the new revision `PRIMARY` and `runningCount == desiredCount`.
- Revert: `aws ecs update-service --cluster "$CLUSTER" --service "$SVC" --task-definition "$FAMILY:$PREV_REV"` using the **previous task definition revision** recorded before the change.

### IAM policy create and attach

- Forward:
  ```sh
  aws iam create-policy --policy-name "$NAME" --policy-document file://policy.json --output json
  aws iam attach-role-policy --role-name "$ROLE" --policy-arn "$POLICY_ARN"
  ```
- Verify: `aws iam list-attached-role-policies --role-name "$ROLE"` includes the ARN.
- Revert (reverse order): `aws iam detach-role-policy --role-name "$ROLE" --policy-arn "$POLICY_ARN"` then `aws iam delete-policy --policy-arn "$POLICY_ARN"`.

### Secrets Manager (reference by ARN)

- Forward: `aws secretsmanager create-secret --name "$NAME" --secret-string file://value.json` or `put-secret-value`. Consumers reference the secret by its ARN in task definitions; the value is never read into a shell variable that is later echoed.
- Revert: `aws secretsmanager delete-secret --secret-id "$ARN" --recovery-window-in-days 7` (recoverable) or restore the prior version by `put-secret-value` from the source of truth, never from a transcript.

### ACM certificate request and DNS validation

- Forward:
  ```sh
  aws acm request-certificate --domain-name "$FQDN" --validation-method DNS --output json
  aws acm describe-certificate --certificate-arn "$CERT_ARN" --query 'Certificate.DomainValidationOptions' --output json
  ```
  DNS validation records are added through the Cloudflare DNS step in the agent body.
- Revert: `aws acm delete-certificate --certificate-arn "$CERT_ARN"` once no listener references it.

### ALB target health and CloudWatch retention

```sh
aws elbv2 describe-target-health --target-group-arn "$TG_ARN" --output json
aws logs put-retention-policy --log-group-name "$LG" --retention-in-days 30
```

## Cost estimation

`plan.md` lists each resource with a monthly estimate and its source (the AWS pricing page URL or a `aws pricing get-products` call). The always-relevant cost list is stated on every AWS plan even when zero:

- **NAT gateway** — hourly + per-GB processing.
- **Application Load Balancer** — hourly + LCU.
- **RDS instance** — instance-hours + storage + backups.
- **EC2 / Fargate capacity** — vCPU and memory hours.
- **Interface VPC endpoints** — hourly per AZ + per-GB.

Any resource at or above the environment cost threshold is marked `APPROVAL REQUIRED` and approved by name.

## Backup commands and revert sources

| Change kind      | Backup command (production, touches state)                                                              | Revert source                         |
| ---------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| RDS schema/data  | `aws rds create-db-snapshot --db-instance-identifier "$DB" --db-snapshot-identifier "$SNAP"`            | Restore snapshot to a new instance    |
| S3 object change | Confirm versioning: `aws s3api get-bucket-versioning --bucket "$B"`; require `Enabled` before overwrite | Previous object version id            |
| ECS deploy       | Record current task definition revision                                                                 | **Previous task definition revision** |
| Image deploy     | Record current image tag                                                                                | **Previous image tag**                |

A production step with `touches state: yes` records the backup id and restore command in `result.md` before it applies.

## AWS log table

Every query is time-bounded and its output passes through the redaction pattern set before it reaches a transcript or file.

| Source           | Command                                                                                                                                                                    |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CloudWatch Logs  | `aws logs tail "$LG" --since "$START" --format short`                                                                                                                      |
| ECS task failure | `aws ecs describe-tasks --cluster "$CLUSTER" --tasks "$TASK" --query 'tasks[0].stoppedReason'`                                                                             |
| ALB access logs  | Query the S3 access-log prefix for the bounded window                                                                                                                      |
| Logs Insights    | `aws logs start-query --log-group-name "$LG" --start-time "$S" --end-time "$E" --query-string ...` with a **bounded window** and stated scan scope before the billed query |
| VPC Flow Logs    | Filtered by ENI and the bounded window                                                                                                                                     |
| CloudTrail       | `aws cloudtrail lookup-events --start-time "$S" --end-time "$E" --lookup-attributes ...`                                                                                   |
| GitHub Actions   | `gh run view "$RUN" --log-failed`                                                                                                                                          |

## Cost sweep categories (read-only)

- Unassociated Elastic IPs (`eip` addresses with no association).
- Available (unattached) EBS volumes.
- Stale EBS snapshots past a retention age.
- Idle NAT gateways with negligible processed bytes.
- Load balancers with no healthy targets.
- Zero-scaled ECS services still holding a load balancer.
- Resources whose `ExpiresAt` tag is in the past.
- Untagged resources missing environment/owner/ChangeId tags.
- CloudWatch log groups without a retention policy.

Sweep findings are reported, never remediated automatically.
