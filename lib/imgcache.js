/*! imgcache.js
  Copyright 2012-2018 Christophe BENOIT

  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
*/

/*jslint browser:true*/
/*global console,LocalFileSystem,device,FileTransfer,define,module,cordova,phonegap*/

var ImgCacheConstants = Object.freeze({
  version: '2.1.0',
  LOG_LEVEL_INFO : 1,
  LOG_LEVEL_WARNING : 2,
  LOG_LEVEL_ERROR : 3
});

var ImgCacheConfiguration = function(){
  this.options = {
    debug: false,                           /* call the log method ? */
    localCacheFolder: 'imgcache',           /* name of the cache folder */
    useDataURI: false,                      /* use src="data:.."? otherwise will use src="filesystem:.." */
    chromeQuota: 10 * 1024 * 1024,          /* allocated cache space : here 10MB */
    usePersistentCache: true,               /* false = use temporary cache storage */
    cacheClearSize: 0,                      /* size in MB that triggers cache clear on init, 0 to disable */
    headers: {},                            /* HTTP headers for the download requests -- e.g: headers: { 'Accept': 'application/jpg' } */
    withCredentials: false,                 /* indicates whether or not cross-site Access-Control requests should be made using credentials */
    skipURIencoding: false,                 /* enable if URIs are already encoded (skips call to sanitizeURI) */
    cordovaFilesystemRoot: null,            /* if specified, use one of the Cordova File plugin's app directories for storage */
    timeout: 0                              /* timeout delay in ms for xhr request */
  };

  this.overridables = {
    hash: function (s) {
      /* tiny-sha1 r4 (11/2011) - MIT License - http://code.google.com/p/tiny-sha1/ */
      /* jshint ignore:start */
      function U(a,b,c){while(0<c--)a.push(b)}function L(a,b){return(a<<b)|(a>>>(32-b))}function P(a,b,c){return a^b^c}function A(a,b){var c=(b&0xFFFF)+(a&0xFFFF),d=(b>>>16)+(a>>>16)+(c>>>16);return((d&0xFFFF)<<16)|(c&0xFFFF)}var B="0123456789abcdef";return(function(a){var c=[],d=a.length*4,e;for(var i=0;i<d;i++){e=a[i>>2]>>((3-(i%4))*8);c.push(B.charAt((e>>4)&0xF)+B.charAt(e&0xF))}return c.join('')}((function(a,b){var c,d,e,f,g,h=a.length,v=0x67452301,w=0xefcdab89,x=0x98badcfe,y=0x10325476,z=0xc3d2e1f0,M=[];U(M,0x5a827999,20);U(M,0x6ed9eba1,20);U(M,0x8f1bbcdc,20);U(M,0xca62c1d6,20);a[b>>5]|=0x80<<(24-(b%32));a[(((b+65)>>9)<<4)+15]=b;for(var i=0;i<h;i+=16){c=v;d=w;e=x;f=y;g=z;for(var j=0,O=[];j<80;j++){O[j]=j<16?a[j+i]:L(O[j-3]^O[j-8]^O[j-14]^O[j-16],1);var k=(function(a,b,c,d,e){var f=(e&0xFFFF)+(a&0xFFFF)+(b&0xFFFF)+(c&0xFFFF)+(d&0xFFFF),g=(e>>>16)+(a>>>16)+(b>>>16)+(c>>>16)+(d>>>16)+(f>>>16);return((g&0xFFFF)<<16)|(f&0xFFFF)})(j<20?(function(t,a,b){return(t&a)^(~t&b)}(d,e,f)):j<40?P(d,e,f):j<60?(function(t,a,b){return(t&a)^(t&b)^(a&b)}(d,e,f)):P(d,e,f),g,M[j],O[j],L(c,5));g=f;f=e;e=L(d,30);d=c;c=k}v=A(v,c);w=A(w,d);x=A(x,e);y=A(y,f);z=A(z,g)}return[v,w,x,y,z]}((function(t){var a=[],b=255,c=t.length*8;for(var i=0;i<c;i+=8){a[i>>5]|=(t.charCodeAt(i/8)&b)<<(24-(i%32))}return a}(s)).slice(),s.length*8))));
      /* jshint ignore:end */
    },
    log: function (str, level) {
      'use strict';
      if (this.options.debug) {
        if (level === ImgCacheConstants.LOG_LEVEL_INFO) { str = 'INFO: ' + str; }
        if (level === ImgCacheConstants.LOG_LEVEL_WARNING) { str = 'WARN: ' + str; }
        if (level === ImgCacheConstants.LOG_LEVEL_ERROR) { str = 'ERROR: ' + str; }
        console.log(str);
      }
    }
  };
};

var DefaultConfiguration = new ImgCacheConfiguration();

