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

    // configure upload middleware
    upload.configure({
        uploadDir: __dirname + '/public/uploads',
        uploadUrl: '/uploads',
        imageVersions: {
            thumbnail: {
                width: 80,
                height: 80
            }
        }
    });

    app.configure(function () {
        ...
        app.use('/upload', upload.fileHandler());
        app.use(express.bodyParser());
        ...
    });

```

On the frontend:

```html
   <input id="fileupload" type="file" name="files[]" data-url="/upload" multiple>
   <script>$('#fileupload').fileupload({ dataType: 'json' })</script>
```

To prevent access to /upload except for post (for security)
```javascript
upload.configure({
    uploadDir: __dirname + '/public/uploads/',
    uploadUrl: '/uploads'
});

/// Redirect all to home except post
app.get('/upload', function( req, res ){
	res.redirect('/');
});

app.put('/upload', function( req, res ){
	res.redirect('/');
});

app.delete('/upload', function( req, res ){
	res.redirect('/');
});

app.use('/upload', function(req, res, next){
    upload.fileHandler({
        uploadDir: function () {
            return __dirname + '/public/uploads/'
        },
        uploadUrl: function () {
            return '/uploads'
        }
    })(req, res, next);
});
```

Overriding global configuration

```javascript

    app.use('/upload2', upload.fileHandler({
        uploadDir: __dirname + '/public/uploads2',
        uploadUrl: '/uploads2',
        imageVersions: {
            thumbnail: {
                width: 100,
                height: 100
            }
        }
    }));

```

More sophisticated example - Events

```javascript
        app.use('/upload', upload.fileHandler());

        // events
        upload.on('begin', function (fileInfo, req, res) { 
            // fileInfo structure is the same as returned to browser
            // { 
            //     name: '3 (3).jpg',
            //     originalName: '3.jpg',
            //     size: 79262,
            //     type: 'image/jpeg',
            //     delete_type: 'DELETE',
            //     delete_url: 'http://yourhost/upload/3%20(3).jpg',
            //     url: 'http://yourhost/uploads/3%20(3).jpg',
            //     thumbnail_url: 'http://youhost/uploads/thumbnail/3%20(3).jpg' 
            // }
        });
        upload.on('abort', function (fileInfo, req, res) { ... });
        upload.on('end', function (fileInfo, req, res) { ... });
        upload.on('delete', function (fileInfo, req, res) { ... });
        upload.on('error', function (e, req, res) {
            console.log(e.message);
        });
```

Dynamic upload directory and url, isolating user files:

```javascript
        upload.configure({
            imageVersions: {
                thumbnail: {
                    width: 80,
                    height: 80
                }
            }
        });

        app.use('/upload', function (req, res, next) {
            // imageVersions are taken from upload.configure()
            upload.fileHandler({
                uploadDir: function () {
                    return __dirname + '/public/uploads/' + req.sessionID
                },
                uploadUrl: function () {
                    return '/uploads/' + req.sessionID
                }
            })(req, res, next);
        });
```

Moving uploaded files to different dir:

```javascript
        app.use('/api', function (req, res, next) {
            req.filemanager = upload.fileManager();
            next();
        });

        app.use('/api/endpoint', function (req, res, next) {
            // your real /api handler that will actually move the file
            ...
            // req.filemanager.move(filename, path, function (err, result))
            req.filemanager.move('SomeFile.jpg', 'project1', function (err, result) {
                // SomeFile.jpg gets moved from uploadDir/SomeFile.jpg to
                // uploadDir/project1/SomeFile.jpg
                // if path is relative (no leading slash), uploadUrl will
                // be used to generate relevant urls,
                // for absolute paths urls are not generated
                if (!err) {
                    // result structure
                    // {
                    //     filename: 'SomeFile.jpg',
                    //     url: '/uploads/project1/SomeFile.jpg',
                    //     thumbail_url : '/uploads/project1/thumbnail/SomeFile.jpg'
                    // }
                    ...
                } else {
                    console.log(err);
                }
            });
        });
```

Moving uploaded files out of uploadDir:

```
        app.use('/api', function (req, res, next) {
            var user = db.find(...);

            req.filemanager = upload.fileManager({
                targetDir: __dirname + '/public/u/' + user._id,
                targetUrl: '/u/' + user._id,
            });

            // or
            req.filemanager = upload.fileManager({
                targetDir: function () {
                    return __dirname + '/public/u/' + user._id
                },
                targetUrl: function () {
                    return'/u/' + user._id
                }
            });
            ...
            req.filemanager.move(req.body.filename, 'profile', function (err, result) {
                // file gets moved to __dirname + '/public/u/' + user._id + '/profile'
                if (!err) {

                }
            });
        });
```

Getting uploaded files mapped to their fs locations:

```javascript
        app.use('/list', function (req, res, next) {
            upload.fileManager().getFiles(function (files) {
                //  {
                //      "00001.MTS": {
                //          "path": "/home/.../public/uploads/ekE6k4j9PyrGtcg+SA6a5za3/00001.MTS"
                //      },
                //      "DSC00030.JPG": {
                //          "path": "/home/.../public/uploads/ekE6k4j9PyrGtcg+SA6a5za3/DSC00030.JPG",
                //          "thumbnail": "/home/.../public/uploads/ekE6k4j9PyrGtcg+SA6a5za3/thumbnail/DSC00030.JPG"
                //      }
                //  }
                res.json(files);
            });
        });

        // with dynamic upload directories

        app.use('/list', function (req, res, next) {
            upload.fileManager({
                uploadDir: function () {
                    return __dirname + '/public/uploads/' + req.sessionID
                },
                uploadUrl: function () {
                    return '/uploads/' + req.sessionID
                }
            }).getFiles(function (files) {
                res.json(files);
            });
        });
```

Other options and their default values:

```javascript
{
    tmpDir: '/tmp',
    uploadDir: __dirname + '/public/uploads',
    uploadUrl: '/uploads',
    targetDir: uploadDir,
    targetUrl: uploadUrl,
    ssl: false,
    hostname: null, // in case your reverse proxy doesn't set Host header
                    // eg 'google.com'
    maxPostSize: 11000000000, // 11 GB
    minFileSize: 1,
    maxFileSize: 10000000000, // 10 GB
    acceptFileTypes: /.+/i,
    imageTypes: /\.(gif|jpe?g|png)$/i,
    imageVersions: {
        thumbnail: {
            width: 80,
            height: 80
        }
    },
    imageArgs: ['-auto-orient'],
    accessControl: {
        allowOrigin: '*',
        allowMethods: 'OPTIONS, HEAD, GET, POST, PUT, DELETE'
    }
}
```

## Contributors

   * [@soomtong](http://github.com/soomtong)
   * [@gsarwohadi](https://github.com/gsarwohadi)
   * [@peecky](https://github.com/peecky)
   * [@tonyspiro](https://github.com/tonyspiro)
   * [@derjust](https://github.com/derjust)

## License
Copyright (c) 2012 [Aleksandr Guidrevitch](http://aguidrevitch.blogspot.com/)
Released under the [MIT license](http://www.opensource.org/licenses/MIT).
