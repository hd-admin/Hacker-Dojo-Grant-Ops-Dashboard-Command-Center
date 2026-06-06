# Goal
Implement all of docs/product-spec-v2/README.md

* You **MUST** follow all of the style guide, if you find code that doesn't follow the style guide, refactor
* If the code is untestable with black box unit tests, refactor until it is.
* DO NOT USE hacky libraries like xlsx and prefer widely used library, for example, exceljs. IF you cannot install dependencies with npm install, THEN YOU ARE IN THE WRONG DIRECTION!!
* The following should not happen either:

> hacker-dojo-grant-ops@0.1.0 predev
> bash ./scripts/ensure-better-sqlite3.sh


[ensure-better-sqlite3] ERROR: could not resolve a real Node binary

Ensure the whole startup, distribution process is properly tested, etc. New user should not be jumping through hoops to get setup
