# morays-ansible-upgrade

> **NEW: Auto Scaling replacement servers are automatically configured.** See [AUTOMATIC-DEPLOYMENT.md](AUTOMATIC-DEPLOYMENT.md) for the recommended updated workflow.

# Morays Cloud DevOps Upgrade — Ansible deployment project

This is **the second project** in the Morays Terraform + Ansible portfolio. It uses Ansible to configure the EC2 instances created by the separate **`morays-terraform-ha`** Terraform project and deploy a fully styled, responsive website inspired by the supplied screenshot.

> No AWS resources are created by this repository. Terraform owns infrastructure; Ansible owns configuration. The included website is a new HTML/CSS/JavaScript recreation based on the reference image, **not** an extraction of any unrevealed original source code or user-data script.

## What the site contains

- Purple-to-pink gradient hero and decorative cloud / servers illustration
- Interactive navigation and four information cards
- Visual architecture chain (Terraform → AWS EC2 → Ansible → Apache → Website)
- Four-step reproducibility workflow
- Accessible modal windows and a real `/healthz` website response button
- Mobile-friendly responsive styling with no external CSS or JS dependencies

## How the two projects connect

| Terraform project | Ansible project |
|---|---|
| Provisions VPC, 2 public subnets, ALB, ASG and EC2 Launch Template | Finds EC2 instances using AWS tags and configures them |
| `Project=morays-ha`, `Environment=dev`, `Role=webserver` | `aws_ec2.yml` filters on those exact tags |
| EC2 instances run Amazon Linux 2023 | Installs `httpd` using the `dnf` package manager |
| Application Load Balancer target group checks `/` on port 80 | Copies website into `/var/www/html` and checks HTTP 200 |
| Launch Template uses EC2 key pair `olu1` | `ansible.cfg` expects `~/.ssh/olu1.pem` |
| SSH is **disabled by default** unless `ssh_cidr` is configured | Uses SSH to connect to the public IP of each instance |

### Architecture overview

```text
            Internet visitors
                   |
              HTTP port 80
                   |
        Application Load Balancer (ALB)
             /           \
        AWS AZ A         AWS AZ B
         EC2 #1           EC2 #2
     Apache + site     Apache + site
             \           /
          Auto Scaling Group
            min=2 max=4

        YOUR WSL / Ubuntu terminal
                 |
         Ansible dynamic inventory
        (AWS EC2 tags: morays-ha)
                 |
            SSH via olu1.pem
                 |
      Installs Apache + deploys site
```

## Folder structure

```text
morays-project/
├── morays-terraform-ha/                # PREVIOUS infrastructure project (separate)
└── morays-ansible-ha/                  # THIS project
    ├── ansible.cfg
    ├── aws_ec2.yml
    ├── playbook.yml
    ├── requirements.yml
    ├── .gitignore
    ├── README.md
    └── site/
        ├── index.html
        ├── healthz
        └── assets/
            ├── style.css
            └── app.js
```

## 1. Extract into your existing WSL project

If the ZIP is in Windows Downloads, find your actual Windows user folder and run something like:

```bash
unzip /mnt/c/Users/YOUR_WINDOWS_USERNAME/Downloads/morays-ansible-ha.zip -d ~/morays-project/
cd ~/morays-project/morays-ansible-ha
code .
```

If you downloaded the ZIP directly into your Linux Downloads directory, adjust the file path accordingly. Keep your other Terraform and Ansible folders unchanged.

## 2. Prerequisites

- AWS infrastructure from the **`morays-terraform-ha`** project has been applied in **London `eu-west-2`**.
- At least two EC2 instances have tags `Project=morays-ha`, `Environment=dev` and `Role=webserver`.
- AWS CLI configured with credentials permitted to call `ec2:DescribeInstances`.
- Correct EC2 SSH key at `~/.ssh/olu1.pem` (or adjust `private_key_file` in `ansible.cfg`). Never put a `.pem` file in your repository.
- SSH ingress **port 22** from the actual public IP of your WSL machine is temporarily enabled on the Terraform EC2 security group. The Terraform project's `terraform.tfvars` uses `ssh_cidr = null` by default, which **disables** SSH.
- Instances use Amazon Linux 2023 with `ec2-user`; on a different distribution both username and package name may require adjustment.

**Enable SSH carefully:** In `morays-terraform-ha/terraform.tfvars`, set `ssh_cidr = "YOUR_PUBLIC_IPV4/32"`, then run `terraform plan` and review before `terraform apply` **in that Terraform directory**. Do not use `0.0.0.0/0` for SSH. Check your IP with a trusted tool or network provider. AWS EC2 key pair name `olu1` must correspond to the local `olu1.pem`.

**Install Ansible and AWS SDK dependencies** in Ubuntu 24.04, if needed:

