#!/bin/sh
# Stamp a new version so open copies of the app notice the update and refresh themselves.
# Run before committing a change you want everyone to get: ./release.sh
v=$(date +%Y%m%d%H%M%S)
printf '{"v":"%s"}\n' "$v" > version.json
printf "// Written by release.sh: the app compares this with version.json online to spot updates.\nexport const VERSION = '%s';\n" "$v" > js/version.js
echo "version $v"
