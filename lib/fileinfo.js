var fs = require('fs'),
    mkdirp = require('mkdirp'),
    _ = require('lodash');

module.exports = function (options) {

    var FileInfo = function (file) {
        this.name = file.name;
        this.originalName = file.name;
        this.size = file.size;
        this.type = file.type;
        this.deleteType = 'DELETE';
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
        this.name = require('path').basename(this.name).replace(/^\.+/, '');
        // Prevent overwriting existing files:
        if (options.prefixUuid) {
            this.name = require('uuid').v1() + '_' + this.name;
        } else {
            while (fs.existsSync(options.baseDir() + '/' + this.name)) {
                this.name = this.name.replace(/(?:(?: \(([\d]+)\))?(\.[^.]+))?$/, function (s, index, ext) {
                    return ' (' + ((parseInt(index, 10) || 0) + 1) + ')' + (ext || '');
                });
            }
        }
        //Touch the file to be sure. Synchronous to have this done before the emit of 'begin' happens
        var touchFile = options.baseDir() + '/' + this.name;
        mkdirp(options.baseDir(), function (err) {
            if (err) {}
            else {fs.closeSync(fs.openSync(touchFile, 'w'));}
        });
    };

    FileInfo.prototype.setUrl = function (type, baseUrl) {
        var key = type ? type + 'Url' : 'url';
        this[key] = baseUrl + '/' + encodeURIComponent(this.name);
    }

    return FileInfo;
};