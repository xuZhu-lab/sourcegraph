#!/usr/bin/env bash

# We want to build multiple go binaries, so we use a custom build step on CI.
cd $(dirname "${BASH_SOURCE[0]}")/../../..
set -ex

export SERVER_PKG=${SERVER_PKG:-github.com/sourcegraph/sourcegraph/enterprise/cmd/server}

export PATH="$PWD/dev/ci/bin:$PATH"

./cmd/server/build.sh github.com/sourcegraph/sourcegraph/enterprise/cmd/frontend github.com/sourcegraph/sourcegraph/enterprise/cmd/management-console github.com/sourcegraph/sourcegraph/enterprise/cmd/repo-updater
