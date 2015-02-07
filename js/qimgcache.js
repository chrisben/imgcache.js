/*
QImgCache
ImgCache wrapper using Q (https://github.com/kriskowal/q) to use promises.
This version does not require any call to the init method.
*/
var QImgCache = {};

(function (ImgCache, Q) {
    var
        initPromise = null,
        init = function () {
            if (initPromise === null) {
                initPromise = Q.defer();
                ImgCache.init(function () {
                    initPromise.resolve();
                }, function () {
                    initPromise.reject();
                });
            }
            return initPromise.promise;
        };

    QImgCache.cacheFile = function (url) {
        var def = Q.defer();
        init().then(function () {
            ImgCache.cacheFile(
                url,
                function () {
                    def.resolve();
                }, function () {
                    def.reject();
                }, function (progressEvent) {
                    def.notify(progressEvent);
                }
            );
        }, function () {
            def.reject();
        });
        return def.promise;
    };

    QImgCache.getCachedFile = function (url) {
        var def = Q.defer();
        init().then(function () {
            ImgCache.getCachedFile(
                url,
                function(img_src, file_entry) {
                    if (file_entry === null) {
                        def.reject();
                    } else {
                        def.resolve(file_entry);
                    }
                }
            );
        }, function () {
            def.reject();
        });
        return def.promise;
    };
}) (window.ImgCache, window.Q);
