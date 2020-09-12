#!/usr/bin/env bash
rm -rf build

#xplat client side lib
mkdir build
mkdir build/packages

echo "Compiling Typescript..."
./node_modules/.bin/tsc
echo "Compiled Typescript"

rsync -a --exclude=*.ts packages/ build/packages

rm -rf build/packages/install
cp README.md build/packages/plugin-tools
cp LICENSE build/packages/plugin-tools

echo "plugin-tools available at build/packages:"
ls build/packages
