var _ = require('lodash'),
    EventEmitter = require('events').EventEmitter,
    os = require("os");

var JqueryFileUploadMiddleware = function () {
    EventEmitter.call(this);
    // setting default options
    this.options = this.prepareOptions({});
};
require('util').inherits(JqueryFileUploadMiddleware, EventEmitter);

JqueryFileUploadMiddleware.prototype.prepareOptions = function (options) {
    options = _.extend({
        tmpDir: os.tmpdir(),
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

    _.each(['uploadDir', 'uploadUrl'], function (key) {
        if (!_.isFunction(options[key])) {
            var originalValue = options[key];
            options[key] = function () {
                return originalValue
            };
        }
    });

    return options;
}

JqueryFileUploadMiddleware.prototype.configure = function (options) {
    this.options = this.prepareOptions(options);
};

JqueryFileUploadMiddleware.prototype.fileHandler = function (options) {
    return require('./lib/filehandler')(this, this.prepareOptions(_.extend(this.options, options)));
};

JqueryFileUploadMiddleware.prototype.fileManager = function (options) {
    return require('./lib/filemanager')(this, this.prepareOptions(_.extend(this.options, options)));
};

module.exports = new JqueryFileUploadMiddleware();