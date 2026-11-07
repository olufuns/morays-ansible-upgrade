# Automatic publication and recovery of the Morays website

Your **Morays Cloud DevOps Upgrade** website is still stored in `site/` and deployed to running EC2 servers with `playbook.yml`. This update also makes it possible for **new Auto Scaling servers** to configure themselves without running Ansible manually.

## Standard deployment (with working SSH)

```bash
cd ~/morays-project/morays-ansible-ha
./scripts/deploy.sh
```

The command:
1. Publishes an immutable SHA256-named copy of your HTML, CSS, JS and health endpoint to the private S3 bucket created by Terraform.
2. Updates S3 `current.txt` only after all assets have uploaded.
3. Runs the existing Ansible playbook against the already-running EC2 instances, one instance at a time.

## Deployment when SSH is not available (SSM only)

```bash
cd ~/morays-project/morays-ansible-ha
./scripts/publish_site.sh
```

With this command, you do **not** need `olu1.pem` or inbound SSH access. Your local AWS identity needs S3 upload permission to the bucket. The Systems Manager State Manager association will apply the new release to matching managed EC2 instances on its schedule, and new instances will download the current release at boot.

The SSM approach may take time; it is **not** instantaneous. Check SSM executions and the target group health before declaring success.

## Prerequisites

- Terraform infrastructure created/updated with `site_artifacts.tf` and `ssm_website.tf`.
- Both project folders are siblings: `~/morays-project/morays-terraform-ha` and `~/morays-project/morays-ansible-ha`.
- AWS CLI and Terraform installed in WSL with appropriate credentials/permissions.
- The EC2 instance role can read S3 and use SSM. Servers can reach AWS public endpoints on outbound HTTPS.
- When using the full Ansible playbook, allow SSH **only from your workstation IP** and ensure the correct `olu1.pem` key works.

## Verify a replacement server is automatically deployed

1. After the first successful release, verify `/healthz` is responding on all ALB target instances.
2. Enable `enable_elb_health_checks = true` in the Terraform `.tfvars`, review and apply the plan.
3. In a **test** environment, use an ASG instance replacement or a controlled scale-out to bring up another instance.
4. Do **not** rerun Ansible. Wait for the new target to become healthy and verify the new server's web application. This confirms the startup/State Manager workflow.

The current release ID can be read on a running server at `/var/www/html/.morays-release`. Each uploaded version lives in the private bucket under `releases/<sha256>/`, making it possible to publish or roll back without building a new EC2 AMI.
