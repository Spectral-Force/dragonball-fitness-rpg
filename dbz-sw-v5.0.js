'use strict';

// Compatibility entry for existing v5 installations. Loading the v6 worker
// under the old script URL lets previously installed GitHub Pages clients
// activate the new cache before the v6 page registers its canonical worker.
importScripts('./dbz-sw-v6.0.js');
