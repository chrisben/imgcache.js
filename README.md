# imgcache.js

The purpose of this JS library is to provide a nice interface for locally storing images for offline apps using PhoneGap/Cordova or [browsers supporting the new html5 File API](http://caniuse.com/filesystem) (e.g. Chrome).

This library is especially useful for mobile web applications using Phonegap/Cordova where the normal browser cache cannot be relied upon and where offline navigation is quite common.

Used with [imagesloaded](http://desandro.github.com/imagesloaded/) as shown in `examples/example2.html`, you can see that it can automatically:

* store images in cache
* replace images with cached version if they fail to load (offline / busy server..)

This is the best solution I have found so far to provide easy caching of images within a phonegap web app.

This library works with Phonegap/Cordova (v >= 1.7), the supported platforms being:

* Android
* iOS
* Windows Phone 8.1
* Amazon Fire OS

Most methods are **ASYNCHRONOUS** : use callbacks if required.

Using imgcache.js
=================

Optional Dependencies
---------------------
* jQuery (any version from 1.6 should do), Zepto or AngularJS (jQueryLite) *optional*
* Phonegap/Cordova (v >= v1.7) *optional*
* [imagesloaded] (http://desandro.github.com/imagesloaded/) *optional*

Installation
------------

Note: You can use [bower](http://bower.io/) or [npm](https://www.npmjs.com/) to add this library as a dependency to your project (repository name: `imgcache.js`).

To start to use this library, import `js/imgcache.js` within your html file:

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
ImgCache.init(function () {
    alert('ImgCache init: success!');

    // from within this function you're now able to call other ImgCache methods
    // or you can wait for the ImgCacheReady event

}, function () {
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
var target = $('img#profile');
ImgCache.cacheFile(target.attr('src'), function () {
  ImgCache.useCachedFile(target, function () {
    alert('now using local copy');
  }, function(){
    alert('could not load from cache');
  })
});
```

To check if a file is stored locally:

```javascript
ImgCache.isCached(target.attr('src'), function(path, success) {
  if (success) {
    // already cached
    ImgCache.useCachedFile(target);
  } else {
    // not there, need to cache the image
    ImgCache.cacheFile(target.attr('src'), function () {
      ImgCache.useCachedFile(target);
    });
  }
});
```

When you no longer want to use the locally cached file:

```javascript
var target = $('img#profile');
ImgCache.useOnlineFile(target);
```

Clearing the cache
------------------
To remove all cached files, clear the local cache folder:

```javascript
ImgCache.clearCache(function () {
  // continue cleanup...
}, function () {
  // something went wrong
});
```

There is currently no way to invalidate single images from the cache.

High level API
--------------
* ImgCache.**init**() *-- initialises the local cache*
* ImgCache.**cacheFile**() *-- writes a copy of a file into the local cache*
* ImgCache.**isCached**() *-- checks if a the given image exists in the cache - does not check if the latest version of that file is cached*
* ImgCache.**getCachedFile**() *-- returns the cached file*
* ImgCache.**getCachedFileURL**() *-- returns the URL of the cached version of a file*
* ImgCache.**useCachedFile**() *-- replaces the img src with the cached version*
* ImgCache.**useCachedFileWithSource**() *-- similar to useCachedFile but with the image source url as extra parameter*
* ImgCache.**useOnlineFile**() *-- replaces back the img src with the original (online) version // synchronous method*
* ImgCache.**clearCache**() *-- clears the local cache folder*
* ImgCache.**isBackgroundCached**() *-- checks if a the given element background image exists in the cache - does not check if the latest version of that file is cached*
* ImgCache.**cacheBackground**() *-- caches the background image of an element*
* ImgCache.**useCachedBackground**() *-- replaces the background image source of the given element with the cached version*
* ImgCache.**useBackgroundOnlineFile**() *-- replaces back a background image with the original (online) version*
* ImgCache.**removeFile**() *-- removes a given file from the cache*
* ImgCache.**getCurrentSize**() *-- returns the current size of the ImgCache cache in bytes // synchronous method*

Private methods are accessible through:

* ImgCache.helpers *-- general helper methods*
* ImgCache.domHelpers *-- DOM manipulation helper functions*
* ImgCache.private *-- private methods*

Options
-------
See ImgCache.options at the top of the source file for the list of options.
Options can be overridden from your own script, no need to modify the library!

Overridable methods
-------------------
* The hash method used by default in ImgCache is SHA-1. It was chosen for its near absence of collision. Though it might slow things down if you have a large number of files to cache (see #81). You can plug-in your own method by overriding ImgCache.overridables.hash.
* If logging is enabled, ImgCache output some log entries in the console by default. You can override ImgCache.overridables.log in order to change this behaviour.

Promises
--------
Include also [qimgcache.js](js/qimgcache.js) in your html files to be able to use its [Q Promises](https://github.com/kriskowal/q) interface if you don't like callbacks and prefer to use the simpler then/fail/progress methods.

This wrapper also makes sure the init method is always called first, so you SHOULDN'T call this method yourself when using this wrapper.

Check out the [sample code](examples/promises.html).

Unit tests
----------
Open `index.html` and click 'Start unit tests' to launch unit tests.

Code samples
------------
Open `index.html` to check out several examples.

Release Notes
-------------
See [CHANGELOG](CHANGELOG.md) for the complete release notes.

Troubleshooting
---------------

Make sure you first read carefully this documentation. If you are still having issues follow this checklist:

* Set debug ON (```ImgCache.options.debug = true;```) and follow the output within the console carefully.
* Is init the first method of ImgCache to be called? (check out the console with debug ON to make sure of that)
* Add alert/console.log calls throughout your code to see what gets called and what doesn't.
* Am I running the latest version of ImgCache? If not, try with the latest version or look into the [changelog](CHANGELOG.md) for fixes related to your problem in newer releases.

If using Cordova/Phonegap, make sure you read [this documentation](CORDOVA.md) first, then double check the following:

* Are all the required plugins activated ? (config.xml)
* Are the correct permissions set? (config.xml)
* Is my code running AFTER the "deviceready" event is launched?

If you are still stuck, look for a similar problem within existing issues.

If you cannot find any, open an issue with a description of your problem, a simpler version of your code if you can.

Whenever you post an issue it's IMPORTANT you add the following details to get a quicker answer:

* ImgCache version
* Options used
* JS frameworks used with it (jQuery / Angular / Ionic ..)
* Environment : Chrome or Cordova
* If Cordova is used:
    * Its version
    * The version of the plugins
    * The target OS (iOS / Android..)
    * The target OS version (e.g: iOS 8.1)


Known issues
------------
See [KNOWN_ISSUES](KNOWN_ISSUES.md) for a list of known issues.

See also
--------
Wrappers for AngularJS:

* [angular-imgcache.js](https://github.com/maistho/angular-imgcache.js)
* [ngImgCache](https://github.com/sunsus/ngImgCache/)

Wrapper for Ionic Framework:

* [ionic-img-cache](https://github.com/vitaliy-bobrov/ionic-img-cache)

License
-------
Copyright 2012-2016 (c) Christophe BENOIT

Apache License - see LICENSE.md

Code from http://code.google.com/p/tiny-sha1/ is being used which is under the MIT License.
The copyright for this part belongs to the creator of this work.
