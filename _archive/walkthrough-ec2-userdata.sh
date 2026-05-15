#!/bin/bash
# EC2 user-data: install toolchain and clone testing_framework for Lab 1 walkthrough.
set -euxo pipefail
exec > >(tee -a /var/log/walkthrough-userdata.log) 2>&1

# Always work as ec2-user for the actual lab run.
EC2_HOME=/home/ec2-user

# System packages.
dnf -y update
dnf -y install git jq tar gzip unzip bash-completion which gh

# Node.js 20 (for ts-node / npm).
curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
dnf -y install nodejs

# Terraform 1.14 (hashicorp's official repo).
dnf -y install dnf-plugins-core
dnf config-manager --add-repo https://rpm.releases.hashicorp.com/AmazonLinux/hashicorp.repo
dnf -y install terraform-1.14.3

# Claude CLI (optional, mirrors the dev box; harmless if unused).
npm install -g @anthropic-ai/claude-code@2.1.142 || true

# Clone framework as ec2-user.
sudo -u ec2-user bash -lc "
  cd ~ \
  && git clone https://github.com/jessetop/testing_framework.git \
  && cd testing_framework \
  && npm ci --no-audit --no-fund \
  && git clone https://github.com/AWSClassroom-com/Advanced_Terraform.git ~/Advanced_Terraform
"

# Mark setup complete.
date -u > /var/run/walkthrough-ready
chown ec2-user:ec2-user /var/run/walkthrough-ready
