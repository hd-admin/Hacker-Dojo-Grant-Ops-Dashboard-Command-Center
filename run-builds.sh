#!/bin/bash
cd /home/mistlight/Hacker-Dojo-Grant-Ops-Dashboard-Command-Center/frontend
rm -rf .next
/home/mistlight/Hacker-Dojo-Grant-Ops-Dashboard-Command-Center/node_modules/.bin/next build --no-lint > /tmp/build-run1.log 2>&1
echo $? > /tmp/build-run1.exit
rm -rf .next
/home/mistlight/Hacker-Dojo-Grant-Ops-Dashboard-Command-Center/node_modules/.bin/next build --no-lint > /tmp/build-run2.log 2>&1
echo $? > /tmp/build-run2.exit
