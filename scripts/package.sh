#!/usr/bin/env bash
##################################################
# This shell script is executed by tools-release.js #
##################################################

PACKAGE_VERSION=$2

./scripts/build.sh

cd build/packages

if [[ "$OSTYPE" == "darwin"* ]]; then
  sed -i "" "s|exports.toolsVersion = '\*';|exports.toolsVersion = '$PACKAGE_VERSION';|g" plugin-tools/src/utils/versions.js
  sed -i "" "s|\0.0.1|$PACKAGE_VERSION|g" plugin-tools/package.json
else
    sed -i "s|exports.toolsVersion = '\*';|exports.toolsVersion = '$PACKAGE_VERSION';|g" plugin-tools/src/utils/versions.js
    sed -i "s|\0.0.1|$PACKAGE_VERSION|g" plugin-tools/package.json
fi
