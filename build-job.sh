#!/bin/bash
cd /home/mistlight/Hacker-Dojo-Grant-Ops-Dashboard-Command-Center/frontend
rm -rf .next
/home/mistlight/Hacker-Dojo-Grant-Ops-Dashboard-Command-Center/node_modules/.bin/next build --no-lint > /tmp/build-at.log 2>&1
echo $? > /tmp/build-at.exit
