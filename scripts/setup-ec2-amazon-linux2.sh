#!/bin/bash
# EC2 Amazon Linux 2 — full setup for Claude Code + IO-107 testing framework
# Run as ec2-user (sudo available). Takes ~5 minutes.
set -euo pipefail

echo "==> Node.js 20 via NodeSource"
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo yum install -y nodejs

echo "==> System packages needed by Playwright Chromium"
sudo yum install -y \
  atk at-spi2-atk cups-libs expat gtk3 \
  libdrm libX11 libXcomposite libXdamage libXext \
  libXfixes libXrandr libxcb mesa-libgbm nss pango \
  alsa-lib xorg-x11-fonts-100dpi xorg-x11-fonts-75dpi \
  git jq unzip

echo "==> AWS CLI v2 (if not already present)"
if ! command -v aws &>/dev/null; then
  curl -fsSL https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip -o /tmp/awscliv2.zip
  unzip -q /tmp/awscliv2.zip -d /tmp
  sudo /tmp/aws/install
  rm -rf /tmp/aws /tmp/awscliv2.zip
fi
aws --version

echo "==> kubectl (latest stable)"
KUBECTL_VERSION=$(curl -fsSL https://dl.k8s.io/release/stable.txt)
curl -fsSLo /tmp/kubectl "https://dl.k8s.io/release/${KUBECTL_VERSION}/bin/linux/amd64/kubectl"
sudo install -o root -g root -m 0755 /tmp/kubectl /usr/local/bin/kubectl
kubectl version --client

echo "==> Claude Code"
sudo npm install -g @anthropic-ai/claude-code

echo "==> Testing framework dependencies"
# Clone the repo if not already present
REPO_DIR="${HOME}/testing_framework"
if [ ! -d "$REPO_DIR" ]; then
  git clone https://github.com/jessetop/testing_framework.git "$REPO_DIR"
fi
cd "$REPO_DIR"
npm install
npx playwright install chromium
npx playwright install-deps chromium

echo "==> git credential helper for CodeCommit (uses EC2 instance role)"
git config --global credential.helper '!aws codecommit credential-helper $@'
git config --global credential.UseHttpPath true

echo ""
echo "==> DONE. Before running tests, set:"
echo "    export ANTHROPIC_API_KEY=sk-ant-..."
echo "    export IO107_STUDENT_ID=<student-id>"
echo ""
echo "    AWS credentials come from the EC2 instance role — no profile needed."
echo "    Make sure the instance role has the permissions in:"
echo "    courses/SYF/stream2_aws_intermediate/IO-107_SDLC_Pipeline/lab_required_permissions.json"
echo ""
echo "==> Run Lab 1 test:"
echo "    cd ~/testing_framework"
echo "    IO107_STUDENT_ID=ltf-smoke npx playwright test courses/io107/tests/lab1-eks-deployment.spec.ts --reporter=list"
