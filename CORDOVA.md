# Using imgcache.js with Cordova/Phonegap

## javascript

You will need to include the cordova.js script in the html files where you want to use imgcache.js - see the `examples` folder.

imgcache.js should be initialised and used after the [deviceready](http://cordova.apache.org/docs/en/edge/cordova_events_events.md.html#deviceready) event has been fired.
For instance if the code calling imgcache.js is within a function called `yourCallbackFunction` :

```
document.addEventListener("deviceready", yourCallbackFunction, false);
```

## Configuration

This section lists the configuration needed to make imgcache.js work with Cordova/Phonegap. This configuration takes place in the config.xml file of your Cordova project.

See [config.xml](config.xml) at the root of this project as an example.

### Features

#### Cordova 3.x

imgcache.js requires the following Cordova features/plugins:
* [File](http://docs.phonegap.com/en/edge/cordova_file_file.md.html#File_accessing_the_feature)
* [Device](http://docs.phonegap.com/en/edge/cordova_device_device.md.html#Device_accessing_the_feature)
* [FileTransfer](https://github.com/apache/cordova-plugin-file-transfer/blob/dev/doc/index.md)

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