(function ($) {
  'use strict';

  /** Helpers *****************************************************************/

  var Helpers = function Helpers(imgCache){
    this.imgCache = imgCache;
  };

  // make sure the url does not contain funny characters like spaces that might make the download fail
  Helpers.prototype.sanitizeURI = function (uri) {
    if (this.imgCache.options.skipURIencoding) {
      return uri;
    } else {
      if (uri.length >= 2 && uri[0] === '"' && uri[uri.length - 1] === '"') {
        uri = uri.substr(1, uri.length - 2);
      }
      var encodedURI = encodeURI(uri);
      /*
      TODO: The following bit of code will have to be checked first (#30)
      if (this.isCordova()) {
          return encodedURI.replace(/%/g, '%25');
      }
      */
      return encodedURI;
    }
  };

  // with a little help from http://code.google.com/p/js-uri/
  Helpers.prototype.URI = function (str) {
    if (!str) { str = ''; }
    // Based on the regex in RFC2396 Appendix B.
    var parser = /^(?:([^:\/?\#]+):)?(?:\/\/([^\/?\#]*))?([^?\#]*)(?:\?([^\#]*))?(?:\#(.*))?/,
        result = str.match(parser);
    this.scheme    = result[1] || null;
    this.authority = result[2] || null;
    this.path      = result[3] || null;
    this.query     = result[4] || null;
    this.fragment  = result[5] || null;
  };
  // returns lower cased filename from full URI
  Helpers.prototype.URIGetFileName = function (fullpath) {
    if (!fullpath) {
      return;
    }
    //TODO: there must be a better way here.. (url encoded strings fail)
    var idx = fullpath.lastIndexOf('/');
    if (!idx) {
      return;
    }
    return fullpath.substr(idx + 1).toLowerCase();
  };

  // returns lower cased path from full URI
  Helpers.prototype.URIGetPath = function (str) {
    if (!str) {
      return;
    }
    var uri = this.URI(str);
    return uri.path.toLowerCase();
  };

  // returns extension from filename (without leading '.')
  Helpers.prototype.fileGetExtension = function (filename) {
    if (!filename) {
      return '';
    }
    filename = filename.split('?')[0];
    var ext = filename.split('.').pop();
    // make sure it's a realistic file extension - for images no more than 4 characters long (.jpeg)
    if (!ext || ext.length > 4) {
      return '';
    }
    return ext;
  };

  Helpers.prototype.appendPaths = function (path1, path2) {
    if (!path2) {
      path2 = '';
    }
    if (!path1 || path1 === '') {
      return (path2.length > 0 && path2[0] == '/' ? '' : '/') + path2;
    }
    return path1 + ( ((path1[path1.length - 1] == '/') || (path2.length > 0 && path2[0] == '/')) ? '' : '/' ) + path2;
  };

  Helpers.prototype.hasJqueryOrJqueryLite = function () {
    return (this.imgCache.jQuery || this.imgCache.jQueryLite);
  };

  Helpers.prototype.isCordova = function () {
    return (typeof cordova !== 'undefined' || typeof phonegap !== 'undefined') && (cordova||phonegap).platformId !== 'browser';
  };

  Helpers.prototype.isCordovaAndroid = function () {
    return (this.isCordova() && device && device.platform && device.platform.toLowerCase().indexOf('android') >= 0);
  };

  Helpers.prototype.isCordovaWindowsPhone = function () {
    return (this.isCordova() && device && device.platform && ((device.platform.toLowerCase().indexOf('win32nt') >= 0) || (device.platform.toLowerCase().indexOf('windows') >= 0)));
  };

  Helpers.prototype.isCordovaIOS = function () {
    return (this.isCordova() && device && device.platform && device.platform.toLowerCase() === 'ios');
  };

  // special case for #93
  Helpers.prototype.isCordovaAndroidOlderThan3_3 = function () {
    return (this.isCordovaAndroid() && device.version && (
      device.version.indexOf('2.') === 0 ||
      device.version.indexOf('3.0') === 0 ||
      device.version.indexOf('3.1') === 0 ||
      device.version.indexOf('3.2') === 0
    ));
  };

  // special case for #47
  Helpers.prototype.isCordovaAndroidOlderThan4 = function () {
    return (this.isCordovaAndroid() && device.version && (device.version.indexOf('2.') === 0 || device.version.indexOf('3.') === 0));
  };

  // Fix for #42 (Cordova versions < 4.0)
  Helpers.prototype.EntryToURL = function (entry) {
    if (this.isCordovaAndroidOlderThan4() && typeof entry.toNativeURL === 'function') {
      return entry.toNativeURL();
    } else if (typeof entry.toInternalURL === 'function') {
      // Fix for #97
      return entry.toInternalURL();
    } else {
      return entry.toURL();
    }
  };

  // Returns a URL that can be used to locate a file
  Helpers.prototype.EntryGetURL = function (entry) {
    // toURL for html5, toURI for cordova 1.x
    return (typeof entry.toURL === 'function' ? this.EntryToURL(entry) : entry.toURI());
  };

  // Returns the full absolute path from the root to the FileEntry
  Helpers.prototype.EntryGetPath = function (entry) {
    if (this.isCordova()) {
      // #93
      if (this.isCordovaIOS()) {
        if (this.isCordovaAndroidOlderThan3_3()) {
          return entry.fullPath;
        } else {
          return entry.nativeURL;
        }
      }
      // From Cordova 3.3 onward toURL() seems to be required instead of fullPath (#38)
      return (typeof entry.toURL === 'function' ? this.EntryToURL(entry) : entry.fullPath);
    } else {
      return entry.fullPath;
    }
  };

  Helpers.prototype.getCordovaStorageType = function (isPersistent) {
    // From Cordova 3.1 onward those constants have moved to the window object (#38)
    if (typeof LocalFileSystem !== 'undefined') {
      if (isPersistent && LocalFileSystem.hasOwnProperty('PERSISTENT')) {
        return LocalFileSystem.PERSISTENT;
      }
      if (!isPersistent && LocalFileSystem.hasOwnProperty('TEMPORARY')) {
        return LocalFileSystem.TEMPORARY;
      }
    }
    return (isPersistent ? window.PERSISTENT : window.TEMPORARY);
  };

  /****************************************************************************/

  /** DomHelpers **************************************************************/

  var DomHelpers = function DomHelpers(imgCache){
    this.imgCache = imgCache;
    this.helpers = new Helpers(imgCache);
  };

  DomHelpers.prototype.trigger = function (DomElement, eventName) {
    if (this.imgCache.jQuery) {
      $(DomElement).trigger(eventName);
    } else {
      /* CustomEvent polyfill */
      if (this.helpers.isCordovaWindowsPhone() || !window.CustomEvent) {
        // CustomEvent for browsers which don't natively support the Constructor method
        window.CustomEvent = function CustomEvent(type, params) {
          var event;
          params = params || {bubbles: false, cancelable: false, detail: undefined};
          try {
            event = document.createEvent('CustomEvent');
            event.initCustomEvent(type, params.bubbles, params.cancelable, params.detail);
          } catch (error) {
            // for browsers that don't support CustomEvent at all, we use a regular event instead
            event = document.createEvent('Event');
            event.initEvent(type, params.bubbles, params.cancelable);
            event.detail = params.detail;
          }
          return event;
        };
      }
      DomElement.dispatchEvent(new CustomEvent(eventName));
    }
  };

  DomHelpers.prototype.removeAttribute = function (element, attrName) {
    if (this.helpers.hasJqueryOrJqueryLite()) {
      element.removeAttr(attrName);
    } else {
      element.removeAttribute(attrName);
    }
  };
  DomHelpers.prototype.setAttribute = function (element, attrName, value) {
    if (this.helpers.hasJqueryOrJqueryLite()) {
      element.attr(attrName, value);
    } else {
      element.setAttribute(attrName, value);
    }
  };
  DomHelpers.prototype.getAttribute = function (element, attrName) {
    if (this.helpers.hasJqueryOrJqueryLite()) {
      return element.attr(attrName);
    } else {
      return element.getAttribute(attrName);
    }
  };
  DomHelpers.prototype.getBackgroundImage = function (element) {
    if (this.helpers.hasJqueryOrJqueryLite()) {
      return element.attr('data-old-background') ? "url(" + element.attr('data-old-background') + ")" : element.css('background-image');
    } else {
      var style = window.getComputedStyle(element, null);
      if (!style) {
        return;
      }
      return element.getAttribute("data-old-background") ? "url(" + element.getAttribute("data-old-background") + ")" : style.backgroundImage;
    }
  };
  DomHelpers.prototype.setBackgroundImage = function (element, styleValue) {
    if (this.helpers.hasJqueryOrJqueryLite()) {
      element.css('background-image', styleValue);
    } else {
      element.style.backgroundImage = styleValue;
    }
  };

  /****************************************************************************/

  /** Private *****************************************************************/

  var Private = function Private(imgCache){
    this.imgCache = imgCache;
    this.helpers = new Helpers(imgCache);
    this.domHelpers = new DomHelpers(imgCache);
    this.attributes = { hasLocalStorage:false };
  }
  Private.attributes = {};

  Private.prototype.isImgCacheLoaded = function () {
    if (!this.imgCache.attributes.filesystem || !this.imgCache.attributes.dirEntry) {
      this.imgCache.overridables.log('ImgCache not loaded yet! - Have you called ImgCache.init() first?', ImgCacheConstants.LOG_LEVEL_WARNING);
      return false;
    }
    return true;
  };

  Private.prototype.hasLocalStorage = function () {
    // if already tested, avoid doing the check again
    if (this.attributes.hasLocalStorage) {
      return this.attributes.hasLocalStorage;
    }
    try {
      var mod = this.imgCache.overridables.hash('imgcache_test');
      localStorage.setItem(mod, mod);
      localStorage.removeItem(mod);
      this.attributes.hasLocalStorage = true;
      return true;
    } catch (e) {
      // this is an info, not an error
      this.imgCache.overridables.log('Could not write to local storage: ' + e.message, ImgCacheConstants.LOG_LEVEL_INFO);
      return false;
    }
  };

  Private.prototype.setCurrentSize = function (curSize) {
    this.imgCache.overridables.log('current size: ' + curSize, ImgCacheConstants.LOG_LEVEL_INFO);
    if (this.hasLocalStorage()) {
      localStorage.setItem('imgcache:' + this.imgCache.options.localCacheFolder, curSize);
    }
  };

  Private.prototype.getCachedFilePath = function (img_src) {
    return this.helpers.appendPaths(this.imgCache.options.localCacheFolder, this.getCachedFileName(img_src));
  };

  // used for FileTransfer.download only
  Private.prototype.getCachedFileFullPath = function (img_src) {
    var local_root = this.helpers.EntryGetPath(this.imgCache.attributes.dirEntry);
    return this.helpers.appendPaths(local_root, this.getCachedFileName(img_src));
  };

  Private.prototype.getCachedFileName = function (img_src) {
    if (!img_src) {
      this.imgCache.overridables.log('No source given to getCachedFileName', ImgCacheConstants.LOG_LEVEL_WARNING);
      return;
    }
    var hash = this.imgCache.overridables.hash(img_src);
    var ext = this.helpers.fileGetExtension(this.helpers.URIGetFileName(img_src));
    return hash + (ext ? ('.' + ext) : '');
  };

  Private.prototype.setNewImgPath = function ($img, new_src, old_src) {
    this.domHelpers.setAttribute($img, 'src', new_src);
    // store previous url in case we need to reload it
    this.domHelpers.setAttribute($img, OLD_SRC_ATTR, old_src);
  };

  Private.prototype.createCacheDir = function (success_callback, error_callback) {
    if (!this.imgCache.attributes.filesystem) {
      this.imgCache.overridables.log('Filesystem instance was not initialised', ImgCacheConstants.LOG_LEVEL_ERROR);
      if (error_callback) { error_callback(); }
      return;
    }
    var _fail = function (error) {
      this.imgCache.overridables.log('Failed to get/create local cache directory: ' + error.code, ImgCacheConstants.LOG_LEVEL_ERROR);
      if (error_callback) { error_callback(); }
    }.bind(this);
    var _getDirSuccess = function (dirEntry) {
      this.imgCache.attributes.dirEntry = dirEntry;
      this.imgCache.overridables.log('Local cache folder opened: ' + this.helpers.EntryGetPath(dirEntry), ImgCacheConstants.LOG_LEVEL_INFO);

      //Put .nomedia file in cache directory so Android doesn't index it.
      if (this.helpers.isCordovaAndroid()) {
        var _androidNoMediaFileCreated = function () {
          this.imgCache.overridables.log('.nomedia file created.', ImgCacheConstants.LOG_LEVEL_INFO);
          if (success_callback) { success_callback(); }
        }.bind(this);

        dirEntry.getFile('.nomedia', {create: true, exclusive: false}, _androidNoMediaFileCreated, _fail);
      } else if (!this.helpers.isCordovaWindowsPhone()) {
        // #73 - iOS: the directory should not be backed up in iCloud
        if (this.helpers.isCordovaIOS() && dirEntry.setMetadata) {
          dirEntry.setMetadata(function () {
            /* success*/
            this.imgCache.overridables.log('com.apple.MobileBackup metadata set', ImgCacheConstants.LOG_LEVEL_INFO);
          }.bind(this), function () {
            /* failure */
            this.imgCache.overridables.log('com.apple.MobileBackup metadata could not be set', ImgCacheConstants.LOG_LEVEL_WARNING);
          }.bind(this),
          {
            // 1=NO backup oddly enough..
            'com.apple.MobileBackup': 1
          });
        }

        if (success_callback) { success_callback(); }
      } else {
        if (success_callback) { success_callback(); }
      }

      this.imgCache.ready = true;
      this.domHelpers.trigger(document, IMGCACHE_READY_TRIGGERED_EVENT);
    }.bind(this);
    this.imgCache.attributes.filesystem.root.getDirectory(this.imgCache.options.localCacheFolder, {create: true, exclusive: false}, _getDirSuccess, _fail);
  };

  // This is a wrapper for phonegap's FileTransfer object in order to implement the same feature
  // in Chrome (and possibly extra browsers in the future)
  var FileTransferWrapper = function FileTransferWrapper(imgCache, filesystem) {
    this.imgCache = imgCache;
    this.helpers = imgCache.helpers;

    if (this.helpers.isCordova()) {
      // PHONEGAP
      this.fileTransfer = new FileTransfer();
    }
    this.filesystem = filesystem;    // only useful for CHROME
  };
  FileTransferWrapper.prototype.download = function (uri, localPath, success_callback, error_callback, on_progress) {
    var headers = this.imgCache.options.headers || {};
    var isOnProgressAvailable = (typeof on_progress === 'function');

    if (this.fileTransfer) {
      if (isOnProgressAvailable) {
        this.fileTransfer.onprogress = on_progress;
      }

      var resolverQuery = new XMLHttpRequest();
      resolverQuery.open('HEAD', uri, true);
      if (this.imgCache.options.withCredentials) {
        resolverQuery.withCredentials = true;
      }
      resolverQuery.timeout = ImgCache.options.timeout;
      resolverQuery.onload = function (event) {
        return this.fileTransfer.download(event.currentTarget.responseURL, localPath, success_callback, error_callback, false, { 'headers': headers });
      }.bind(this);

      return resolverQuery.send();
    }

    var filesystem = this.filesystem;

    // CHROME - browsers
    var _fail = function (str, level, error_callback) {
      this.imgCache.overridables.log(str, level);
      // mock up FileTransferError, so at least caller knows there was a problem.
      // Normally, the error.code in the callback is a FileWriter error, we return 0 if the error was an XHR error
      if (error_callback) {
        error_callback({code: 0, source: uri, target: localPath});
      }
    }.bind(this);
    var xhr = new XMLHttpRequest();
    xhr.open('GET', uri, true);
    if (isOnProgressAvailable) {
      xhr.onprogress = on_progress;
    }
    if (this.imgCache.options.withCredentials) {
      xhr.withCredentials = true;
    }
    xhr.timeout = ImgCache.options.timeout;
    xhr.responseType = 'blob';
    for (var key in headers) {
      xhr.setRequestHeader(key, headers[key]);
    }
    xhr.onload = function () {
      if (xhr.response && (xhr.status === 200 || xhr.status === 0)) {
        filesystem.root.getFile(localPath, { create:true }, function (fileEntry) {
          fileEntry.createWriter(function (writer) {
            writer.onerror = error_callback;
            writer.onwriteend = function () { success_callback(fileEntry);  };
            writer.write(xhr.response, error_callback);
          }, error_callback);
        }, error_callback);
      } else {
        _fail('Image ' + uri + ' could not be downloaded - status: ' + xhr.status, 3, error_callback);
      }
    };
    xhr.onerror = function () {
      _fail('XHR error - Image ' + uri + ' could not be downloaded - status: ' + xhr.status, 3, error_callback);
    };
    xhr.ontimeout = function () {
      _fail('XHR error - Image ' + uri + ' timed out - status: ' + xhr.status, 3, error_callback);
    };
    xhr.send();
  };

  Private.prototype.getBackgroundImageURL = function ($div) {
    var backgroundImageProperty = this.domHelpers.getBackgroundImage($div);
    if (!backgroundImageProperty) {
      return;
    }
    var regexp = /url\s?\((.+)\)/;
    var img_src = regexp.exec(backgroundImageProperty)[1];
    return img_src.replace(/(['"])/g, '');
  };

  Private.prototype.getBase64DataFromEntry = function (entry, filename, success_callback, error_callback) {
    var _success = function (file) {
      var reader = new FileReader();
      reader.onloadend = function (e) {
        var base64content = e.target.result;
        if (base64content) {
          this.imgCache.overridables.log('File ' + filename + ' loaded from cache', ImgCacheConstants.LOG_LEVEL_INFO);
          if (success_callback) { success_callback(base64content); }
        } else {
          this.imgCache.overridables.log('File in cache ' + filename + ' is empty', ImgCacheConstants.LOG_LEVEL_WARNING);
          if (error_callback) { error_callback(filename); }
        }
      }.bind(this);
      reader.readAsDataURL(file);
    }.bind(this);
    var _failure = function (error) {
      this.imgCache.overridables.log('Failed to read file ' + error.code, ImgCacheConstants.LOG_LEVEL_ERROR);
      if (error_callback) { error_callback(filename); }
    }.bind(this);

    entry.file(_success, _failure);
  };

  Private.prototype.loadCachedFile = function ($element, img_src, set_path_callback, success_callback, error_callback) {
    if (!this.isImgCacheLoaded()) {
      return;
    }

    if (!$element) {
      this.imgCache.overridables.log('First parameter of loadCachedFile is empty, should be a DOM element', ImgCacheConstants.LOG_LEVEL_ERROR);
      return;
    }

    var filename = this.helpers.URIGetFileName(img_src);

    var _gotFileEntry = function (entry) {
      if (this.imgCache.options.useDataURI) {
        this.getBase64DataFromEntry(entry, filename, function (base64content) {
          set_path_callback($element, base64content, img_src);
          if (success_callback) { success_callback($element); }
        }, function () {
          if (error_callback) { error_callback($element); }
        });
      } else {
        // using src="filesystem:" kind of url
        var new_url = this.helpers.EntryGetURL(entry);
        set_path_callback($element, new_url, img_src);
        this.imgCache.overridables.log('File ' + filename + ' loaded from cache', ImgCacheConstants.LOG_LEVEL_INFO);
        if (success_callback) { success_callback($element); }
      }
    }.bind(this);
    // if file does not exist in cache, cache it now!
    var _fail = function () {
      this.imgCache.overridables.log('File ' + filename + ' not in cache', ImgCacheConstants.LOG_LEVEL_INFO);
      if (error_callback) { error_callback($element); }
    }.bind(this);
    this.imgCache.attributes.filesystem.root.getFile(this.getCachedFilePath(img_src), {create: false}, _gotFileEntry, _fail);
  };

  Private.prototype.setBackgroundImagePath = function ($element, new_src, old_src) {
    this.domHelpers.setBackgroundImage($element, 'url("' + new_src + '")');
    // store previous url in case we need to reload it
    this.domHelpers.setAttribute($element, OLD_BACKGROUND_ATTR, old_src);
  };

  /****************************************************************************/

  var OLD_SRC_ATTR = 'data-old-src',
      OLD_BACKGROUND_ATTR = 'data-old-background',
      IMGCACHE_READY_TRIGGERED_EVENT = 'ImgCacheReady';

  var ImgCache = function ImgCache (options) {
    // First assign the global default configuration, so we inherit global user configuration.
    this.options = {};
    this.overridables = {};
    Object.assign(this.options, DefaultConfiguration.options);
    Object.assign(this.overridables, DefaultConfiguration.overridables);

    // Assign any possibly passed option overrides for this cache.
    if (options) {
      Object.assign(this.options, options);
    }
    // Ensure the default logger is bound to this instance.
    this.overridables.log = this.overridables.log.bind(this);

    this.helpers = new Helpers(this);
    this.domHelpers = new DomHelpers(this);
    this.private = new Private(this);

    this.ready = false;
    this.attributes= {};
  };

  // Export the constants on the default cache instance.
  Object.assign(ImgCache, ImgCacheConstants);
  // Expoort the default configuration to allow the user to manipulate it.
  ImgCache.options = DefaultConfiguration;

  ImgCache.prototype.init = function (success_callback, error_callback) {
    this.jQuery = (window.jQuery || window.Zepto) ? true : false;        /* using jQuery if it's available otherwise the DOM API */
    this.jQueryLite = (typeof window.angular !== 'undefined' && window.angular.element) ? true : false;    /* is AngularJS jQueryLite available */

    this.attributes.init_callback = success_callback;

    this.overridables.log('ImgCache initialising', ImgCacheConstants.LOG_LEVEL_INFO);

    var _checkSize = function (callback) {
      if (this.options.cacheClearSize > 0) {
        var curSize = this.getCurrentSize();
        if (curSize > (this.options.cacheClearSize * 1024 * 1024)) {
          this.clearCache(callback, callback);
        } else {
          if (callback) { callback(); }
        }
      } else {
        if (callback) { callback(); }
      }
    }.bind(this);
    var _gotFS = function (filesystem) {
      this.overridables.log('LocalFileSystem opened', ImgCacheConstants.LOG_LEVEL_INFO);

      // store filesystem handle
      this.attributes.filesystem = filesystem;

      this.private.createCacheDir(function () {
        _checkSize(this.attributes.init_callback);
      }.bind(this), error_callback);
    }.bind(this);
    var _fail = function (error) {
      this.overridables.log('Failed to initialise LocalFileSystem ' + error.code, ImgCacheConstants.LOG_LEVEL_ERROR);
      if (error_callback) { error_callback(); }
    }.bind(this);
    if (this.helpers.isCordova() && window.requestFileSystem) {
      // PHONEGAP
      if (this.options.cordovaFilesystemRoot) {
        try {
          window.resolveLocalFileSystemURL(
            this.options.cordovaFilesystemRoot,
            function (dirEntry) {
                _gotFS({ root: dirEntry });
            },
            _fail
          );
        } catch (e) {
          _fail({ code: e.message })
        }
      } else {
        window.requestFileSystem(this.helpers.getCordovaStorageType(this.options.usePersistentCache), 0, _gotFS, _fail);
      }
    } else {
      //CHROME
      var savedFS = window.requestFileSystem || window.webkitRequestFileSystem;
      window.storageInfo = window.storageInfo || (this.options.usePersistentCache ? navigator.webkitPersistentStorage : navigator.webkitTemporaryStorage);
      if (!window.storageInfo) {
        this.overridables.log('Your browser does not support the html5 File API', ImgCacheConstants.LOG_LEVEL_WARNING);
        if (error_callback) { error_callback(); }
        return;
      }
      // request space for storage
      var quota_size = this.options.chromeQuota;
      window.storageInfo.requestQuota(
        quota_size,
        function () {
          /* success*/
          var persistence = (this.options.usePersistentCache ? window.PERSISTENT : window.TEMPORARY);
          savedFS(persistence, quota_size, _gotFS, _fail);
        }.bind(this),
        function (error) {
          /* error*/
          this.overridables.log('Failed to request quota: ' + error.message, ImgCacheConstants.LOG_LEVEL_ERROR);
          if (error_callback) { error_callback(); }
        }.bind(this)
      );
    }

    return this;
  };

  ImgCache.prototype.constructNew = function (options) {
    return new ImgCache(options);
  }

  ImgCache.prototype.getCurrentSize = function () {
    if (this.private.hasLocalStorage()) {
      var curSize = localStorage.getItem('imgcache:' + this.options.localCacheFolder);
      if (curSize === null) {
        return 0;
      }
      return parseInt(curSize, 10);
    } else {
      return 0;
    }
  };

  // this function will not check if the image is already cached or not => it will overwrite existing data
  // on_progress callback follows this spec: http://www.w3.org/TR/2014/REC-progress-events-20140211/ -- see #54
  ImgCache.prototype.cacheFile = function (img_src, success_callback, error_callback, on_progress) {
    if (!this.private.isImgCacheLoaded() || !img_src) {
      return;
    }

    img_src = this.helpers.sanitizeURI(img_src);

    var filePath = this.private.getCachedFileFullPath(img_src);

    var fileTransfer = new FileTransferWrapper(this, this.attributes.filesystem);
    fileTransfer.download(
      img_src,
      filePath,
      function (entry) {
        entry.getMetadata(function (metadata) {
          if (metadata && ('size' in metadata)) {
            this.overridables.log('Cached file size: ' + metadata.size, ImgCacheConstants.LOG_LEVEL_INFO);
            this.private.setCurrentSize(this.getCurrentSize() + parseInt(metadata.size, 10));
          } else {
            this.overridables.log('No metadata size property available', ImgCacheConstants.LOG_LEVEL_INFO);
          }
        }.bind(this));
        this.overridables.log('Download complete: ' + this.helpers.EntryGetPath(entry), ImgCacheConstants.LOG_LEVEL_INFO);

        // iOS: the file should not be backed up in iCloud
        // new from cordova 1.8 only
        if (entry.setMetadata) {
          entry.setMetadata(
            function () {
              /* success*/
              this.overridables.log('com.apple.MobileBackup metadata set', ImgCacheConstants.LOG_LEVEL_INFO);
            }.bind(this),
            function () {
              /* failure */
              this.overridables.log('com.apple.MobileBackup metadata could not be set', ImgCacheConstants.LOG_LEVEL_WARNING);
            }.bind(this),
            {
              // 1=NO backup oddly enough..
              'com.apple.MobileBackup': 1
            }
          );
        }

        if (success_callback) {
          success_callback(entry.toURL());
        }
      }.bind(this),
      function (error) {
        if (error.source) { this.overridables.log('Download error source: ' + error.source, ImgCacheConstants.LOG_LEVEL_ERROR); }
        if (error.target) { this.overridables.log('Download error target: ' + error.target, ImgCacheConstants.LOG_LEVEL_ERROR); }
        this.overridables.log('Download error code: ' + error.code, ImgCacheConstants.LOG_LEVEL_ERROR);
        if (error_callback) { error_callback(); }
      }.bind(this),
      on_progress
    );
  };

  // Returns the file already available in the cached
  // Reminder: this is an asynchronous method!
  // Answer to the question comes in response_callback as the second argument (first being the path)
  ImgCache.prototype.getCachedFile = function (img_src, response_callback) {
    // sanity check
    if (!this.private.isImgCacheLoaded() || !response_callback) {
      return;
    }

    var original_img_src = img_src;
    img_src = this.helpers.sanitizeURI(img_src);

    var path = this.private.getCachedFilePath(img_src);
    if (this.helpers.isCordovaAndroid()) {
      // This hack is probably only used for older versions of Cordova
      if (path.indexOf('file://') === 0) {
        // issue #4 -- android cordova specific
        path = path.substr(7);
      }
    }

    // try to get the file entry: if it fails, there's no such file in the cache
    this.attributes.filesystem.root.getFile(
      path,
      { create: false },
      function (file_entry) { response_callback(img_src, file_entry); },
      function () { response_callback(original_img_src, null); }
    );
  };

  // Returns the local url of a file already available in the cache
  ImgCache.prototype.getCachedFileURL = function (img_src, success_callback, error_callback) {
    var _getURL = function (img_src, entry) {
      if (entry) {
        success_callback(img_src, this.helpers.EntryGetURL(entry));
      } else {
        if (error_callback) { error_callback(img_src); }
      }
    }.bind(this);

    this.getCachedFile(img_src, _getURL);
  };

  ImgCache.prototype.getCachedFileBase64Data = function (img_src, success_callback, error_callback) {
    var _getData = function(img_src, entry) {
      if (entry) {
        this.private.getBase64DataFromEntry(entry, img_src, function (base64content) {
          success_callback(img_src, base64content);
        }, error_callback);
      } else {
        if (error_callback) { error_callback(img_src); }
      }
    }.bind(this);

    this.getCachedFile(img_src, _getData);
  };

  // checks if a copy of the file has already been cached
  // Reminder: this is an asynchronous method!
  // Answer to the question comes in response_callback as the second argument (first being the path)
  ImgCache.prototype.isCached = function (img_src, response_callback) {
    this.getCachedFile(img_src, function (src, file_entry) {
      response_callback(src, file_entry !== null);
    });
  };

  // $img: jQuery object of an <img/> element
  // Synchronous method
  ImgCache.prototype.useOnlineFile = function ($img) {
    if (!this.private.isImgCacheLoaded() || !$img) {
      return;
    }

    var prev_src = this.domHelpers.getAttribute($img, OLD_SRC_ATTR);
    if (prev_src) {
      this.domHelpers.setAttribute($img, 'src', prev_src);
    }
    this.domHelpers.removeAttribute($img, OLD_SRC_ATTR);
  };


  // $img: jQuery object of an <img/> element
  ImgCache.prototype.useCachedFile = function ($img, success_callback, error_callback) {
    if (!this.private.isImgCacheLoaded()) {
      return;
    }

    var img_url = this.helpers.sanitizeURI(this.domHelpers.getAttribute($img, 'src'));

    this.private.loadCachedFile($img, img_url, this.private.setNewImgPath.bind(this), success_callback, error_callback);
  };

  // When the source url is not the 'src' attribute of the given img element
  ImgCache.prototype.useCachedFileWithSource = function ($img, image_url, success_callback, error_callback) {
    if (!this.private.isImgCacheLoaded()) {
      return;
    }

    var img_url = this.helpers.sanitizeURI(image_url);

    this.private.loadCachedFile($img, img_url, this.private.setNewImgPath.bind(this), success_callback, error_callback);
  };

  // clears the cache
  ImgCache.prototype.clearCache = function (success_callback, error_callback) {
    if (!this.private.isImgCacheLoaded()) {
      return;
    }

    // delete cache dir completely
    this.attributes.dirEntry.removeRecursively(
      function () {
        this.overridables.log('Local cache cleared', ImgCacheConstants.LOG_LEVEL_INFO);
        this.private.setCurrentSize(0);
        // recreate the cache dir now
        this.private.createCacheDir(success_callback, error_callback);
      }.bind(this),
      function (error) {
        this.overridables.log('Failed to remove directory or its contents: ' + error.code, ImgCacheConstants.LOG_LEVEL_ERROR);
        if (error_callback) { error_callback(); }
      }.bind(this)
    );
  };

  ImgCache.prototype.removeFile = function (img_src, success_callback, error_callback) {
    img_src = this.helpers.sanitizeURI(img_src);

    var filePath = this.private.getCachedFilePath(img_src);
    var _fail = function (error) {
      this.overridables.log('Failed to remove file due to ' + error.code, ImgCacheConstants.LOG_LEVEL_ERROR);
      if (error_callback) { error_callback(); }
    }.bind(this);
    this.attributes.filesystem.root.getFile(filePath, { create: false }, function (fileEntry) {
      fileEntry.remove(
        function () {
          if (success_callback) { success_callback(); }
        },
        _fail
      );
    }, _fail);
  };

  ImgCache.prototype.isBackgroundCached = function ($div, response_callback) {
    var img_src = this.private.getBackgroundImageURL($div);
    this.getCachedFile(img_src, function (src, file_entry) {
      response_callback(src, file_entry !== null);
    });
  };

  ImgCache.prototype.cacheBackground = function ($div, success_callback, error_callback, on_progress) {
    if (!this.private.isImgCacheLoaded()) {
      return;
    }

    var img_src = this.private.getBackgroundImageURL($div);
    if (!img_src) {
      this.overridables.log('No background to cache', ImgCacheConstants.LOG_LEVEL_WARNING);
      if (error_callback) { error_callback(); }
      return;
    }

    this.overridables.log('Background image URL: ' + img_src, ImgCacheConstants.LOG_LEVEL_INFO);
    this.cacheFile(img_src, success_callback, error_callback, on_progress);
  };

  ImgCache.prototype.useCachedBackground = function ($div, success_callback, error_callback) {
    if (!this.private.isImgCacheLoaded()) {
      return;
    }

    var img_src = this.private.getBackgroundImageURL($div);
    if (!img_src) {
      this.overridables.log('No background to cache', ImgCacheConstants.LOG_LEVEL_WARNING);
      if (error_callback) { error_callback(); }
      return;
    }

    this.private.loadCachedFile($div, img_src, this.private.setBackgroundImagePath, success_callback, error_callback);
  };

  ImgCache.prototype.useCachedBackgroundWithSource = function ($div, image_url, success_callback, error_callback) {
    if (!this.private.isImgCacheLoaded()) {
      return;
    }

    this.private.loadCachedFile($div, image_url, this.private.setBackgroundImagePath, success_callback, error_callback);
  };

  // $div: jQuery object of an element
  // Synchronous method
  // Method used to revert call to useCachedBackground
  ImgCache.prototype.useBackgroundOnlineFile = function ($div) {
    if (!$div) {
      return;
    }

    var prev_src = this.domHelpers.getAttribute($div, OLD_BACKGROUND_ATTR);
    if (prev_src) {
      this.domHelpers.setBackgroundImage($div, 'url("' + prev_src + '")');
    }
    this.domHelpers.removeAttribute($div, OLD_BACKGROUND_ATTR);
  };

  // returns the URI of the local cache folder (filesystem:)
  // this function is more useful for the examples than for anything else..
  // Synchronous method
  ImgCache.prototype.getCacheFolderURI = function () {
    if (!this.private.isImgCacheLoaded()) {
      return;
    }

    return this.helpers.EntryGetURL(this.attributes.dirEntry);
  };

  /****************************************************************************/

  // Expose the class either via AMD, CommonJS or the global object
  if (typeof define === 'function' && define.amd) {
    define('imgcache', [], function () {
      return new ImgCache();
    });
  }
  else if (typeof module === 'object' && module.exports){
    module.exports = new ImgCache();
  }
  else {
    window.ImgCache = new ImgCache();
  }

})(window.jQuery || window.Zepto || function () { throw "jQuery is not available"; } );
