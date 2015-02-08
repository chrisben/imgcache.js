# TODO

* Find a solution for cache invalidation when online in case an image has changed since last cached version


* When Chrome finally supports canvas.toBlob(), possibly replace download method with new one that draws an Image into a canvas and then retrieves its content using the toBlob() method -- or use [canvas-toBlob.js] (https://github.com/eligrey/canvas-toBlob.js)


* It looks like Cordova supports Blob download now, just like Chrome - add an option to use this method instead of the previous FileTransfer.download