#!/usr/bin/env bash
# One command for first rollout and later updates.
set -Eeuo pipefail
BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
"$BASE_DIR/scripts/publish_site.sh"
cd "$BASE_DIR"
ansible-playbook -i aws_ec2.yml playbook.yml "$@"
echo "Ansible configured current instances; SSM will configure replacements automatically."