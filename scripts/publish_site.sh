#!/usr/bin/env bash
# Publish an immutable static-site release to private S3, then atomically
# update current.txt. All new EC2 instances load the current release.
set -Eeuo pipefail

BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TERRAFORM_DIR="${MORAYS_TERRAFORM_DIR:-$BASE_DIR/../morays-terraform-ha}"
SITE_DIR="$BASE_DIR/site"

for binary in aws terraform sha256sum; do
  command -v "$binary" >/dev/null || { echo "Missing command: $binary" >&2; exit 1; }
done
for file in index.html healthz assets/style.css assets/app.js; do
  test -s "$SITE_DIR/$file" || { echo "Required website file missing: $file" >&2; exit 1; }
done

BUCKET="$(terraform -chdir="$TERRAFORM_DIR" output -raw site_artifact_bucket)"
REGION="$(terraform -chdir="$TERRAFORM_DIR" output -raw aws_region)"

# Stable SHA256 computed from all website files and their names.
release_id="$(cd "$SITE_DIR" && find . -type f -print0 | sort -z | xargs -0 sha256sum | sha256sum | cut -d' ' -f1)"

echo "Publishing Morays website release: $release_id"
aws s3 sync "$SITE_DIR/" "s3://$BUCKET/releases/$release_id/" --region "$REGION" --only-show-errors

# Fail before promoting if upload did not contain the expected homepage.
aws s3api head-object --bucket "$BUCKET" --key "releases/$release_id/index.html" --region "$REGION" >/dev/null

pointer_file="$(mktemp)"
trap 'rm -f "$pointer_file"' EXIT
printf '%s\n' "$release_id" > "$pointer_file"
aws s3 cp "$pointer_file" "s3://$BUCKET/current.txt" \
  --region "$REGION" --content-type text/plain --only-show-errors

echo "Published successfully to s3://$BUCKET/releases/$release_id/"
echo "All new Auto Scaling EC2 instances will deploy this release automatically."