```bash
sudo apt update
sudo apt install -y python3-venv openssh-client
cd ~/morays-project/morays-ansible-ha
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install ansible boto3 botocore
ansible-galaxy collection install -r requirements.yml
ansible --version
aws sts get-caller-identity
```

You can also use an existing working Ansible installation; simply make sure its Python environment includes `boto3` and `botocore`, and the `amazon.aws` collection is installed.

## 3. Check that AWS sees only this project's servers

```bash
aws ec2 describe-instances \
  --region eu-west-2 \
  --filters 'Name=instance-state-name,Values=running' \
            'Name=tag:Project,Values=morays-ha' \
            'Name=tag:Role,Values=webserver' \
  --query 'Reservations[].Instances[].[InstanceId,PublicIpAddress,KeyName]' \
  --output table
```

Then check Ansible discovery:

```bash
ansible-inventory -i aws_ec2.yml --graph
ansible-inventory -i aws_ec2.yml --host YOUR_INSTANCE_HOSTNAME
```

Expected group: `@webserver`. The discovered hosts are the ASG instances that match the project tags. If you changed the Terraform `project_name` or `environment`, update those filters in `aws_ec2.yml` as well.

## 4. Connect over SSH (first-time host key verification)

Check the private key exists and lock down permissions:

```bash
ls -l ~/.ssh/olu1.pem
chmod 400 ~/.ssh/olu1.pem
```

On first connection, SSH may prompt about a new server fingerprint. **Verify the SSH host fingerprint using a trusted AWS/instance-side method before accepting it.** Do not simply turn off `host_key_checking` to suppress warnings.

Test one EC2 connection first with its currently discovered public IP:

```bash
ssh -i ~/.ssh/olu1.pem ec2-user@YOUR_EC2_PUBLIC_IP
# then type: exit
```

Test all discovered EC2 instances (use `-f 1` while learning to keep prompts sequential):

```bash
ansible webserver -m ansible.builtin.ping -f 1
```

Successful hosts report `"ping": "pong"`. If you get `Permission denied (publickey)`, verify the instance's AWS KeyName, the matching `.pem` private key, and the user name (`ec2-user`). If SSH times out, check security-group inbound SSH access and the instance public IP.

## 5. Preview the website locally before AWS deployment (optional)

In one Ubuntu terminal:

```bash
cd ~/morays-project/morays-ansible-ha/site
python3 -m http.server 8080
```

Browse to **http://localhost:8080**. Try the clickable cards and **Check website response** button (it calls the `healthz` file). Stop the local server with `Ctrl + C`.

## 6. Deploy with Ansible

From the **Ansible project folder**:

```bash
cd ~/morays-project/morays-ansible-ha
ansible-playbook -i aws_ec2.yml playbook.yml --syntax-check
ansible-playbook -i aws_ec2.yml playbook.yml --check --diff
ansible-playbook -i aws_ec2.yml playbook.yml
```

`--check` shows a *best-effort* preview; the complete verification tasks may fail in check mode if Apache is not yet installed. Do not treat check mode as a production-ready test. The final command makes the actual changes.

`playbook.yml` has `serial: 1`, so it configures one EC2 instance at a time. The final report (PLAY RECAP) should show `unreachable=0` and `failed=0` for every discovered server. The deployment copies `site/index.html`, `site/assets/style.css`, `site/assets/app.js`, and `site/healthz` to `/var/www/html/`, starts Apache, and checks that the homepage returns HTTP 200.

## 7. Open the ALB website and check target health

From the Terraform directory:

```bash
cd ~/morays-project/morays-terraform-ha
terraform output -raw website_url
terraform output -raw target_group_arn
```

Copy the URL beginning with `http://` into your browser. The initial Terraform project uses HTTP **without TLS**; use HTTPS with an ACM certificate and a 443 listener before using the website for sensitive traffic or production.

Check the AWS targets (replace the placeholder ARN):

```bash
aws elbv2 describe-target-health \
  --region eu-west-2 \
  --target-group-arn YOUR_REAL_TARGET_GROUP_ARN \
  --query 'TargetHealthDescriptions[].[Target.Id,TargetHealth.State]' \
  --output table
```

Expected state after deployment and ALB health-check convergence: `healthy` for each configured target. If not healthy, inspect target-group health reasons, EC2 Apache service, security groups and the website on port 80. You can also open `http://YOUR_ALB_DNS/healthz` in a browser and expect `ok`.

## 8. Make changes to the website

- Edit `site/index.html` for wording/sections.
- Edit `site/assets/style.css` for colours, layout, fonts and responsive styles.
- Edit `site/assets/app.js` for clickable dialog boxes and website response checks.
- Run `ansible-playbook -i aws_ec2.yml playbook.yml` again to distribute updates to all discovered servers.

Ansible uses idempotent modules (`dnf`, `service`, `file`, `copy`) so re-running unchanged configuration should not needlessly rewrite these files.

