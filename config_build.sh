#!/bin/bash
# Build config for build.sh
APP_NAME=organize-search-engines
CHROME_PROVIDERS="content skin locale"
CHROME_URI=seorganizer
CLEAN_UP=1
ROOT_FILES="LICENSE.txt SOURCE.txt icon.png"
ROOT_DIRS="defaults components"
BEFORE_BUILD="../components.sh $APP_NAME nsISEOrganizer"
AFTER_BUILD=