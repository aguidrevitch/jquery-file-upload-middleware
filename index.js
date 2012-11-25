module.exports = function (options) {

    var path = require('path'),
        fs = require('fs'),
        formidable = require('formidable'),
        imageMagick = require('imagemagick'),
        _ = require('lodash'),
        // Since Node 0.8, .existsSync() moved from path to fs:
        _existsSync = fs.existsSync || path.existsSync,
        utf8encode = function (str) {
            return unescape(encodeURIComponent(str));
        },
        nameCountRegexp = /(?:(?: \(([\d]+)\))?(\.[^.]+))?$/,
        nameCountFunc = function (s, index, ext) {
            return ' (' + ((parseInt(index, 10) || 0) + 1) + ')' + (ext || '');
        };

    options = _.extend({
        tmpDir: '/tmp',
        uploadDir: __dirname + '/public/files',
        uploadUrl: '/files/',
        maxPostSize: 11000000000, // 11 GB
        minFileSize: 1,
        maxFileSize: 10000000000, // 10 GB
        acceptFileTypes: /.+/i,
        // Files not matched by this regular expression force a download dialog,
        // to prevent executing any scripts in the context of the service domain:
        safeFileTypes: /\.(gif|jpe?g|png)$/i,
        imageTypes: /\.(gif|jpe?g|png)$/i,
        imageVersions: {
            /*
             thumbnail: {
             width: 80,
             height: 80
             }
             */
        },
        accessControl: {
            allowOrigin: '*',
            allowMethods: 'OPTIONS, HEAD, GET, POST, PUT, DELETE'
        }
    }, options);

    var FileInfo = function (file) {
        this.name = file.name;
        this.size = file.size;
        this.type = file.type;
        this.delete_type = 'DELETE';
    };

    FileInfo.prototype.validate = function () {
        if (options.minFileSize && options.minFileSize > this.size) {
            this.error = 'File is too small';
        } else if (options.maxFileSize && options.maxFileSize < this.size) {
            this.error = 'File is too big';
        } else if (!options.acceptFileTypes.test(this.name)) {
            this.error = 'Filetype not allowed';
        }
        return !this.error;
    };

    FileInfo.prototype.safeName = function () {
        // Prevent directory traversal and creating hidden system files:
        this.name = path.basename(this.name).replace(/^\.+/, '');
        // Prevent overwriting existing files:
        while (_existsSync(options.uploadDir + '/' + this.name)) {
            this.name = this.name.replace(nameCountRegexp, nameCountFunc);
        }
    };

    FileInfo.prototype.initUrls = function (req) {
        if (!this.error) {
            var that = this,
                baseUrl = (options.ssl ? 'https:' : 'http:') +
                    '//' + req.headers.host;
            this.delete_url = baseUrl + req.originalUrl + '/' + encodeURIComponent(this.name);
            this.url = baseUrl + options.uploadUrl + '/' + encodeURIComponent(this.name);
            Object.keys(options.imageVersions).forEach(function (version) {
                if (_existsSync(
                    options.uploadDir + '/' + version + '/' + that.name
                )) {
                    that[version + '_url'] = baseUrl + options.uploadUrl + '/' + version + '/' + encodeURIComponent(that.name);
                }
            });
        }
    };

    var UploadHandler = function (req, res, callback) {
        this.req = req;
        this.res = res;
        this.callback = callback;
    };

    UploadHandler.prototype.noCache = function () {
        this.res.set({
            'Pragma': 'no-cache',
            'Cache-Control': 'no-store, no-cache, must-revalidate',
            'Content-Disposition': 'inline; filename="files.json"'
        });
    };

    UploadHandler.prototype.get = function () {
        var handler = this,
            files = [];
        handler.noCache();
        fs.readdir(options.uploadDir, function (err, list) {
            _.each(list, function (name) {
                var stats = fs.statSync(options.uploadDir + '/' + name),
                    fileInfo;
                if (stats.isFile()) {
                    fileInfo = new FileInfo({
                        name: name,
                        size: stats.size
                    });
                    fileInfo.initUrls(handler.req);
                    files.push(fileInfo);
                }
            });
            handler.callback(files);
        });
    };

    UploadHandler.prototype.post = function () {

        var handler = this,
            form = new formidable.IncomingForm(),
            tmpFiles = [],
            files = [],
            map = {},
            counter = 1,
            redirect,
            finish = function () {
                if (!--counter) {
                    files.forEach(function (fileInfo) {
                        fileInfo.initUrls(handler.req);
                    });
                    handler.callback(files, redirect);
                }
            };

        handler.noCache();

        form.uploadDir = options.tmpDir;
        form
            .on('fileBegin', function (name, file) {
                tmpFiles.push(file.path);
                var fileInfo = new FileInfo(file, handler.req, true);
                fileInfo.safeName();
                map[path.basename(file.path)] = fileInfo;
                files.push(fileInfo);
            })
            .on('field', function (name, value) {
                if (name === 'redirect') {
                    redirect = value;
                }
            })
            .on('file', function (name, file) {
                var fileInfo = map[path.basename(file.path)];
                if (_existsSync(file.path)) {
                    fileInfo.size = file.size;
                    if (!fileInfo.validate()) {
                        fs.unlink(file.path);
                        return;
                    }

                    var generatePreviews = function () {
                        if (options.imageTypes.test(fileInfo.name) && _.keys(options.imageVersions).length) {
                            _.keys(options.imageVersions).forEach(function (version) {
                                if (!_existsSync(options.uploadDir + '/' + version + '/'))
                                    throw new Error(options.uploadDir + '/' + version + '/' + ' not exists');
                                counter++;
                                var opts = options.imageVersions[version];
                                imageMagick.resize({
                                    width: opts.width,
                                    height: opts.height,
                                    srcPath: options.uploadDir + '/' + fileInfo.name,
                                    dstPath: options.uploadDir + '/' + version + '/' + fileInfo.name
                                }, finish);
                            });
                        }
                    }

                    counter++;
                    fs.rename(file.path, options.uploadDir + '/' + fileInfo.name, function (err) {
                        if (!err) {
                            generatePreviews();
                            finish();
                        } else {
                            var is = fs.createReadStream(file.path);
                            var os = fs.createWriteStream(options.uploadDir + '/' + fileInfo.name);
                            is.on('end', function (err) {
                                if (!err) {
                                    fs.unlinkSync(file.path);
                                    generatePreviews();
                                }
                                finish();
                            });
                            is.pipe(os);
                        }
                    });
                }
            })
            .on('aborted', function () {
                tmpFiles.forEach(function (file) {
                    fs.unlink(file);
                });
            })
            .on('error', function (e) {
                console.log(e);
            })
            .on('progress', function (bytesReceived, bytesExpected) {
                if (bytesReceived > options.maxPostSize)
                    handler.req.connection.destroy();
            })
            .on('end', finish)
            .parse(handler.req);
    };

    UploadHandler.prototype.destroy = function () {
        var handler = this,
            fileName = path.basename(decodeURIComponent(this.req.url));

        fs.unlink(options.uploadDir + '/' + fileName, function (ex) {
            Object.keys(options.imageVersions).forEach(function (version) {
                fs.unlink(options.uploadDir + '/' + version + '/' + fileName);
            });
            handler.callback(!ex);
        });
    };

    return function (req, res, next) {
        res.set({
            'Access-Control-Allow-Origin': options.accessControl.allowOrigin,
            'Access-Control-Allow-Methods': options.accessControl.allowMethods
        });
        var handler = new UploadHandler(req, res, function (result, redirect) {
            if (redirect) {
                res.redirect(redirect.replace(/%s/, encodeURIComponent(JSON.stringify(result))));
            } else {
                res.set({
                    'Content-Type': req.headers.accept.indexOf('application/json') !== -1
                        ? 'application/json'
                        : 'text/plain'
                });
                res.json(200, result);
            }
        });
        switch (req.method) {
            case 'OPTIONS':
                res.end();
                break;
            case 'HEAD':
            case 'GET':
                handler.get();
                break;
            case 'POST':
                handler.post();
                break;
            case 'DELETE':
                handler.destroy();
                break;
            default:
                res.send(405);
        }

    }

};