/*! imgcache.js
   Copyright 2012-2014 Christophe BENOIT

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

var ImgCache = {
	version: '0.7.0',
	// options to override before using the library (but after loading this script!)
	options: {
		debug: false,								/* write log (to console)? */
		localCacheFolder: 'imgcache',				/* name of the cache folder */
		useDataURI: false,							/* use src="data:.."? otherwise will use src="filesystem:.." */
		chromeQuota: 10*1024*1024,					/* allocated cache space : here 10Mb */
		usePersistentCache: true,					/* false: use temporary cache storage */
		cacheClearSize : 0,             			/* size in Mb that triggers cache clear on init, 0 to disable */
		/* customLogger */							/* if function defined, will use this one to log events */
	},
	jQuery: (window.jQuery || window.Zepto) ? true : false,		/* using jQuery if it's available otherwise the DOM API */
	ready: false,
	attributes: {}
};

(function($) {

	var OLD_SRC_ATTR = 'data-old-src';
	var OLD_BACKGROUND_ATTR = 'data-old-background';
	var IMGCACHE_READY_TRIGGERED_EVENT = 'ImgCacheReady';

	ImgCache.init = function(success_callback, error_callback) {
		ImgCache.attributes.init_callback = success_callback;

		var _gotFS = function(filesystem) {
			Helpers.logging('LocalFileSystem opened', LOG_LEVEL_INFO);

			// store filesystem handle
			ImgCache.attributes.filesystem = filesystem;

			Private.createCacheDir(function(){
				_checkSize(ImgCache.attributes.init_callback);
			});
		};
		var _fail = function(error) {
			Helpers.logging('Failed to initialise LocalFileSystem ' + error.code, LOG_LEVEL_ERROR);
			if (error_callback) error_callback();
		};
		var _checkSize = function(callback){
			if (ImgCache.options.cacheClearSize > 0){
				var curSize = ImgCache.getCurrentSize();
				if (curSize > (ImgCache.options.cacheClearSize * 1024 * 1024)){
					ImgCache.clearCache(callback, callback);
				} else {
					if (callback) callback();
				}
			} else {
				if (callback) callback();
			}
		}
		if (Private.isCordova()) {
			// PHONEGAP
			var persistence = (Helpers.getCordovaStorageType(ImgCache.options.usePersistentCache));
			window.requestFileSystem(persistence, 0, _gotFS, _fail);
		} else {
			//CHROME
			window.requestFileSystem  = window.requestFileSystem || window.webkitRequestFileSystem;
			window.storageInfo = window.storageInfo || (ImgCache.options.usePersistentCache ? navigator.webkitPersistentStorage : navigator.webkitTemporaryStorage);
			if (!window.storageInfo) {
				Helpers.logging('Your browser does not support the html5 File API', LOG_LEVEL_WARNING);
				if (error_callback) error_callback();
				return;
			}
			// request space for storage
			var quota_size = ImgCache.options.chromeQuota;
			var persistence = (ImgCache.options.usePersistentCache ? window.storageInfo.PERSISTENT : window.storageInfo.TEMPORARY);
			window.storageInfo.requestQuota(
				quota_size,
				function() {
					/* success*/ window.requestFileSystem(persistence, quota_size, _gotFS, _fail); 
				},
				function(error) { /* error*/
					Helpers.logging('Failed to request quota: ' + error.message, LOG_LEVEL_ERROR);
					if (error_callback) error_callback();
				}
			);
		}
	};
	
	ImgCache.getCurrentSize = function(){
		if (Private.hasLocalStorage()){
			var curSize = localStorage.getItem('imgcache:' + ImgCache.options.localCacheFolder);
			if (curSize === null){
				return 0;
			}
			return parseInt(curSize);
		} else {
			return 0;
		}
	};

	// this function will not check if the image is already cached or not => it will overwrite existing data
	ImgCache.cacheFile = function(img_src, success_callback, fail_callback) {

		if (!Private.isImgCacheLoaded() || !img_src)
			return;

		img_src = Helpers.sanitizeURI(img_src);
			
		var filePath = Private.getCachedFileFullPath(img_src);

		var fileTransfer = new Private.FileTransferWrapper(ImgCache.attributes.filesystem);
		fileTransfer.download(
			img_src,
			filePath,
			function(entry) {
				entry.getMetadata(function(metadata) {
					if (metadata && metadata.hasOwnProperty('size')) {
						Helpers.logging('Cached file size: ' + metadata.size, LOG_LEVEL_INFO);
						Private.setCurrentSize(ImgCache.getCurrentSize() + parseInt(metadata.size));
					} else {
						Helpers.logging('No metadata size property available', LOG_LEVEL_INFO);
					}
				});
				Helpers.logging('Download complete: ' + Helpers.EntryGetPath(entry), LOG_LEVEL_INFO);

				// iOS: the file should not be backed up in iCloud
				// new from cordova 1.8 only
				if (entry.setMetadata) {
				entry.setMetadata(
					function() {
					/* success*/
						Helpers.logging('com.apple.MobileBackup metadata set', LOG_LEVEL_INFO);
					},
					function() {
					/* failure */
						Helpers.logging('com.apple.MobileBackup metadata could not be set', LOG_LEVEL_WARNING);
					},
					{ 'com.apple.MobileBackup': 1 }
					// 1=NO backup oddly enough..
				);
				}

				if (success_callback) success_callback();
			},
			function(error) {
				if (error.source) Helpers.logging('Download error source: ' + error.source, LOG_LEVEL_ERROR);
				if (error.target) Helpers.logging('Download error target: ' + error.target, LOG_LEVEL_ERROR);
				Helpers.logging('Download error code: ' + error.code, LOG_LEVEL_ERROR);
				if (fail_callback) fail_callback();
			}
		);
	};

	// checks if a copy of the file has already been cached
	// Reminder: this is an asynchronous method!
	// Answer to the question comes in response_callback as the second argument (first being the path)
	ImgCache.isCached = function(img_src, response_callback) {
		// sanity check
		if (!Private.isImgCacheLoaded() || !response_callback)
			return;

		img_src = Helpers.sanitizeURI(img_src);
			
		var path = Private.getCachedFilePath(img_src);
		if (Private.isCordovaAndroid()) {
			// This hack is probably only used for older versions of Cordova
			if (path.indexOf('file://') == 0) {
				// issue #4 -- android cordova specific
				path = path.substr(7);
			}
		}
		var ret = function(exists) {
			response_callback(img_src, exists);
		};
		
		// try to get the file entry: if it fails, there's no such file in the cache
		ImgCache.attributes.filesystem.root.getFile(
			path,
			{ create: false },
			function() { ret(true); },
			function() { ret(false); });
	};

	// $img: jQuery object of an <img/> element
	// Synchronous method
	ImgCache.useOnlineFile = function($img) {

		if (!Private.isImgCacheLoaded() || !$img)
			return;

		var prev_src = DomHelpers.getAttribute($img, OLD_SRC_ATTR);
		if (prev_src)
			DomHelpers.setAttribute($img, 'src', prev_src);
		DomHelpers.removeAttribute($img, OLD_SRC_ATTR);
	};



	// $img: jQuery object of an <img/> element
	ImgCache.useCachedFile = function($img, success_callback, fail_callback) {

		if (!Private.isImgCacheLoaded())
			return;

		Private.loadCachedFile($img, DomHelpers.getAttribute($img, 'src'), Private.setNewImgPath, success_callback, fail_callback);
	}

	// When the source url is not the 'src' attribute of the given img element
	ImgCache.useCachedFileWithSource = function($img, image_url, success_callback, fail_callback) {

		if (!Private.isImgCacheLoaded())
			return;
	
		var img_url = Helpers.sanitizeURI(img_url);
	
		Private.loadCachedFile($img, image_url, Private.setNewImgPath, success_callback, fail_callback);
	}

	// clears the cache
	ImgCache.clearCache = function(success_callback, error_callback) {

		if (!Private.isImgCacheLoaded())
			return;

		// delete cache dir completely
		ImgCache.attributes.dirEntry.removeRecursively(
			function(parent) {
				Helpers.logging('Local cache cleared', LOG_LEVEL_INFO);
				Private.setCurrentSize(0);
				// recreate the cache dir now
				Private.createCacheDir(success_callback);
			},
			function(error) { 
				Helpers.logging('Failed to remove directory or its contents: ' + error.code, LOG_LEVEL_ERROR);
				if (error_callback) error_callback();
			}
		);
	};

	ImgCache.removeFile = function(img_src, success_callback, error_callback) {

		img_src = Helpers.sanitizeURI(img_src);
	
		var filePath = Private.getCachedFilePath(img_src);
		var _fail = function(error) {
			Helpers.logging('Failed to remove file due to ' + error.code, LOG_LEVEL_ERROR);
			if (error_callback) error_callback();
		};
		ImgCache.attributes.filesystem.root.getFile(filePath, { create: false }, function (fileEntry) {
			fileEntry.remove(
				function(entry) {
					if (success_callback) success_callback();
				},
				_fail
			);
		}, _fail);
	};
	
	ImgCache.cacheBackground = function($div, success_callback, fail_callback) {

		if (!Private.isImgCacheLoaded())
			return;

		var img_src = Private.getBackgroundImageURL($div);
		if (!img_src) {
			Helpers.logging('No background to cache', LOG_LEVEL_WARNING);
			if (fail_callback) fail_callback();
			return;
		}
		
		Helpers.logging('Background image URL: ' + img_src, LOG_LEVEL_INFO);
		ImgCache.cacheFile(img_src, success_callback, fail_callback);
	}

	ImgCache.useCachedBackground = function($div, success_callback, fail_callback) {

		if (!Private.isImgCacheLoaded())
			return;

		var img_src = Private.getBackgroundImageURL($div);
		if (!img_src) {
			Helpers.logging('No background to cache', LOG_LEVEL_WARNING);
			if (fail_callback) fail_callback();
			return;
		}

		var _setBackgroundImagePath = function($element, new_src, old_src) {
			DomHelpers.setBackgroundImage($element, 'url("' + new_src + '")');
			// store previous url in case we need to reload it
			DomHelpers.setAttribute($element, OLD_BACKGROUND_ATTR, old_src);
		};

		Private.loadCachedFile($div, img_src, _setBackgroundImagePath, success_callback, fail_callback);
	}


	// $div: jQuery object of an element
	// Synchronous method
	// Method used to revert call to useCachedBackground
	ImgCache.useBackgroundOnlineFile = function($div) {

		if (!$div)
			return;

		var prev_src = DomHelpers.getAttribute($div, OLD_BACKGROUND_ATTR);
		if (prev_src)
			DomHelpers.setBackgroundImage($div, 'url("' + prev_src + '")');
		DomHelpers.removeAttribute($div, OLD_BACKGROUND_ATTR);
	};
	
	// returns the URI of the local cache folder (filesystem:)
	// this function is more useful for the examples than for anything else..
	// Synchronous method
	ImgCache.getCacheFolderURI = function() {

		if (!Private.isImgCacheLoaded())
			return;

		return Private.getFileEntryURL(ImgCache.attributes.dirEntry);
	};
	
	
	/** Private *****************************************************************/
	var Private = { attributes: {} };
	
	Private.isCordova = function() {
		return (typeof(cordova) !== 'undefined' || typeof(phonegap) !== 'undefined');
	};
	
	Private.isCordovaAndroid = function() {
		return (Private.isCordova() && device && device.platform && device.platform.indexOf('android') >= 0);
	};

	Private.isImgCacheLoaded = function() {
		if (!ImgCache.attributes.filesystem || !ImgCache.attributes.dirEntry) {
			Helpers.logging('ImgCache not loaded yet! - Have you called ImgCache.Init() first?', LOG_LEVEL_WARNING);
			return false;
		}
		return true;
	}

	Private.attributes.hasLocalStorage = false;
	Private.hasLocalStorage = function(){
		// if already tested, avoid doing the check again
		if (Private.attributes.hasLocalStorage)
			return Private.attributes.hasLocalStorage;
			
		try {
			var mod = Helpers.SHA1('imgcache_test');
	        localStorage.setItem(mod, mod);
	        localStorage.removeItem(mod);
			Private.attributes.hasLocalStorage = true;
	        return true;
			
		} catch (e) {
			// this is an info, not an error
			Helpers.logging('Could not write to local storage: ' + e.message, LOG_LEVEL_INFO);
	        return false;
		}
	};
	
	Private.setCurrentSize = function(curSize){
		Helpers.logging('current size: ' + curSize, LOG_LEVEL_INFO);
		if (Private.hasLocalStorage()){
			localStorage.setItem('imgcache:' + ImgCache.options.localCacheFolder, curSize);
		}
	};
	
	Private.getCachedFilePath = function(img_src) {
		return ImgCache.options.localCacheFolder + '/' + Private.getCachedFileName(img_src);
	}

	// used for FileTransfer.download only
	Private.getCachedFileFullPath = function(img_src) {
		var local_root = Helpers.EntryGetPath(ImgCache.attributes.dirEntry);
		return (local_root ? local_root + '/' : '/') + Private.getCachedFileName(img_src);	
	};
	
	Private.getCachedFileName = function(img_src) {
		if (!img_src) {
			Helpers.logging('No source given to getCachedFileName', LOG_LEVEL_WARNING);
			return;
		}
		var hash = Helpers.SHA1(img_src);
		var ext = Helpers.FileGetExtension(Helpers.URIGetFileName(img_src));
		return hash + (ext ? ('.' + ext) : '');
	};

	Private.setNewImgPath = function($img, new_src, old_src) {
		DomHelpers.setAttribute($img, 'src', new_src);
		// store previous url in case we need to reload it
		DomHelpers.setAttribute($img, OLD_SRC_ATTR, old_src);
	};

	Private.createCacheDir = function(callback) {
		if (!ImgCache.attributes.filesystem)
			return;

		var _fail = function(error) {
			Helpers.logging('Failed to get/create local cache directory: ' + error.code, LOG_LEVEL_ERROR);
		};
		var _getDirSuccess = function(dirEntry) {
			ImgCache.attributes.dirEntry = dirEntry;
			Helpers.logging('Local cache folder opened: ' + Helpers.EntryGetPath(dirEntry), LOG_LEVEL_INFO);

			//Put .nomedia file in cache directory so Android doesn't index it.
			if (Private.isCordovaAndroid()) {

				var _androidNoMediaFileCreated = function(entry) {
				    Helpers.logging('.nomedia file created.', LOG_LEVEL_INFO);
				    if (callback) callback();
				}

				dirEntry.getFile('.nomedia', {create: true, exclusive: false}, _androidNoMediaFileCreated, _fail);
			}
			else {
				if (callback) callback();
			}

			ImgCache.ready = true;
			DomHelpers.trigger(document, IMGCACHE_READY_TRIGGERED_EVENT);
		};
		ImgCache.attributes.filesystem.root.getDirectory(ImgCache.options.localCacheFolder, {create: true, exclusive: false}, _getDirSuccess, _fail);	
	};

	// This is a wrapper for phonegap's FileTransfer object in order to implement the same feature
	// in Chrome (and possibly extra browsers in the future)
	Private.FileTransferWrapper = function(filesystem) {
		if (Private.isCordova()) {
			// PHONEGAP
			this.fileTransfer = new FileTransfer();
		}
		this.filesystem = filesystem;	// only useful for CHROME
	};
	Private.FileTransferWrapper.prototype.download = function(uri, localPath, success_callback, error_callback) {
		// PHONEGAP
		if (this.fileTransfer) return this.fileTransfer.download(uri, localPath, success_callback, error_callback);

		var filesystem = this.filesystem;

		// CHROME - browsers
		var _fail = function( str, level, error_callback ) {
			Helpers.logging(str, level);
			// mock up FileTransferError, so at least caller knows there was a problem.
			// Normally, the error.code in the callback is a FileWriter error, we return 0 if the error was an XHR error
			if (error_callback) { 
				error_callback({code: 0, source: uri, target: localPath});
			}
		}
		var xhr = new XMLHttpRequest();
		xhr.open('GET', uri, true);
		xhr.responseType = 'blob';
		xhr.onload = function(event){
			if (xhr.response && (xhr.status == 200 || xhr.status == 0)) {
				filesystem.root.getFile(localPath, { create:true }, function(fileEntry) {
					fileEntry.createWriter(function(writer){

						writer.onerror = error_callback;
						writer.onwriteend = function() { success_callback(fileEntry);  };
						writer.write(xhr.response, error_callback);

					}, error_callback);
				}, error_callback);
			} else {
				_fail('Image ' + uri + ' could not be downloaded - status: ' + xhr.status, 3, error_callback);
			}
		};
		xhr.onerror = function() {
			_fail('XHR error - Image ' + uri + ' could not be downloaded - status: ' + xhr.status, 3, error_callback);
		};
		xhr.send();
	};

	// toURL for html5, toURI for cordova...
	Private.getFileEntryURL = function(entry) {
		return entry.toURL ? entry.toURL() : entry.toURI();
	}
	
	Private.getBackgroundImageURL = function($div) {
		var backgroundImageProperty = DomHelpers.getBackgroundImage($div);
		if (!backgroundImageProperty)
			return;
		var regexp = /\((.+)\)/;
		var img_src = regexp.exec(backgroundImageProperty)[1];
		return img_src;
	}

	Private.loadCachedFile = function($element, img_src, set_path_callback, success_callback, fail_callback) {
		if (!Private.isImgCacheLoaded())
			return;
			
		if (!$element)
			return;

		var filename = Helpers.URIGetFileName(img_src);
		var filePath = Private.getCachedFileName(img_src); // we need only a relative path

		var _gotFileEntry = function(entry) {
			if (ImgCache.options.useDataURI) {
				var _win = function(file) {
					var reader = new FileReader();
					reader.onloadend = function(e) {
						// prefix with : 'data:' + mime_type + ';base64;' + .. ?
						/* var mime_type = '';
						if (filename && filename.length > 4) {
							//TODO: of course relying on extension is wrong.. but we trust our data here
							var ext = filename.substr(filename.length - 4).toLowerCase();
							if (ext == '.jpg' || ext == 'jpeg') {
								mime_type = 'image/jpeg';
							} else if (ext == '.png') {
								mime_type = 'image/png';
							} else if (ext == '.gif') {
								mime_type = 'image/gif';
							}
						} */
						var base64content = e.target.result;
						if (!base64content) {
							Helpers.logging('File in cache ' + filename + ' is empty', LOG_LEVEL_WARNING);
							if (fail_callback) fail_callback($element);
							return;
						}
						set_path_callback($element, base64content, img_src);
						Helpers.logging('File ' + filename + ' loaded from cache', LOG_LEVEL_INFO);
						if (success_callback) success_callback($element);
					};
					reader.readAsDataURL(file);
				};
				var _fail = function(error) {
					Helpers.logging('Failed to read file ' + error.code, LOG_LEVEL_ERROR);
					if (fail_callback) fail_callback($element);
				};

				entry.file(_win, _fail);
			} else {
				// using src="filesystem:" kind of url
				var new_url = Private.getFileEntryURL(entry);
				set_path_callback($element, new_url, img_src);
				Helpers.logging('File ' + filename + ' loaded from cache', LOG_LEVEL_INFO);
				if (success_callback) success_callback($element);
			}
		};
		// if file does not exist in cache, cache it now!
		var _fail = function(e) {
			Helpers.logging('File ' + filename + ' not in cache', LOG_LEVEL_INFO);
			if (fail_callback) fail_callback($element);
		};
		ImgCache.attributes.filesystem.root.getFile(Private.getCachedFilePath(img_src), {create: false}, _gotFileEntry, _fail);
	};
	
	/****************************************************************************/

	
	
	/** Helpers *****************************************************************/
	var Helpers = {};

	var LOG_LEVEL_INFO = 1;
	var LOG_LEVEL_WARNING = 2;
	var LOG_LEVEL_ERROR = 3;
	
	// level: 1=INFO, 2=WARNING, 3=ERROR
	Helpers.logging = function(str, level) {
		if (ImgCache.options.debug) {
			if (ImgCache.options.customLogger)
				ImgCache.options.customLogger(str, level);
			else {
				if (level == LOG_LEVEL_INFO) str = 'INFO: ' + str;
				if (level == LOG_LEVEL_WARNING) str = 'WARN: ' + str;
				if (level == LOG_LEVEL_ERROR) str = 'ERROR: ' + str;
				console.log(str);
			}
		}
	};
	
	// make sure the url does not contain funny characters like spaces that might make the download fail
	Helpers.sanitizeURI = function(uri) {
		var encodedURI = encodeURI(uri);
		/*
		TODO: The following bit of code will have to be checked first (#30)
		if (Private.isCordova()) {
			return encodedURI.replace(/%/g, '%25');
		}
		*/
		return encodedURI;
	};
	
	// with a little help from http://code.google.com/p/js-uri/
	Helpers.URI = function(str) {
	    if (!str) str = '';
	    // Based on the regex in RFC2396 Appendix B.
	    var parser = /^(?:([^:\/?\#]+):)?(?:\/\/([^\/?\#]*))?([^?\#]*)(?:\?([^\#]*))?(?:\#(.*))?/;
	    var result = str.match(parser);
	    this.scheme    = result[1] || null;
	    this.authority = result[2] || null;
	    this.path      = result[3] || null;
	    this.query     = result[4] || null;
	    this.fragment  = result[5] || null;
	};
	// returns lower cased filename from full URI
	Helpers.URIGetFileName = function(fullpath) {
		if (!fullpath)
			return;
		//TODO: there must be a better way here.. (url encoded strings fail)
		var idx = fullpath.lastIndexOf('/');
		if (!idx)
			return;
		return fullpath.substr(idx + 1).toLowerCase();
	};
	
	// returns lower cased path from full URI
	Helpers.URIGetPath = function(str) {
		if (!str)
			return;
		var uri = Helpers.URI(str);
		return uri.path.toLowerCase();
	};
	
	// returns extension from filename (without leading '.')
	Helpers.FileGetExtension = function(filename) {
		if (!filename)
			return '';
		filename = filename.split('?')[0];
		var ext = filename.split('.').pop();
		// make sure it's a realistic file extension - for images no more than 4 characters long (.jpeg)
		if (!ext || ext.length > 4)
			return '';
		return ext;
	};
	
	Helpers.EntryGetPath = function(entry) {
		if (Private.isCordova()) {
			// From Cordova 3.3 onward toURL() seems to be required instead of fullPath (#38)
			return (typeof entry.toURL == 'function' ? entry.toURL() : entry.fullPath);
		} else {
			return entry.fullPath;
		}
	};

	Helpers.getCordovaStorageType = function(isPersistent) {
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

	/***********************************************
	tiny-sha1 r4
	MIT License
	http://code.google.com/p/tiny-sha1/
	***********************************************/
	Helpers.SHA1 = function(s){function U(a,b,c){while(0<c--)a.push(b)}function L(a,b){return(a<<b)|(a>>>(32-b))}function P(a,b,c){return a^b^c}function A(a,b){var c=(b&0xFFFF)+(a&0xFFFF),d=(b>>>16)+(a>>>16)+(c>>>16);return((d&0xFFFF)<<16)|(c&0xFFFF)}var B="0123456789abcdef";return(function(a){var c=[],d=a.length*4,e;for(var i=0;i<d;i++){e=a[i>>2]>>((3-(i%4))*8);c.push(B.charAt((e>>4)&0xF)+B.charAt(e&0xF))}return c.join('')}((function(a,b){var c,d,e,f,g,h=a.length,v=0x67452301,w=0xefcdab89,x=0x98badcfe,y=0x10325476,z=0xc3d2e1f0,M=[];U(M,0x5a827999,20);U(M,0x6ed9eba1,20);U(M,0x8f1bbcdc,20);U(M,0xca62c1d6,20);a[b>>5]|=0x80<<(24-(b%32));a[(((b+65)>>9)<<4)+15]=b;for(var i=0;i<h;i+=16){c=v;d=w;e=x;f=y;g=z;for(var j=0,O=[];j<80;j++){O[j]=j<16?a[j+i]:L(O[j-3]^O[j-8]^O[j-14]^O[j-16],1);var k=(function(a,b,c,d,e){var f=(e&0xFFFF)+(a&0xFFFF)+(b&0xFFFF)+(c&0xFFFF)+(d&0xFFFF),g=(e>>>16)+(a>>>16)+(b>>>16)+(c>>>16)+(d>>>16)+(f>>>16);return((g&0xFFFF)<<16)|(f&0xFFFF)})(j<20?(function(t,a,b){return(t&a)^(~t&b)}(d,e,f)):j<40?P(d,e,f):j<60?(function(t,a,b){return(t&a)^(t&b)^(a&b)}(d,e,f)):P(d,e,f),g,M[j],O[j],L(c,5));g=f;f=e;e=L(d,30);d=c;c=k}v=A(v,c);w=A(w,d);x=A(x,e);y=A(y,f);z=A(z,g)}return[v,w,x,y,z]}((function(t){var a=[],b=255,c=t.length*8;for(var i=0;i<c;i+=8){a[i>>5]|=(t.charCodeAt(i/8)&b)<<(24-(i%32))}return a}(s)).slice(),s.length*8))))};
	/***********************************************/
	
	/****************************************************************************/
	
	/** DomHelpers **************************************************************/
	var DomHelpers = {};
	
	DomHelpers.trigger = function(DomElement, eventName) {
		if (ImgCache.jQuery) {
			$(DomElement).trigger(eventName);
		} else {
			DomElement.dispatchEvent(new CustomEvent(eventName));
		}
	};

	DomHelpers.removeAttribute = function(element, attrName) {
		if (ImgCache.jQuery) {
			element.removeAttr(attrName);
		} else {
			element.removeAttribute(attrName);
		}
	};
	DomHelpers.setAttribute = function(element, attrName, value) {
		if (ImgCache.jQuery) {
			element.attr(attrName, value);
		} else {
			element.setAttribute(attrName, value);
		}
	};
	DomHelpers.getAttribute = function(element, attrName) {
		if (ImgCache.jQuery) {
			return element.attr(attrName);
		} else {
			return element.getAttribute(attrName);
		}
	};
	DomHelpers.getBackgroundImage = function(element) {
		if (ImgCache.jQuery) {
			return element.css('background-image');
		} else {
			var style = window.getComputedStyle(element, null);
			if (!style)
				return;
			return style.backgroundImage;
		}
	};
	DomHelpers.setBackgroundImage = function(element, styleValue) {
		if (ImgCache.jQuery) {
			element.css('background-image', styleValue);
		} else {
			element.style.backgroundImage = styleValue;
		}
	};

	/****************************************************************************/
	
})(window.jQuery || window.Zepto || function() { throw "jQuery is not available"; } );
