Package.describe({
  summary: "JS library that stores images locally for offline apps using PhoneGap/Cordova or browsers supporting the new html5 File API",
  version: "2.1.0",
  git: "https://github.com/chrisben/imgcache.js"
});

Package.onUse(function(api) {
  api.versionsFrom(["METEOR@0.9.5", "METEOR@1.1.0.2"]);
  api.addFiles("lib/imgcache.js");
});
