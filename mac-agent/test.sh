#!/bin/zsh
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p build
xcrun swiftc -swift-version 5 -module-cache-path "$PWD/build/ModuleCache" \
    Sources/Billing.swift Tests/BillingTests.swift -o build/billing-tests
./build/billing-tests
