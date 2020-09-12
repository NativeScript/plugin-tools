#!/usr/bin/env bash
##################################################
# This shell script is executed by tools-release.js #
##################################################

TOOLS_VERSION=$1
PACKAGE_VERSION=$2

if [[ $TOOLS_VERSION == "--local" ]]; then
    TOOLS_VERSION="*"
fi

./scripts/build.sh

cd build/packages

if [[ "$OSTYPE" == "darwin"* ]]; then

    if [[ $PACKAGE_VERSION =~ ^[0-9]+\.[0-9]+(\.[0-9]+)?$ ]]; then
      # override package version
      sed -i "" "s|exports.toolsVersion = '\*';|exports.toolsVersion = '$PACKAGE_VERSION';|g" plugin-tools/src/utils/versions.js
      sed -i "" "s|\0.0.1|$PACKAGE_VERSION|g" plugin-tools/package.json
    else 
      sed -i "" "s|exports.toolsVersion = '\*';|exports.toolsVersion = '$TOOLS_VERSION';|g" plugin-tools/src/utils/versions.js
      sed -i "" "s|\*|$TOOLS_VERSION|g" plugin-tools/package.json
    fi
else
    sed -i "s|exports.toolsVersion = '\*';|exports.toolsVersion = '$TOOLS_VERSION';|g" plugin-tools/src/utils/versions.js
    sed -i "s|\*|$TOOLS_VERSION|g" plugin-tools/package.json
fi

if [[ $TOOLS_VERSION == "*" ]]; then
    if [[ "$OSTYPE" == "darwin"* ]]; then
        if [[ $PACKAGE_VERSION =~ ^[0-9]+\.[0-9]+(\.[0-9]+)?$ ]]; then
          # override package version
          sed -E -i "" "s/\"@nativescript\/([^\"]+)\": \"\\*\"/\"@nativescript\/\1\": \"$PACKAGE_VERSION\"/" plugin-tools/package.json
        else 
          sed -E -i "" "s/\"@nativescript\/([^\"]+)\": \"\\*\"/\"@nativescript\/\1\": \"file:..\/\1\"/" plugin-tools/package.json
        fi
    else
        sed -E -i "s/\"@nativescript\/([^\"]+)\": \"\\*\"/\"@nativescript\/\1\": \"file:..\/\1\"/" plugin-tools/package.json
    fi
fi
