var EventEmitter = require('events').EventEmitter,
    path = require('path'),
    fs = require('fs'),
    formidable = require('formidable'),
    imageMagick = require('imagemagick'),
    mkdirp = require('mkdirp'),
    _ = require('lodash'),
	async = require('async');

module.exports = function (options) {

    var FileInfo = require('./fileinfo')(
        _.extend({
            baseDir: options.uploadDir
        }, _.pick(options, 'minFileSize', 'maxFileSize', 'acceptFileTypes'))
    );

    var UploadHandler = function (req, res, callback) {
        EventEmitter.call(this);
        this.req = req;
        this.res = res;
        this.callback = callback;
    };
    require('util').inherits(UploadHandler, EventEmitter);

    UploadHandler.prototype.noCache = function () {
        this.res.set({
            'Pragma': 'no-cache',
            'Cache-Control': 'no-store, no-cache, must-revalidate',
            'Content-Disposition': 'inline; filename="files.json"'
        });
    };

    UploadHandler.prototype.get = function () {
        this.noCache();
        var files = [];
        fs.readdir(options.uploadDir(), _.bind(function (err, list) {
			async.each(list, function(name, cb) {
				fs.stat(options.uploadDir() + '/' + name, function(err, stats) {
					if (!err) {
						if (stats.isFile()) {
							fileInfo = new FileInfo({
		                        name: name,
		                        size: stats.size
							});
							this.initUrls(fileInfo, function(err) {
								files.push(fileInfo);
								cb(err);
								return;
							});
						}
					}
					cb(err);
				});
			},
			function(err) {
				if (err) console.log(err);
				this.callback({files: files});
			});
        }, this));
    };

    UploadHandler.prototype.post = function () {
        var self = this,
            form = new formidable.IncomingForm(),
            tmpFiles = [],
            files = [],
            map = {},
            counter = 1,
            redirect,
            finish = _.bind(function () {
                if (!--counter) {
					async.each(files, function(fileInfo, cb) {
                        this.initUrls(fileInfo, function(err) {
							this.emit('end', fileInfo);
							cb(err);
						});
					},
					function(err) {
						this.callback({files: files}, redirect);
					});
                }
            }, this);

        this.noCache();

        form.uploadDir = options.tmpDir;
        form
            .on('fileBegin', function (name, file) {
                tmpFiles.push(file.path);
                var fileInfo = new FileInfo(file);
                fileInfo.safeName();
                map[path.basename(file.path)] = fileInfo;
                files.push(fileInfo);
                self.emit('begin', fileInfo);
            })
            .on('field', function (name, value) {
                if (name === 'redirect') {
                    redirect = value;
                }
            })
            .on('file', function (name, file) {
                var fileInfo = map[path.basename(file.path)];
				fs.exists(file.path, function(exists) {
                if (exists) {
                    fileInfo.size = file.size;
                    if (!fileInfo.validate()) {
                        fs.unlink(file.path);
                        return;
                    }

                    var generatePreviews = function () {
                        if (options.imageTypes.test(fileInfo.name)) {
                            _.each(options.imageVersions, function (value, version) {
                                // creating directory recursive
								mkdirp(options.uploadDir() + '/' + version + '/', function (err, made) {
                                counter++;
                                var opts = options.imageVersions[version];
                                imageMagick.resize({
                                    width: opts.width,
                                    height: opts.height,
                                    srcPath: options.uploadDir() + '/' + fileInfo.name,
                                    dstPath: options.uploadDir() + '/' + version + '/' + fileInfo.name,
                                    customArgs: opts.imageArgs || ['-auto-orient']
                                }, finish);
								}
                            });
                        }
                    }

					mkdirp(options.uploadDir() + '/', function(err, made) {
                    counter++;
                    fs.rename(file.path, options.uploadDir() + '/' + fileInfo.name, function (err) {
                        if (!err) {
                            generatePreviews();
                            finish();
                        } else {
                            var is = fs.createReadStream(file.path);
                            var os = fs.createWriteStream(options.uploadDir() + '/' + fileInfo.name);
                            is.on('end', function (err) {
                                if (!err) {
                                    fs.unlink(file.path);
                                    generatePreviews();
                                }
                                finish();
                            });
                            is.pipe(os);
                        }
                    });
					});
                }
				}
            })
            .on('aborted', function () {
                _.each(tmpFiles, function (file) {
                    var fileInfo = map[path.basename(file)];
                    self.emit('abort', fileInfo);
                    fs.unlink(file);
                });
            })
            .on('error', function (e) {
                self.emit('error', e);
            })
            .on('progress', function (bytesReceived, bytesExpected) {
                if (bytesReceived > options.maxPostSize)
                    self.req.connection.destroy();
            })
            .on('end', finish)
            .parse(self.req);
    };

    UploadHandler.prototype.destroy = function () {
        var self = this,
            fileName = path.basename(decodeURIComponent(this.req.url));

        fs.unlink(options.uploadDir() + '/' + fileName, function (ex) {
            _.each(options.imageVersions, function (value, version) {
                fs.unlink(options.uploadDir() + '/' + version + '/' + fileName);
            });
            self.emit('delete', fileName);
            self.callback({success: !ex});
        });
    };

    UploadHandler.prototype.initUrls = function (fileInfo, cb) {
        var baseUrl = (options.ssl ? 'https:' : 'http:') + '//' + (options.hostname || this.req.get('Host'));
        fileInfo.setUrl(null, baseUrl + options.uploadUrl());
        fileInfo.setUrl('delete', baseUrl + this.req.originalUrl);
		async.each(Object.keys(options.imageVersions), function(version, cb) {
			fs.exists(options.uploadDir() + '/' + version + '/' + fileInfo.name, function(exists) {
				if (exists) fileInfo.setUrl(version, baseUrl + options.uploadUrl() + '/' + version);
				cb(null);
			})
		},
		cb);
    };

    return UploadHandler;
}

