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
                res.status(200).json(result);
            }
        });

        handler.on('begin', function (fileInfo) {
            middleware.emit('begin', fileInfo, req, res);
        });
        handler.on('end', function (fileInfo) {
            middleware.emit('end', fileInfo, req, res);
        });
        handler.on('abort', function (fileInfo) {
            middleware.emit('abort', fileInfo, req, res);
        });
        handler.on('error', function (e) {
            middleware.emit('abort', e, req, res);
        });
        handler.on('delete', function (fileName) {
            middleware.emit('delete', fileName, req, res);
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
