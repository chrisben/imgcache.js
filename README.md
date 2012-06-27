imgcache.js
===========

Description
-----------
The purpose of this JS library is to cache images using the new html5 File API : if the page is viewed offline and its images are cached through this mechanism, they will be shown instead of an empty image.

It is especially useful for mobile web applications using Phonegap/Cordova where normal browser cache cannot be relied upon and where offline navigation is quite common.

Used with imagesloaded as shown in examples/example2.html, you can see that it can automatically:
* store images in cache
* replace images with cached version if they fail to load (offline / busy server..)
This is the best solution I have found so far to provide easy caching of images within a phonegap web app.

This library works with Phonegap/Cordova 1.7 so the supported platforms should be:
* Android [TESTED]
* iOS [TESTED]
* BlackBerry WebWorks (OS 5.0 and higher)
* Windows Phone 7 ( Mango )

It has also been made to work with the original html5 File API - currently only implemented in recent Chrome versions - to speed up testing of a whole web application from the desktop.

All methods are asynchronous : use callbacks if required.

Requirements
------------
* jQuery (any version from 1.6 should do)
* Phonegap/Cordova *optional* : >= v1.7
* [imagesloaded] (http://desandro.github.com/imagesloaded/) *optional*

Release Notes
-------------
* v0.4 Set cache files to not be backed up by iCloud (iOS only - requires Cordova 1.8+)
* v0.3 Added granularity to log entries + callbacks to all asynchronous methods + automated tests page
* v0.2 Cached filenames are now using hash of source url (SHA-1)
* v0.1 Initial release

License
-------
Copyright 2012 (c) Christophe BENOIT

Apache License - see LICENSE.md

Code from http://code.google.com/p/tiny-sha1/ is being used which is under the MIT License.
The copyright for this part belongs to the creator of this work.

High level API
--------------
* ImgCache.init() *initialises the local cache*
* ImgCache.cacheFile() *writes a copy of a file into the local cache*
* ImgCache.useCachedFile() *replaces the img src with the cached version*
* ImgCache.useOnlineFile() *replaces back the img src with the original (online) version*

* ImgCache.clear() *clears the local cache folder*

Options
-------
See ImgCache.options at the top of the source file for the list of options.
Options can be overriden from your own script, no need to modify the library!

Code samples
------------
See html files in the examples/ folder.

Notes
-----
Used with Phonegap/Cordova:
* Requires the File API permission in config.xml:
```xml
<feature name="http://api.phonegap.com/1.0/file"/>
```
* ImgCache.init() to be called onDeviceReady, not before!
* Remember to allow access to remote files by adding your domain in config.xml - or all domains using a wildcard:
```xml
<access origin="*" />
```

Used with Chrome (v > 12 I believe..) or future browsers that support the html5 filesystem API:
* Beware of cross domain ajax issue! retrieve image from the same domain or set CORS solutions with the server..
* If page opened locally (file:// ..), chrome needs to be loaded with the following flags:
```
--allow-file-access-from-files --allow-file-access
```
otherwise the local filesystem will not be accessible (security error)
* To navigate through the local filesystem open a new tab with filesystem:http://<sitedomain>/persistent/

Todo
----
* Find a solution for cache invalidation in case an image changes
* When Chrome finally supports canvas.toBlob(), possibly replace download method with new one that draws an Image into a canvas and then retrieves its content using the toBlob() method -- or use [canvas-toBlob.js] (https://github.com/eligrey/canvas-toBlob.js)
