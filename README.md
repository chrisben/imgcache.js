imgcache.js
===========

Description
-----------
The purpose of this JS library is to cache images using the new html5 File API : if the page is viewed offline and its images are cached through this mechanism, they will be shown instead of an empty image.

It is especially useful for mobile web applications using Phonegap/Cordova where normal browser cache cannot be relied upon and where offline navigation is quite common.

Used with imagesloaded as shown in examples/example2.html, you can see that it can automatically:
* store images in cache
* replace images with cached version if fail to load
This is the best solution I have found so far to provide easy caching of images within a phonegap web app.

This library should work with Phonegap/Cordova 1.x so the supported platforms should be:
* Android
* BlackBerry WebWorks (OS 5.0 and higher)
* iOS
* Windows Phone 7 ( Mango )

It has also been made to work with the original html5 File API - currently only implemented in recent Chrome versions - to speed up testing of a whole web application from the desktop.

All methods are asynchronous. Use callbacks if required.

Requirements
------------
* jQuery (any version from 1.6 should do)
* Phonegap/Cordova *optional* : v1.x
* [imagesloaded] (http://desandro.github.com/imagesloaded/) *optional*

Release Notes
-------------
* v0.1 Initial release

License
-------
Copyright 2012 (c) Christophe BENOIT
Apache License http://www.apache.org/licenses/LICENSE-2.0

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
* [Known issue] (https://issues.apache.org/jira/browse/CB-539) with FileTransfer.download in Cordova 1.5+ 1.6x .. waiting for 1.7 for real tests..

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
* Automated tests
* Local files should be stored uniquely depending on their original full path: currently if two files have the same name, they will be overwritten
* Find a solution for cache invalidation in case an image changes
