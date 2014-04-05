module.exports = function (middleware, options) {
    
    return function (req, res, next) {
        res.set({
            'Access-Control-Allow-Origin': options.accessControl.allowOrigin,
            'Access-Control-Allow-Methods': options.accessControl.allowMethods
        });
        var UploadHandler = require('./uploadhandler')(options);
        var handler = new UploadHandler(req, res, function (result, redirect) {
            if (redirect) {
                files = {files: result};
                res.redirect(redirect.replace(/%s/, encodeURIComponent(JSON.stringify(files))));
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
            if(options.begin) {
                options.begin(fileInfo);
            }
            else {
                middleware.emit('begin', fileInfo);
            }
        });
        handler.on('end', function (fileInfo) {
            if(options.end) {
                options.end(fileInfo);
            }
            else {
                middleware.emit('end', fileInfo);
            }
        });
        handler.on('abort', function (fileInfo) {
            if(options.abort) {
                options.abort(fileInfo);
            }
            else {
                middleware.emit('abort', fileInfo);
            }
        });
        handler.on('error', function (e) {
            if(options.err) {
                options.err(fileInfo);
            }
            else {
                middleware.emit('abort', e);
            }
        });
        handler.on('delete', function (fileName) {
            if(options.del) {
                options.del(fileInfo);
            }
            else {
                middleware.emit('delete', fileName);
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
