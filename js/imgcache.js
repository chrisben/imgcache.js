/*! imgcache.js
   Copyright 2012 Christophe BENOIT

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
	// options to override before using the library (but after loading this script!)
	options: {
		debug: false,			/* write log (to console)? */
		localCacheFolder: 'imgcache',	/* name of the cache folder */
		useDataURI: false,		/* use src="data:.."? otherwise will use src="filesystem:.." */
		chromeQuota: 10*1024*1024,	/* allocated cache space : here 10Mb */
		usePersistentCache: true	/* false: use temporary cache storage */
		/* customLogger */		/* if function defined, will use this one to log events */
	},
	version: '0.5.2',
	ready: false
};

(function($) {

	var old_src_attr = 'data-old-src';

	/** Helpers *****************************************************************/
	// with a little help from http://code.google.com/p/js-uri/
	var URI = function(str) {
	    if (!str) str = "";
	    // Based on the regex in RFC2396 Appendix B.
	    var parser = /^(?:([^:\/?\#]+):)?(?:\/\/([^\/?\#]*))?([^?\#]*)(?:\?([^\#]*))?(?:\#(.*))?/;
	    var result = str.match(parser);
	    this.scheme    = result[1] || null;
	    this.authority = result[2] || null;
	    this.path      = result[3] || null;
	    this.query     = result[4] || null;
	    this.fragment  = result[5] || null;
	};

	var is_cordova = function() {
		return (typeof(cordova) !== 'undefined' || typeof(phonegap) !== 'undefined');
	};


	// level: 1=INFO, 2=WARNING, 3=ERROR
	var logging = function(str, level) {
		if (ImgCache.options.debug) {
			if (ImgCache.options.customLogger)
				ImgCache.options.customLogger(str, level);
			else {
				if (level == 1) str = 'INFO: ' + str;
				if (level == 2) str = 'WARN: ' + str;
				if (level == 3) str = 'ERROR: ' + str;
				console.log(str);
			}
		}
	};

	// returns lower cased filename from full URI
	var URIGetFileName = function(fullpath) {
		if (!fullpath)
			return;
		//TODO: there must be a better way here.. (url encoded strings fail)
		var idx = fullpath.lastIndexOf("/");
		if (!idx)
			return;
		return fullpath.substr(idx + 1).toLowerCase();
	};

	// returns lower cased path from full URI
	var URIGetPath = function(str) {
		if (!str)
			return;
		var uri = URI(str);
		return uri.path.toLowerCase();
	};

	// returns extension from filename (without leading '.')
	var FileGetExtension = function(filename) {
		if (!filename)
			return '';
		filename = filename.split('?')[0];
		var ext = filename.split('.').pop();
		// make sure it's a realistic file extension - for images no more than 4 characters long (.jpeg)
		if (!ext || ext.length > 4)
			return '';
		return ext;
	};

	/***********************************************
		tiny-sha1 r4
		MIT License
	 	http://code.google.com/p/tiny-sha1/
	 ***********************************************/
	function SHA1(s){function U(a,b,c){while(0<c--)a.push(b)}function L(a,b){return(a<<b)|(a>>>(32-b))}function P(a,b,c){return a^b^c}function A(a,b){var c=(b&0xFFFF)+(a&0xFFFF),d=(b>>>16)+(a>>>16)+(c>>>16);return((d&0xFFFF)<<16)|(c&0xFFFF)}var B="0123456789abcdef";return(function(a){var c=[],d=a.length*4,e;for(var i=0;i<d;i++){e=a[i>>2]>>((3-(i%4))*8);c.push(B.charAt((e>>4)&0xF)+B.charAt(e&0xF))}return c.join('')}((function(a,b){var c,d,e,f,g,h=a.length,v=0x67452301,w=0xefcdab89,x=0x98badcfe,y=0x10325476,z=0xc3d2e1f0,M=[];U(M,0x5a827999,20);U(M,0x6ed9eba1,20);U(M,0x8f1bbcdc,20);U(M,0xca62c1d6,20);a[b>>5]|=0x80<<(24-(b%32));a[(((b+65)>>9)<<4)+15]=b;for(var i=0;i<h;i+=16){c=v;d=w;e=x;f=y;g=z;for(var j=0,O=[];j<80;j++){O[j]=j<16?a[j+i]:L(O[j-3]^O[j-8]^O[j-14]^O[j-16],1);var k=(function(a,b,c,d,e){var f=(e&0xFFFF)+(a&0xFFFF)+(b&0xFFFF)+(c&0xFFFF)+(d&0xFFFF),g=(e>>>16)+(a>>>16)+(b>>>16)+(c>>>16)+(d>>>16)+(f>>>16);return((g&0xFFFF)<<16)|(f&0xFFFF)})(j<20?(function(t,a,b){return(t&a)^(~t&b)}(d,e,f)):j<40?P(d,e,f):j<60?(function(t,a,b){return(t&a)^(t&b)^(a&b)}(d,e,f)):P(d,e,f),g,M[j],O[j],L(c,5));g=f;f=e;e=L(d,30);d=c;c=k}v=A(v,c);w=A(w,d);x=A(x,e);y=A(y,f);z=A(z,g)}return[v,w,x,y,z]}((function(t){var a=[],b=255,c=t.length*8;for(var i=0;i<c;i+=8){a[i>>5]|=(t.charCodeAt(i/8)&b)<<(24-(i%32))}return a}(s)).slice(),s.length*8))))}
	/***********************************************/

	/****************************************************************************/

	// if no local_root set, set relative path
	var _getCachedFilePath = function(img_src, local_root) {
		var hash= SHA1(img_src);
		var ext = FileGetExtension(URIGetFileName(img_src));
		var filename = hash + (ext ? ('.' + ext) : '');
		return (local_root ? local_root + '/' : '') + filename;
	};

	var _setNewImgPath = function($img, new_src, old_src) {
		$img.attr('src', new_src);
		// store previous url in case we need to reload it
		$img.attr(old_src_attr, old_src);
	};

	var _createCacheDir = function(callback) {
		if (!ImgCache.filesystem)
			return;

		var _fail = function(error) {
			logging('Failed to get/create local cache directory: ' + error.code, 3);
		};
		var _getDirSuccess = function(dirEntry) {
			ImgCache.dirEntry = dirEntry;
			logging('Local cache folder opened: ' + dirEntry.fullPath, 1);

            //Put .nomedia file in cache directory so Android doesn't index it.
            if (is_cordova() && device.platform && device.platform.indexOf('Android') == 0) {
    
                function androidNoMediaFileCreated(entry) {
                    logging('.nomedia file created.');
                    if (callback) callback();
                }
    
                dirEntry.getFile(".nomedia", {create: true, exclusive: false}, androidNoMediaFileCreated, _fail);
            }
            else
            {
                if (callback) callback();
            }

            ImgCache.ready = true;
            $(document).trigger('ImgCacheReady');            
			
		};
		ImgCache.filesystem.root.getDirectory(ImgCache.options.localCacheFolder, {create: true, exclusive: false}, _getDirSuccess, _fail);	
	};

	// This is a wrapper for phonegap's FileTransfer object in order to implement the same feature
	// in Chrome (and possibly extra browsers in the future)
	var FileTransferWrapper = function(filesystem) {
		if (is_cordova()) {
			// PHONEGAP
			this.fileTransfer = new FileTransfer();
		}
		this.filesystem = filesystem;	// only useful for CHROME
	};
	FileTransferWrapper.prototype.download = function(uri, localPath, success_callback, error_callback) {
		// PHONEGAP
		if (this.fileTransfer) return this.fileTransfer.download(uri, localPath, success_callback, error_callback);

		var filesystem = this.filesystem;

		// CHROME - browsers
		var _fail = function( str, level, error_callback ) {
			logging(str, level);
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
	var _getFileEntryURL = function(entry) {
		return entry.toURL ? entry.toURL() : entry.toURI();
	}

	ImgCache.init = function(success_callback, error_callback) {
		ImgCache.init_callback = success_callback;

		var _gotFS = function(filesystem) {
			logging('LocalFileSystem opened', 1);

			// store filesystem handle
			ImgCache.filesystem = filesystem;

			_createCacheDir(ImgCache.init_callback);
		};
		var _fail = function(error) {
			logging('Failed to initialise LocalFileSystem ' + error.code, 3);
			if (error_callback) error_callback();
		};
		if (is_cordova()) {
			// PHONEGAP
			var persistence = (ImgCache.options.usePersistentCache ? LocalFileSystem.PERSISTENT : LocalFileSystem.TEMPORARY);
			window.requestFileSystem(persistence, 0, _gotFS, _fail);
		} else {
			//CHROME
			window.requestFileSystem  = window.requestFileSystem || window.webkitRequestFileSystem;
			window.storageInfo = window.storageInfo || window.webkitStorageInfo;
			if (!window.storageInfo) {
				logging('Your browser does not support the html5 File API', 2);
				if (error_callback) error_callback();
				return;
			}
			// request space for storage
			var quota_size = ImgCache.options.chromeQuota;
			var persistence = (ImgCache.options.usePersistentCache ? window.storageInfo.PERSISTENT : window.storageInfo.TEMPORARY);
			window.storageInfo.requestQuota(
				persistence, 
				quota_size,
				function() { /* success*/ window.requestFileSystem(persistence, quota_size, _gotFS, _fail);  },
				function(error) { /* error*/ logging('Failed to request quota: ' + error.code, 3); if (error_callback) error_callback(); }
			);
		}
	};

	// this function will not check if image cached or not => will overwrite existing data
	ImgCache.cacheFile = function(img_src, success_callback, fail_callback) {

		if (!ImgCache.filesystem || !ImgCache.dirEntry || !img_src)
			return;

		var filePath = _getCachedFilePath(img_src, ImgCache.dirEntry.fullPath);

		var fileTransfer = new FileTransferWrapper(ImgCache.filesystem);
		fileTransfer.download(
			img_src,
			filePath,
			function(entry) {
				logging('Download complete: ' + entry.fullPath, 1);

				// iOS: the file should not be backed up in iCloud
				// new from cordova 1.8 only
				if (entry.setMetadata) {
				entry.setMetadata(
					function() {
					/* success*/
						logging('com.apple.MobileBackup metadata set', 1);
					},
					function() {
					/* failure */
						logging('com.apple.MobileBackup metadata could not be set', 2);
					},
					{ "com.apple.MobileBackup": 1 }
					// 1=NO backup oddly enough..
				);
				}

				if (success_callback) success_callback();
			},
			function(error) {
				if (error.source) logging('Download error source: ' + error.source, 3);
				if (error.target) logging('Download error target: ' + error.target, 3);
				logging('Download error code: ' + error.code, 3);
				if (fail_callback) fail_callback();
			}
		);
	};

	// checks if a copy of the file has already been cached
	// Reminder: this is an asynchronous method!
	// Answer to the question comes in response_callback as the second argument (first being the path)
	ImgCache.isCached = function(img_src, response_callback) {
		// sanity check
		if (!ImgCache.filesystem || !ImgCache.dirEntry || !response_callback)
			return;

		var path = _getCachedFilePath(img_src, ImgCache.dirEntry.fullPath);
		if (is_cordova() && device.platform && device.platform.indexOf('Android') == 0 && path.indexOf('file://') == 0) {
			// issue #4 -- android cordova specific
			path = path.substr(7);
		}
		var ret = function(exists) {
			response_callback(img_src, exists);
		};
		// try to get the file entry: if it fails, there's no such file in the cache
		ImgCache.filesystem.root.getFile(
			path,
			{ create: false },
			function() { ret(true); },
			function() { ret(false); });
	};

	// $img: jQuery object of an <img/> element
	// Synchronous method
	ImgCache.useOnlineFile = function($img) {
		if (!$img)
			return;

		var prev_src = $img.attr(old_src_attr);
		if (prev_src)
			$img.attr('src', prev_src);
		$img.removeAttr(old_src_attr);
	};

	// $img: jQuery object of an <img/> element
	ImgCache.useCachedFile = function($img, success_callback, fail_callback) {

		if (!ImgCache.filesystem || !ImgCache.dirEntry || !$img)
			return;

		var img_src = $img.attr('src');
		var filename = URIGetFileName(img_src);
		var filePath = _getCachedFilePath(img_src); // we need only a relative path

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
							logging('File in cache ' + filename + ' is empty', 2);
							if (fail_callback) fail_callback($img);
							return;
						}
						_setNewImgPath($img, base64content, img_src);
						logging('File ' + filename + ' loaded from cache', 1);
						if (success_callback) success_callback($img);
					};
					reader.readAsDataURL(file);
				};
				var _fail = function(error) {
					logging('Failed to read file ' + error.code, 3);
					if (fail_callback) fail_callback($img);
				};

				entry.file(_win, _fail);
			} else {
				// using src="filesystem:" kind of url
				var new_url = _getFileEntryURL(entry);
				_setNewImgPath($img, new_url, img_src);
				logging('File ' + filename + ' loaded from cache', 1);
				if (success_callback) success_callback($img);
			}
		};
		// if file does not exist in cache, cache it now!
		var _fail = function(e) {
			logging('File ' + filename + ' not in cache', 1);
			if (fail_callback) fail_callback($img);
		};
		ImgCache.dirEntry.getFile(filePath, { create: false }, _gotFileEntry, _fail);
	}

	// clears the cache
	ImgCache.clearCache = function(success_callback, error_callback) {
		if (!ImgCache.filesystem || !ImgCache.dirEntry) {
			logging('ImgCache not loaded yet!', 2);
			return;
		}

		// delete cache dir completely
		ImgCache.dirEntry.removeRecursively(
			function(parent) {
				logging('Local cache cleared', 1);
				// recreate the cache dir now
				_createCacheDir(success_callback);
			},
			function(error) { 
				logging('Failed to remove directory or its contents: ' + error.code, 3);
				if (error_callback) error_callback();
			}
		);
	};

	ImgCache.cacheBackground = function($div, success_callback, fail_callback) {
        var regexp = /\((.+)\)/
        var img_src = regexp.exec($div.css('background-image'))[1];
        console.log("Found image URL: " + img_src);
        ImgCache.cacheFile(img_src, success_callback, fail_callback);
    }

        // $img: jQuery object of an <div/> element
    ImgCache.useCachedBackground = function($div, success_callback, fail_callback) {

        if (!ImgCache.filesystem || !ImgCache.dirEntry || !$div)
            return;

        var regexp = /\((.+)\)/
        var img_src = regexp.exec($div.css('background-image'))[1];
        var filename = URIGetFileName(img_src);
        var filePath = _getCachedFilePath(img_src); // we need only a relative path

        var _gotFileEntry = function(entry) {
            if (ImgCache.options.useDataURI) {
                var _win = function(file) {
                    var reader = new FileReader();
                    reader.onloadend = function(e) {
                        var base64content = e.target.result;
                        if (!base64content) {
                            logging('File in cache ' + filename + ' is empty', 2);
                            if (fail_callback) fail_callback($div);
                            return;
                        }
                        _setNewImgPath($img, base64content, img_src);
                        logging('File ' + filename + ' loaded from cache', 1);
                        if (success_callback) success_callback($div);
                    };
                    reader.readAsDataURL(file);
                };
                var _fail = function(error) {
                    logging('Failed to read file ' + error.code, 3);
                    if (fail_callback) fail_callback($div);
                };

                entry.file(_win, _fail);
            } else {
                // using src="filesystem:" kind of url
                var new_url = _getFileEntryURL(entry);
                $div.css('background-image', 'url(' + new_url + ')');
                //_setNewImgPath($img, new_url, img_src);
                logging('File ' + filename + ' loaded from cache', 1);
                if (success_callback) success_callback($div);
            }
        };
        // if file does not exist in cache, cache it now!
        var _fail = function(e) {
            logging('File ' + filename + ' not in cache', 1);
            if (fail_callback) fail_callback($div);
        };
        ImgCache.dirEntry.getFile(filePath, { create: false }, _gotFileEntry, _fail);
    }

	// returns the URI of the local cache folder (filesystem:)
	// this function is more useful for the examples than for anything else..
	// Synchronous method
	ImgCache.getCacheFolderURI = function() {
		if (!ImgCache.filesystem || !ImgCache.dirEntry) {
			logging('ImgCache not loaded yet!', 2);
			return;
		}

		return _getFileEntryURL(ImgCache.dirEntry);
	};
})(window.jQuery || window.Zepto);


