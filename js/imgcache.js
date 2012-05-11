/*! imgcache.js v0.1 
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
		debug: false,			/* write to console? */
		localCacheFolder: 'imgcache',	/* name of the cache folder */
		useDataURI: false,		/* use src="data:.."? otherwise will use src="filesystem:.." */
		chromeQuota: 10*1024*1024,	/* allocated cache space : here 10Mb */
		usePersistentCache: true
	}
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

	var logging = function(str) {
		if (ImgCache.options.debug)
			console.log(str);
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
	/****************************************************************************/

	// if no local_root set, set relative path
	var _getCachedFilePath = function(img_src, local_root) {
		var filename = URIGetFileName(img_src);
		//TODO: we should here return the file path with subfolders matching its url to avoid problem when two files have same name
		// 	for now not done because that would mean be sure that the subfolders are created (recursively) before writing the file
		//	An example of how to recursively create subfolders:
		// 	http://www.html5rocks.com/en/tutorials/file/filesystem/
		// var path = URIGetPath(img_src);
		//return (local_root ? local_root + '/' : '') + path + '/' + filename;
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
			logging('Failed to get/create local cache directory: ' + error.code);
		};
		var _getDirSuccess = function(dirEntry) {
			ImgCache.dirEntry = dirEntry;
			logging('Local cache folder opened: ' + dirEntry.fullPath);
			if (callback) callback();
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
		var xhr = new XMLHttpRequest();
		xhr.open('GET', uri, true);
		xhr.responseType = 'arraybuffer';
		xhr.onload = function(event){
			if (xhr.response && (xhr.status == 200 || xhr.status == 0)) {
				filesystem.root.getFile(localPath, { create:true }, function(fileEntry) {
					fileEntry.createWriter(function(writer){

						writer.onerror = error_callback;
						writer.onwriteend = function() { success_callback(fileEntry);  };

						var BlobBuilder = window.BlobBuilder || window.WebKitBlobBuilder;
						var bb = new BlobBuilder();
						bb.append(xhr.response);
						var mime_type = xhr.getResponseHeader('Content-type');
						writer.write(bb.getBlob(mime_type), error_callback);

					}, error_callback);
				}, error_callback);
			} else {
				//TODO: error_callback(error)
				logging('Image ' + uri + ' could not be downloaded - status: ' + xhr.status);
			}
		};
		xhr.send();
	};

	// toURL for html5, toURI for cordova...
	var _getFileEntryURL = function(entry) {
		return entry.toURL ? entry.toURL() : entry.toURI();
	}

	ImgCache.init = function(init_callback) {
		ImgCache.init_callback = init_callback;

		var _gotFS = function(filesystem) {
			logging('LocalFileSystem opened');

			// store filesystem handle
			ImgCache.filesystem = filesystem;

			_createCacheDir(ImgCache.init_callback);
		};
		var _fail = function(error) {
			logging('Failed to initialise LocalFileSystem ' + error.code);
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
				logging('Your browser does not support the html5 File API');
				return;
			}
			// request space for storage
			var quota_size = ImgCache.options.chromeQuota;
			var persistence = (ImgCache.options.usePersistentCache ? window.storageInfo.PERSISTENT : window.storageInfo.TEMPORARY);
			window.storageInfo.requestQuota(
				persistence, 
				quota_size,
				function() { /* success*/ window.requestFileSystem(persistence, quota_size, _gotFS, _fail);  },
				function(error) { /* error*/ logging('Failed to request quota: ' + error.code) }
			);
		}
	};

	// this function will not check if image cached or not => will overwrite existing data
	ImgCache.cacheFile = function(img_src) {

		if (!ImgCache.filesystem || !ImgCache.dirEntry || !img_src)
			return;

		var filePath = _getCachedFilePath(img_src, ImgCache.dirEntry.fullPath);

		var fileTransfer = new FileTransferWrapper(ImgCache.filesystem);
		fileTransfer.download(
			img_src,
			filePath,
			function(entry) {
				logging('Download complete: ' + entry.fullPath);
			},
			function(error) {
				if (error.source) logging('Download error source: ' + error.source);
				if (error.target) logging('Download error target: ' + error.target);
				logging('Download error code: ' + error.code);
			}
		);
	};

	// $img: jQuery object of an <img/> element
	ImgCache.useOnlineFile = function($img) {
		if (!$img)
			return;

		var prev_src = $img.attr(old_src_attr);
		if (prev_src)
			$img.attr('src', prev_src);
		$img.removeAttr(old_src_attr);
	};

	// $img: jQuery object of an <img/> element
	ImgCache.useCachedFile = function($img, fail_callback) {

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
							logging('Error: file in cache ' + filename + ' is empty');
							if (fail_callback) fail_callback();
							return;
						}
						_setNewImgPath($img, base64content, img_src);
						logging('File ' + filename + ' loaded from cache');
					};
					reader.readAsDataURL(file);
				};
				var _fail = function(error) {
					logging('Error: Failed to read file ' + error.code);
					if (fail_callback) fail_callback();
				};

				entry.file(_win, _fail);
			} else {
				// using src="filesystem:" kind of url
				var new_url = _getFileEntryURL(entry);
				_setNewImgPath($img, new_url, img_src);
				logging('File ' + filename + ' loaded from cache');
			}
		};
		// if file does not exist in cache, cache it now!
		var _fail = function(e) {
			logging('File ' + filename + ' not in cache');
			if (fail_callback) fail_callback();
		};
		ImgCache.dirEntry.getFile(filePath, { create: false }, _gotFileEntry, _fail);
	}

	// clears the cache
	ImgCache.clearCache = function(success_callback, error_callback) {
		if (!ImgCache.filesystem || !ImgCache.dirEntry) {
			logging('ImgCache not loaded yet!');
			return;
		}

		// delete cache dir completely
		ImgCache.dirEntry.removeRecursively(
			function(parent) {
				logging('Local cache cleared');
				// recreate the cache dir now
				_createCacheDir(success_callback);
			},
			function(error) { 
				logging('Failed to remove directory or its contents: ' + error.code);
				if (error_callback) error_callback();
			}
		);
	};

	// returns the URI of the local cache folder (filesystem:)
	// this function is more useful for the examples than for anything else..
	ImgCache.getCacheFolderURI = function() {
		if (!ImgCache.filesystem || !ImgCache.dirEntry) {
			logging('ImgCache not loaded yet!');
			return;
		}

		return _getFileEntryURL(ImgCache.dirEntry);
	};
})(jQuery);


