#Single

Single is a one file web server for static file service running on nodejs.

Key features:
* Easy to download, install, config and run.
* Powerful list page: you can sort, search files from a directory list page. 

#Summary

In many cases people only need a very simple web server for web UI development, POC or demo purpose. Single provides the easiest way to setup such a web server. It only has one file named 's.js', whenever you have the file you can start the server on a system with nodejs running on.

#Usage
You can config the server in two ways.

#### 1. Start a server by folder location and listenning port:

    node s.js [folder] [port]

* `folder` The root folder of the web server.
* `port` Listenning port

For example, start the server at e:/workspace on port 1337:

    node s.js e:/workspace 1337

#### 2. Config the server in s.js and start multiple servers at one time.

You can edit 's.js' to add multiple server configuration. Open the s.js you can find below:
```js
var config = [];
```
Feel free to edit it to include multiple sites:
```js
var config = [{
	location: 'e:/workspace'
	,port: 1337
}, {
	location: 'c:/workspace'
	,port: 1338
}];
```

Then you can start these servers by below command:

    node s.js

NOTE: if you specify folder and port in the command line, the internal config in 's.js' will be ignored.

#Compatibility
Mac/Windows/Linux, IE8+/Chrome/Safari/Firefox/Opera

#License
MIT
