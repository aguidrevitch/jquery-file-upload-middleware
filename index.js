var _ = require('lodash'),
    fs = require('fs');

var FileHandler = function (middleware, options, callback) {

    return function (req, res, next) {
        res.set({
            'Access-Control-Allow-Origin': options.accessControl.allowOrigin,
            'Access-Control-Allow-Methods': options.accessControl.allowMethods
        });
        var UploadHandler = require('./lib/uploadhandler')(options);
        var handler = new UploadHandler(req, res, function (result, redirect) {
            if (redirect) {
                res.redirect(redirect.replace(/%s/, encodeURIComponent(JSON.stringify(result))));
            } else {
                res.set({
                    'Content-Type': (req.headers.accept || '').indexOf('application/json') !== -1
                        ? 'application/json'
                        : 'text/plain'
                });
                res.json(200, result);
            }
        });

        handler.on('begin', function (fileInfo) {
            middleware.emit('begin', fileInfo);
        });
        handler.on('end', function (fileInfo) {
            middleware.emit('end', fileInfo);
        });
        handler.on('abort', function (fileInfo) {
            middleware.emit('abort', fileInfo);
        });
        handler.on('error', function (e) {
            middleware.emit('abort', e);
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

var EventEmitter = require('events').EventEmitter;
var JqueryFileUploadMiddleware = function () {
    EventEmitter.call(this);
};
require('util').inherits(JqueryFileUploadMiddleware, EventEmitter);

JqueryFileUploadMiddleware.prototype.prepareOptions = function (options) {
    options = _.extend({
        tmpDir: '/tmp',
        uploadDir: __dirname + '/public/files',
        uploadUrl: '/files/',
        maxPostSize: 11000000000, // 11 GB
        minFileSize: 1,
        maxFileSize: 10000000000, // 10 GB
        acceptFileTypes: /.+/i,
        imageTypes: /\.(gif|jpe?g|png)$/i,
        imageVersions: {
//            thumbnail: {
//                width: 80,
//                height: 80
//            }
        },
        accessControl: {
            allowOrigin: '*',
            allowMethods: 'OPTIONS, HEAD, GET, POST, PUT, DELETE'
        }
    }, options);

    _.each(['uploadDir', 'uploadUrl', 'deleteUrl'], function (key) {
        if (!_.isFunction(options[key])) {
            var originalValue = options[key];
            options[key] = function () {
                return originalValue
            };
        }
    });

    return options;
}

JqueryFileUploadMiddleware.prototype.fileHandler = function (options) {
    return FileHandler(this, this.prepareOptions(options));
};

JqueryFileUploadMiddleware.prototype.getFiles = function (options, callback) {
    options = this.prepareOptions(options);

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

module.exports = new JqueryFileUploadMiddleware();

