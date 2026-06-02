#!/bin/bash
set -euo pipefail

SRC_DIR="./src"
BUILD_DIR="./build/safari"
MANIFEST_FILE="$SRC_DIR/manifest.json"
CURRENT_VERSION=$(jq -r '.version' "$MANIFEST_FILE")
VERSION="${1:-$CURRENT_VERSION}"
PACKAGE_NAME="xdebug-helper-safari@$VERSION.zip"

mkdir -p "$BUILD_DIR"
BUILD_DIR_ABSOLUTE=$(cd "$BUILD_DIR" && pwd)
TMP_DIR=$(mktemp -d)
PACKAGE_DIR="$TMP_DIR/package"
TMP_ZIP="$TMP_DIR/$PACKAGE_NAME"

trap 'rm -rf "$TMP_DIR"' EXIT

mkdir -p "$PACKAGE_DIR"
cp -R "$SRC_DIR"/. "$PACKAGE_DIR"
cp LICENSE "$PACKAGE_DIR/LICENSE"

(
    cd "$PACKAGE_DIR"
    zip -qr "$TMP_ZIP" .
)

mv "$TMP_ZIP" "$BUILD_DIR_ABSOLUTE/$PACKAGE_NAME"
echo "Safari source package created: $BUILD_DIR/$PACKAGE_NAME"
