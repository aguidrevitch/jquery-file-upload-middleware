module.exports = function (middleware, options) {

    return function (req, res, next) {
        res.set({
            'Access-Control-Allow-Origin': options.accessControl.allowOrigin,
            'Access-Control-Allow-Methods': options.accessControl.allowMethods
        });
        var UploadHandler = require('./uploadhandler')(options);
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
        handler.on('delete', function (fileName) {
            middleware.emit('delete', fileName);
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