## IMPORTANT: high availability and Auto Scaling replacements

This Ansible run installs the website on EC2 instances **currently running**. When the Auto Scaling Group scales up or replaces an instance, the new instance **will not automatically have this website** simply because an earlier playbook was executed.

For a fully automated HA deployment, one of the next stages must include a **golden AMI** (bake Apache + site into an image used by the Launch Template) or **EC2 launch bootstrap / SSM automation** that configures new servers, then waits until the ALB target is healthy. Change the Terraform ASG health-check type from `EC2` to `ELB` **only after** instances are reliably bootstrapped, otherwise unhealthy unconfigured instances can cause a replacement loop. The current Terraform template deliberately uses EC2 checks during this learning stage.

## Cost control

The AWS ALB, EC2 instances and public IPv4 addresses incur charges while running. To tear down this **separate** infrastructure when you no longer need it, review a Terraform destroy plan from the `morays-terraform-ha` directory and proceed only after confirming it targets the correct resources.

## What each file does

| File | Purpose |
|---|---|
| `ansible.cfg` | Connection defaults, safe SSH verification, logs, concurrency |
| `aws_ec2.yml` | Discovers only running EC2 servers tagged for the Terraform HA project |
| `playbook.yml` | Installs Apache, deploys the entire site and verifies HTTP |
| `requirements.yml` | Declares `amazon.aws` Ansible collection |
| `site/index.html` | Responsive single-page HTML content / visual sections |
| `site/assets/style.css` | Purple-gradient design, cards, illustration, responsive layout |
| `site/assets/app.js` | Accessible dialogs, mobile navigation, real `/healthz` request |
| `site/healthz` | Simple response check payload |
| `.gitignore` | Keeps local private keys, logs and credentials out of Git |


## Automatic deployment to NEW Auto Scaling instances (added)

**No more manual Ansible deployment when an EC2 instance is replaced.** The Terraform project installs a small launch-time bootstrap and a tag-targeted AWS Systems Manager State Manager association. Each new instance downloads the exact **latest published website release** from a private S3 bucket and starts Apache. Every 30 minutes, State Manager checks and repairs the configuration as needed.

The Ansible project is still the source of truth for your complete website and still configures the currently running servers. It now has a release publisher and a single combined deploy command:

```bash
cd ~/morays-project/morays-ansible-ha
chmod +x scripts/*.sh
./scripts/deploy.sh
```

`scripts/deploy.sh` first uploads the HTML, CSS, JavaScript and health endpoint to a **versioned private S3 release**, then runs the Ansible playbook on your current tagged instances. New instances automatically load that release during startup. The release pointer is changed **only after** the files have uploaded.

To publish a new release **without SSH/Ansible** (for example, if your laptop is unavailable for configuring existing nodes), run:

```bash
./scripts/publish_site.sh
```

State Manager will apply the published release to existing managed instances at the next 30-minute reconciliation and immediately to newly registered matching instances. This is eventually consistent, not instantaneous; monitor association execution status and the ALB target group before assuming all instances updated. You must have `aws`, `terraform`, your configured AWS identity, and permission to upload into the Terraform-managed artifacts S3 bucket.

### One-time operational steps

1. Deploy/upgrade Terraform first, including `site_artifacts.tf`, `ssm_website.tf` and the EC2 policy.
2. On first rollout, run `./scripts/deploy.sh` from Ansible project. Ensure your SSH access and `olu1.pem` work and check all ALB targets are healthy. You can use `./scripts/publish_site.sh` first if SSH is not configured, and let SSM converge; don't turn on ELB replacement health checks until the site is healthy.
3. In the Terraform project's `terraform.tfvars`, change `enable_elb_health_checks = true`; run `terraform plan` and `terraform apply` after inspecting the plan.
4. Test **in a non-production environment** by replacing one instance using the ASG or temporarily scaling from 2 to 3; verify the replacement serves the same version without rerunning Ansible. Terminating an instance affects service and may create AWS charges.

### Verify SSM deployment

From your Terraform folder:

```bash
aws ssm describe-instance-information --region eu-west-2
aws ssm describe-association-executions --region eu-west-2 \
  --association-id "$(terraform output -raw ssm_association_id)"
```

The latest deployment version on an instance is recorded in `/var/www/html/.morays-release`.

### Releasing and rolling back

- Normal updates: edit `site/` and run `./scripts/deploy.sh`.
- Each release is stored under `releases/<SHA256>/`. The private bucket is versioned and keeps previous releases.
- Rollback: replace the contents of `s3://<site-artifact-bucket>/current.txt` with the exact 64-character SHA256 ID for a previous release. The next State Manager pass (or an explicit operator-triggered command) will deploy it; do not remove the old release objects.
- Never commit credentials, SSH private keys, Terraform state or generated logs to GitHub.