# imgcache.js

The purpose of this JS library is to provide a nice interface for locally storing images for offline apps using PhoneGap/Cordova or [browsers supporting the new html5 File API](http://caniuse.com/filesystem) (e.g. Chrome).

This library is especially useful for mobile web applications using Phonegap/Cordova where the normal browser cache cannot be relied upon and where offline navigation is quite common.

Used with [imagesloaded](http://desandro.github.com/imagesloaded/) as shown in `examples/example2.html`, you can see that it can automatically:

* store images in cache
* replace images with cached version if they fail to load (offline / busy server..)

This is the best solution I have found so far to provide easy caching of images within a phonegap web app.

This library works with Phonegap/Cordova (v >= 1.7) so the supported platforms should be:

* Android [TESTED]
* iOS [TESTED]
* Windows 8

Most methods are **ASYNCHRONOUS** : use callbacks if required.

Using imgcache.js
=================

Optional Dependencies
---------------------
* jQuery (any version from 1.6 should do) or Zepto *optional*
* Phonegap/Cordova *optional* (v >= v1.7)
* [imagesloaded] (http://desandro.github.com/imagesloaded/) *optional*

Installation
------------
To use this library, you need to copy `js/imgcache.js` into your project and import that script within your html file:

```html
<script src="js/imgcache.js"></script>
```

Using with PhoneGap/Cordova: see [CORDOVA.md](CORDOVA.md).

Using with Chrome or other browsers that support the [html5 filesystem API]:

* Beware of cross domain ajax issue! retrieve image from the same domain or set CORS solutions with the server...
* If the page is opened locally (file:// ..), Chrome needs to be loaded with the following flags: `--allow-file-access-from-files --allow-file-access` otherwise the local filesystem will not be accessible (security error)
* To navigate through the local filesystem open a new tab with filesystem:http://*yourSiteDomain*/persistent/ or filesystem:http://*yourSiteDomain*/temporary/

Using as AMD / CommonJS modules
-------------------------------
* To use this library with AMD:
```javascript
define(function (require) {
    var ImgCache = require("imgcache");
});
```
* To use this library with CommonJS:
```javascript
var cache = require("imgcache");
```

Setup your cache
----------------
Before initializing the cache, you must specify any default option you wish to override:

```javascript
// write log to console
ImgCache.options.debug = true;

// increase allocated space on Chrome to 50MB, default was 10MB
ImgCache.options.chromeQuota = 50*1024*1024;
```

See `ImgCache.options` at the top of the source file for more settings.

After setting any custom configuration, initialize the cache:

```javascript
ImgCache.init(function(){
    alert('ImgCache init: success!');

    // from within this function you're now able to call other ImgCache methods
    // or you can wait for the ImgCacheReady event

}, function(){
    alert('ImgCache init: error! Check the log for errors');
});
```

If the cache successfully initializes, `ImgCache.ready` will be set to `true`. You can also watch for the triggered `ImgCacheReady` event.

If you're using imgcache.js with PhoneGap/Cordova, `ImgCache.init()` must be called after the `onDeviceReady` event has been triggered, not before!

Note that in Chrome, the user will be prompted to give permission to the page for accessing the local filesystem (which will run the error callback if they refuse).

Storing images
--------------
Images are stored into the local folder specified by `ImgCache.options.localCacheFolder`. To add a file to the cache:

```javascript
ImgCache.cacheFile('http://my-cdn.com/users/2/profile.jpg');
```

To cache an image defined as a background image, you can either use cacheFile or use the helper function `ImgCache.cacheBackground` that accepts a DOM/jQuery element, retrieves its background attribute and cache that file.

Using cached images
-------------------
Once an image is stored in the cache, you can replace the file displayed in an img element by the cached one:

```javascript
target = $('img#profile');
ImgCache.cacheFile(target.attr('src'), function(){
  ImgCache.useCachedFile(target, function(){
    alert('now using local copy');
  }, function(){
    alert('could not load from cache');
  })
});
```
    
To check if a file is stored locally:

```javascript
ImgCache.isCached(target.attr('src'), function(path, success){
  if(success){
    // already cached
    ImgCache.useCachedFile(target);
  } else {
    // not there, need to cache the image
    ImgCache.cacheFile(target.attr('src'), function(){
      ImgCache.useCachedFile(target);
    });
  }
});
```
    
When you no longer want to use the locally cached file:

```javascript
target = $('img#profile');
ImgCache.useOnlineFile(target);
```

Clearing the cache
------------------
To remove all cached files, clear the local cache folder:

```javascript
ImgCache.clearCache(function(){
  // continue cleanup...
}, function(){
  // something went wrong
});
```
    
There is currently no way to invalidate single images from the cache.

High level API
--------------
* ImgCache.init() *initialises the local cache*
* ImgCache.cacheFile() *writes a copy of a file into the local cache*
* ImgCache.isCached() *checks if a the given image exists in the cache - does not check if the latest version of that file is cached*
* ImgCache.getCachedFile() *returns the cached file*
* ImgCache.useCachedFile() *replaces the img src with the cached version*
* ImgCache.useCachedFileWithSource() *similar to useCachedFile but with the image source url as extra parameter*
* ImgCache.useOnlineFile() *replaces back the img src with the original (online) version*
* ImgCache.clearCache() *clears the local cache folder*
* ImgCache.cacheBackground() *caches the background image of an element*
* ImgCache.useCachedBackground() *replaces the background image source of the given element with the cached version*
* ImgCache.useBackgroundOnlineFile() *replaces back a background image with the original (online) version*
* ImgCache.removeFile() *removes a given file from the cache*
* ImgCache.getCurrentSize() *returns the current size of the ImgCache cache in bytes -- this is not an asynchronous method *

Options
-------
See ImgCache.options at the top of the source file for the list of options.
Options can be overridden from your own script, no need to modify the library!

Unit tests
----------
Open index.html and click 'Start unit tests' to launch unit tests.

Code samples
------------
See html files in the `examples/` folder.

Release Notes
-------------
See [CHANGELOG](CHANGELOG.md) for the complete release notes.

Known issues
------------
See [KNOWN_ISSUES](KNOWN_ISSUES.md) for a list of known issues.

License
-------
Copyright 2012-2014 (c) Christophe BENOIT - [Wobis](http://www.wobis.fr)

Apache License - see LICENSE.md

Code from http://code.google.com/p/tiny-sha1/ is being used which is under the MIT License.
The copyright for this part belongs to the creator of this work.
