# Known issues

## Cordova

* getCurrentSize() always returns 0 using Cordova Plugin File v1.0.0.
The problem is that the Metadata interface of a File entry does not have a *size* property thus it does not match the html5 specifications.
Looking at the code for this plugin, this should have been [fixed](https://github.com/apache/cordova-plugin-file/commit/9ac8e477c0fda6aed3878a4cf165257f00e1bf83) in v1.0.1 but unit test still fail on iOS.
