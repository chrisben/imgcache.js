# Using imgcache.js with Cordova/Phonegap

## javascript

You will need to include the cordova.js script in the html files where you want to use imgcache.js - see the `examples` folder.

imgcache.js should be initialised and used **AFTER** the [deviceready](http://cordova.apache.org/docs/en/edge/cordova_events_events.md.html#deviceready) event has been fired.
For instance if the code calling imgcache.js is within a function called `yourCallbackFunction` :

```
document.addEventListener("deviceready", yourCallbackFunction, false);
```

## Configuration

This section lists the configuration needed to make imgcache.js work with Cordova/Phonegap. This configuration takes place in the config.xml file of your Cordova project.

See [config.xml](config.xml) at the root of this project as an example.

### Features

#### Cordova 3.x -> 7.x

imgcache.js requires the following Cordova plugins:
* [File](http://cordova.apache.org/docs/en/latest/reference/cordova-plugin-file/index.html)
* [Device](http://cordova.apache.org/docs/en/latest/reference/cordova-plugin-device/index.html)
* [FileTransfer](http://cordova.apache.org/docs/en/latest/reference/cordova-plugin-file-transfer/index.html)

```
cordova plugin add cordova-plugin-file --save
cordova plugin add cordova-plugin-device --save
cordova plugin add cordova-plugin-file-transfer --save
```

For each of these plugins you will be required to define the corresponding package for the OS you target. Here is a default configuration for both iOS and Android :

```xml
<feature name="Device">
	<param name="ios-package" value="CDVDevice" />
	<param name="android-package" value="org.apache.cordova.device.Device" />
</feature>
<feature name="File">
	<param name="ios-package" value="CDVFile" />
	<param name="android-package" value="org.apache.cordova.file.FileUtils" />
</feature>
<feature name="FileTransfer">
	<param name="ios-package" value="CDVFileTransfer" />
	<param name="android-package" value="org.apache.cordova.filetransfer.FileTransfer" />
</feature>
```

#### Cordova 2.x

Features need to be added this way:

```xml
<feature name="http://api.phonegap.com/1.0/file"/>
<feature name="http://api.phonegap.com/1.0/device"/>
<feature name="http://api.phonegap.com/1.0/network"/>
```

### Phonegap Build

For Phonegap Build you also need to list all core plugins used (= each feature):

```
<gap:plugin name="org.apache.cordova.file" />
<gap:plugin name="org.apache.cordova.device" />
<gap:plugin name="org.apache.cordova.file-transfer" />
```

### Access origin

In order to cache remote images via http it is important to allow access to those domains. This can be setup via a whitelisting `<access>` element in your config.xml file.

If you only want to do tests you can allow access to all domains to avoid this kind of issues:

```xml
<access origin="*" />
```

In order to avoid possible security issues, always limit the allowed domains list whenever possible.

For more information about this access origin configuration see [Whitelist Guide](http://docs.phonegap.com/en/edge/guide_appdev_whitelist_index.md.html#Whitelist%20Guide).

## Android

For Android, it has been reported in [#148](https://github.com/chrisben/imgcache.js/issues/148) that the following is also required for Android:

```xml
<access origin="cdvfile://*" />
```

If you use the whitelist plugin you probably have to add the following as well:

```xml
<allow-intent href="cdvfile://*" />
```

## iOS

To keep cached images persistent across app updates, add the following to your
config.xml file:

```xml
<preference name="iosPersistentFileLocation" value="Library" />
```
