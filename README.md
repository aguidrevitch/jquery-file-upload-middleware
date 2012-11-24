jquery-file-upload-middleware
=============================

jQuery-File-Upload Express.js middleware. Based on the server code of [jQuery-File-Upload](https://github.com/blueimp/jQuery-File-Upload)

Installation:

```
    $ npm install jquery-file-upload-middleware
```

Usage:

```javascript
    var express = require("express"),
        upload = require('jquery-file-upload-middleware');

    var app = express();
    app.configure(function () {
        ...
        app.use('/upload', upload({
            uploadDir: __dirname + '/public/uploads',
            uploadUrl: '/uploads/'
        }));
        app.use(express.bodyParser());
        ...
    });
```

On the frontend:

```html
   <input id="fileupload" type="file" name="files[]" data-url="/upload" multiple>
   <script>$('#fileupload').fileupload({ dataType: 'json' })</script>
```

Other options and their default values:
```javascript
    tmpDir: '/tmp',
    maxPostSize: 11000000000, // 11 GB
    minFileSize: 1,
    maxFileSize: 10000000000, // 10 GB
    acceptFileTypes: /.+/i,
    // Files not matched by this regular expression force a download dialog,
    // to prevent executing any scripts in the context of the service domain:
    safeFileTypes: /\.(gif|jpe?g|png)$/i,
    imageTypes: /\.(gif|jpe?g|png)$/i,
    imageVersions: {
        thumbnail: {
            width: 80,
            height: 80
        }
    },
    accessControl: {
        allowOrigin: '*',
        allowMethods: 'OPTIONS, HEAD, GET, POST, PUT, DELETE'
    }
```

## License
Copyright (c) 2012 [Aleksandr Guidrevitch](http://aguidrevitch.blogspot.com/)
Released under the [MIT license](http://www.opensource.org/licenses/MIT).




