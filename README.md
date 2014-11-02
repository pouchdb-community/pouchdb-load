PouchDB Load
=====

[![Build Status](https://travis-ci.org/nolanlawson/pouchdb-load.svg)](https://travis-ci.org/nolanlawson/pouchdb-load)

Client-side tools for loading a dump from a CouchDB/PouchDB database.

For dumping, check out [pouchdb-dump-cli](https://github.com/nolanlawson/pouchdb-dump-cli) to dump from the command line, or [pouchdb-replication-stream](https://github.com/nolanlawson/pouchdb-replication-stream) to dump from within your Node.js application.

This method is typically much faster than standard replication, because it uses fewer HTTP requests. So it's a great way to quickly load an initial state for your database. 

Usage
--------

To use this plugin, include it after `pouchdb.js` in your HTML page:

```html
<script src="pouchdb.js"></script>
<script src="pouchdb.load.js"></script>
```

Or install from Bower:

```
bower install pouchdb-load
```

Or to use it in Node.js, just npm install it:

```
npm install pouchdb-load
```

And then attach it to the `PouchDB` object:

```js
var PouchDB = require('pouchdb');
PouchDB.plugin(require('pouchdb-load'));
```

API
----------

This plugin exposes a single method on your database, `load()`:

### db.load(url [, callback])

This method returns a Promise or calls your callback, if you prefer the callback style.

You can give it a URL pointing to a single dump file:

```js
var db = new PouchDB('my-awesome-db');
db.load('http://example.com/my-dump-file.txt').then(function () {
  // done loading!
}).catch(function (err) {
  // HTTP error or something like that
});
```

This will read the entire file into memory, though. Assuming you used the `--split` option when you dumped your database, you can also load multiple files by using `Promise.all`. For instance, let's say you had 5 files, named 
`'my-dump-file_00000000.txt'` through `'my-dump-file_00000004.txt'`. You would do:

```js
var dumpFiles = [
  'my-dump-file_00000000.txt',
  'my-dump-file_00000001.txt',
  'my-dump-file_00000002.txt',
  'my-dump-file_00000003.txt',
  'my-dump-file_00000004.txt',
];

PouchDB.utils.Promise.all(dumpFiles.map(function (dumpFile) {
  return db.load('http://example.com/' + dumpFile);
})).then(function () {
  // done loading!
}).catch(function (err) {
  // HTTP error or something like that
});
```

This will load them all simultaneously. You can also load them all in a series:

```js
var series = PouchDB.utils.Promise.resolve();

dumpFiles.forEach(function (dumpFile) {
  series = series.then(function () {
    return db.load('http://example.com/' + dumpFile);
  });
});

series.then(function () {
  // done loading!
}).catch(function (err) {
  // HTTP error or something like that
});
```

#### Notes on idempotency

The `load()` operation is *idempotent*, meaning that you can run it over and over again, and it won't create duplicate documents in the target database.

However, it's inefficient to run the `load()` every time the user starts your app. So if you'd like, you can use "local documents" to remember whether or not this database has already been loaded:

```js
db.get('_local/initial_load_complete').catch(function (err) {
  if (err !== 404) { // 404 means not found
    throw err;
  }
  db.load(/* ... */).then(function () {
    return db.put({_id: '_local/initial_load_complete'});
  });
}).then(function () {
  // at this point, we are sure that 
  // initial replication is complete
}).catch(function (err) {
  // handle unexpected errors
});
```

This code first checks for a local document called `'_local/initial_load_complete'`. If the document is not found, then it calls `dump()`, then puts the local doc to mark that it's complete. Else it finishes.

(*Local documents* are non-replicated PouchDB/CouchDB documents that are useful for storing local state or configuration files. To create a local document, you simply prefix `'_local/'` to the document `_id`.)

Building
----
    npm install
    npm run build

Testing
----

### In Node

This will run the tests in Node using LevelDB:

    npm test
    
You can also check for 100% code coverage using:

    npm run coverage


### In the browser

Run `npm run dev` and then point your favorite browser to [http://127.0.0.1:8001/test/index.html](http://127.0.0.1:8001/test/index.html).

The query param `?grep=mysearch` will search for tests matching `mysearch`.

### Automated browser tests

You can run e.g.

    CLIENT=selenium:firefox npm test
    CLIENT=selenium:phantomjs npm test

This will run the tests automatically and the process will exit with a 0 or a 1 when it's done. Firefox uses IndexedDB, and PhantomJS uses WebSQL.
