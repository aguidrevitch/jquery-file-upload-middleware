var _ = require('lodash'),
    fs = require('fs'),
    path = require('path'),
    mkdirp = require('mkdirp');

module.exports = function (middleware, options) {

    options = _.extend({
        targetDir: function () {
            return options.uploadDir();
        },
        targetUrl: function () {
            return options.uploadUrl();
        }
    }, options);

    _.each(['targetDir', 'targetUrl'], function (key) {
        if (!_.isFunction(options[key])) {
            var originalValue = options[key];
            options[key] = function () {
                return originalValue
            };
        }
    });

    var FileManager = function () {
    };

    FileManager.prototype.getFiles = function (callback) {

        var files = {};
        var counter = 1;
        var finish = function () {
            if (!--counter)
                callback(files);
        };

        fs.readdir(options.uploadDir(), _.bind(function (err, list) {
            _.each(list, function (name) {
                var stats = fs.statSync(options.uploadDir() + '/' + name);
                if (stats.isFile()) {
                    files[name] = {
                        path: options.uploadDir() + '/' + name
                    };
                    _.each(options.imageVersions, function (value, version) {
                        counter++;
                        fs.exists(options.uploadDir() + '/' + version + '/' + name, function (exists) {
                            if (exists)
                                files[name][version] = options.uploadDir() + '/' + version + '/' + name;
                            finish();
                        });
                    });
                }
            }, this);
            finish();
        }, this));
    };

    var safeName = function (dir, filename, callback) {
        fs.exists(dir + '/' + filename, function (exists) {
            if (exists) {
                filename = filename.replace(/(?:(?: \(([\d]+)\))?(\.[^.]+))?$/, function (s, index, ext) {
                    return ' (' + ((parseInt(index, 10) || 0) + 1) + ')' + (ext || '');
                });
                safeName(dir, filename, callback)
            } else {
                callback(filename);
            }
        });
    };

    var moveFile = function (source, target, callback) {
        fs.rename(source, target, function (err) {
            if (!err)
                callback();
            else {
                var is = fs.createReadStream(source);
                var os = fs.createWriteStream(target);
                is.on('end', function (err) {
                    if (!err) {
                        fs.unlink(source, callback);
                    } else {
                        callback(err);
                    }
                });
                is.pipe(os);
            }
        });
    };

    var move = function (source, targetDir, callback) {
        fs.exists(targetDir, function (exists) {
            if (!exists) {
                mkdirp(targetDir, function (err) {
                    if (err)
                        callback(err);
                    else
                        move(source, targetDir, callback);
                });
            } else {
                fs.stat(source, function (err, stat) {
                    if (!err) {
                        if (stat.isFile()) {
                            safeName(targetDir, path.basename(source), function (safename) {
                                moveFile(source, targetDir + '/' + safename, function (err) {
                                    callback(err, safename);
                                });
                            });
                        } else {
                            callback(new Error(source + ' is not a file'));
                        }
                    } else {
                        callback(err);
                    }
                });
            }
        });
    };

    FileManager.prototype.move = function (filename, targetDir, callback) {

        var targetUrl;

        // for safety
        filename = path.basename(filename).replace(/^\.+/, '');

        if (!targetDir.match(/^\//)) {
            targetUrl = options.targetUrl()  + '/' + targetDir;
            targetDir = options.targetDir() + '/' + targetDir;
            relative = true;
        }

        fs.stat(options.uploadDir() + '/' + filename, function (err, stat) {
            if (!err) {
                if (stat.isFile()) {
                    move(options.uploadDir() + '/' + filename, targetDir, function (err, safename) {
                        if (err) {
                            callback(err);
                        } else {
                            var urls = {
                                filename: safename
                            };

                            var counter = 1;
                            var finish = function (err) {
                                if (err)
                                    counter = 1;
                                if (!--counter)
                                    callback(err, err ? null : urls);
                            };

                            if (targetUrl)
                                urls.url = targetUrl + '/' + safename;

                            _.each(options.imageVersions, function (value, version) {
                                counter++;
                                fs.exists(options.uploadDir() + '/' + version + '/' + filename, function (exists) {
                                    if (exists) {
                                        move(options.uploadDir() + '/' + version + '/' + filename, targetDir + '/' + version + '/', function (err, safename) {
                                            if (!err && relative)
                                                urls[version + 'Url'] = targetUrl + '/' + version + '/' + safename;
                                            finish(err);
                                        });
                                    }
                                });
                            });
                            finish();
                        }
                    });
                } else {
                    callback(new Error('File not found'));
                }
            } else {
                callback(err);
            }
        });
    }

    return new FileManager();
};

