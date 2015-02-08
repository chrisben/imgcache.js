# Release Notes #

## master ##

## 1.0rc1 ##

### NEW ###
* Added a wrapper for imgcache that supports Promises (qimgcache.js)
* Helpers, DomHelpers and Private classes are now available publicly via ImgCache.helpers, ImgCache.domHelpers and ImgCache.private respectively. Those are not just plain public because you generally shouldn't need them, though they're now accessible.

### FIXED ###
* Fixed issue on iOS devices (#93)

### IMPROVED ###
* Replaced tabs with whitespaces throughout the code and examples
* Readme: added a Troubleshooting section to help you solve the most common issues
* Readme: added links to angular wrappers for imgcache
* Reviewed examples

## 0.7.6 ##

### NEW ###
* Added support for Windows Phone 8.1 (IE11) (#92 thanks PhilippCh)
* Added isBackgroundCached method (#89, #90 thanks mattezell)

### FIXED ###
* Cache files path are now correct for iOS (#93 thanks mo3taz-abdallh)

## 0.7.5 ##

### IMPROVED ###
* ImgCache.getCachedFileURL: error callback is now optional (#79)
* Cache directory is no more backed up in iCloud (iOS) (#73)
* Added ability to override the hash method through ImgCache.overridables.hash, SHA-1 currently being the default. It's possible to plug in a faster alternative but be careful of possible collisions (#81)
* The log method used throughout ImgCache is now defined as an overridable option: ImgCache.overridables.log -- this replaces the previous 'customLogger' optional method (read Backward Compability Warning below)
* Fixed some JSLint issues

### BC WARNING ###
* ImgCache.options.customLogger has been changed to ImgCache.overridables.log

## 0.7.4 ##

### NEW ###
* Added ImgCache.getCachedFileURL helper function (#50, #67 thanks schuyler1d)

### FIXED ###
* Added missing error_callback call within ImgCache.init when root cache directory creation fails (#70)

## 0.7.3 ##

### NEW ###
* Added support for AngularJS (#64 - thanks antonshevchenko)

## 0.7.2 ##

### IMPROVED ###
* Removed last JSHint warnings
* Improved documentation: emphasized on the asynchronous behaviour of this library + removed TODO

### FIXED ###
* Fixed bugs in 0.7.1 (#61 - thanks activars)
* Fixed issue with newest Cordova and Android versions earlier than 4.x (#47 - thanks martinellimarco)

## 0.7.1 ##

### NEW ###
* Added option for custom download HTTP headers, can be used for request authentication purposes (#52 - thanks sjbecque)
* Added optional callback to cacheFile and cacheBackgroundFile methods to get download progress (#54 - thanks vincentjames501)
* Added getCachedFile method (#55 - thanks vincentjames501) + added unit tests
* Added option to skip URI encoding to avoid double encoding (#58 - thanks ryreitsma)
* Added compatibility with AMD/CommonJS (#59 - thanks activars)

### IMPROVED ###
* Reviewed code to remove JSLint warnings

### FIXED ###
* Added CustomEvent polyfill when Event is not defined (DOM API adapter) (#51)

## 0.7.0 ##

### NEW ###
* New method: ImgCache.removeFile (#33)
* New method: ImgCache.getCurrentSize + added ability to clear cache on init when used space is higher than a given value (#28)
* New method: ImgCache.useBackgroundOnlineFile to revert a call to useCachedBackground (#17)
* jQuery/Zepto is not a required dependency anymore, if not available it will be using only the DOM API (#29)
* Added API coverage check in unit test

### IMPROVED ###
* Unit tests are moved to index.html
* README has been improved and split into multiple files: CORDOVA.md contains all documentation related to Cordova/Phonegap
* Reorganised code to be clearer + added checks throughout the code where missing
* Updated unit tests for 100% API coverage and multiple options configurations
* config.xml has been updated for newest Cordova releases requirements

### FIXED ###
* Fixed issues with Cordova 3.3/3.4 (#35, #40 -- thanks to Lukáš Marek)

## Older releases ##

* 0.6.2 Added extra checks to make sure ImgCache is properly initialised first (#15) + added note in README about Phonegap plugins (#25)
* 0.6.1 Added useCachedFileWithSource (#21) + added Bower package definition
* 0.6   Updated deprecated Chrome storage API + Refactored code + improved automated test suites + fixes
* 0.5.2 Fixed isCache for Android  + now works with Zepto + using new Chrome Blob
* 0.5.1 Fixed behaviour of isCached method
* 0.5   Added isCached method (thanks to David Novakovic)
* 0.4   Set cache files to not be backed up by iCloud (iOS only - requires Cordova 1.8+)
* 0.3   Added granularity to log entries + callbacks to all asynchronous methods + automated tests page
* 0.2   Cached filenames are now using hash of source url (SHA-1)
* 0.1   Initial release
