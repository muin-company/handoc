#!/usr/bin/env bash
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

info()  { echo -e "${GREEN}✓${NC} $*"; }
warn()  { echo -e "${YELLOW}⚠${NC} $*"; }
fail()  { echo -e "${RED}✗${NC} $*"; exit 1; }

cd "$(dirname "$0")/.."

# 1. Node.js version check (≥20)
if ! command -v node &>/dev/null; then
  fail "Node.js not found. Install Node.js ≥20 first."
fi
NODE_MAJOR=$(node -e 'console.log(process.versions.node.split(".")[0])')
if [ "$NODE_MAJOR" -lt 20 ]; then
  fail "Node.js v${NODE_MAJOR} detected. Need ≥20."
fi
info "Node.js v$(node -v | tr -d v)"

# 2. pnpm
if ! command -v pnpm &>/dev/null; then
  warn "pnpm not found, enabling via corepack..."
  corepack enable
  if ! command -v pnpm &>/dev/null; then
    fail "Failed to install pnpm via corepack."
  fi
fi
info "pnpm $(pnpm -v)"

# 3. Install dependencies
info "Installing dependencies..."
pnpm install

# 4. Build
info "Building all packages..."
pnpm turbo build

# 5. Test
info "Running tests..."
pnpm turbo test

echo ""
echo -e "${GREEN}══════════════════════════════════════${NC}"
echo -e "${GREEN}  ✓ HanDoc bootstrap complete!${NC}"
echo -e "${GREEN}══════════════════════════════════════${NC}"
