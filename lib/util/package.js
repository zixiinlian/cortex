// utility tools for package.json

'use strict';

var fs          = require('fs-sync');
var node_fs     = require('fs');
var node_path   = require('path');
var readPkgJSON = require('read-package-json');
var lang        = require('./lang');
var modified    = require('modified');
var async       = require('async');

var REGEX_IS_CORTEX = /cortex\.json$/i;


exports.is_cortex_json = function (file) {
    return REGEX_IS_CORTEX.test(file);
};


// Sync method
// @param {path} cwd
// @param {function(err, package_file)} callback
// @param {boolean} strict If true and package is not found, an error will be thrown.
exports.get_package_file = function (cwd, callback, strict) {
    var package_json    = node_path.join(cwd, 'package.json');
    var cortex_json     = node_path.join(cwd, 'cortex.json');

    if ( fs.exists(cortex_json) ) {
        return callback(null, cortex_json);
    }

    if ( fs.exists(package_json) ) {
        return callback(null, package_json);
    }

    if ( strict ) {
        callback({
            code: 'ENOPKG',
            message: 'Both cortex.json and package.json are not found.',
            data: {
                cwd: cwd
            }
        });

    } else {
        callback(null, cortex_json);
    }
};

    

// Get the enhanced and cooked json object of package, including
// - readme
// - readmeFilename
// - gitHead
// This method is often used for publishing
// @param {string} cwd The ROOT directory of the current package 
exports.get_enhanced_package = function (cwd, callback) {
    var file;

    async.waterfall([
        function (done) {
            exports.get_package_file(cwd, done, true);
        },

        function (f, done) {
            file = f;
            exports.enhance_package_file(f, done);
        },

        function (json, done) {
            // if read from package.json, there is a field named `cortex`
            if ( !exports.is_cortex_json(file) ) {
                json = exports.merge_package_json(json);
            }

            // add styles field
            json.styles = exports.package_styles(cwd, json);
            done(null, json);
        }

    ], callback);
};


// Get the original json object about cortex, or the cortex field of package.json.
// This method is often used for altering package.json file
exports.get_original_package = function (cwd, callback, use_inherits) {
    var file;

    async.waterfall([
        function (done) {
            exports.get_package_file(cwd, done, true);
        },

        function (f, done) {
            file = f;
            exports.read_json(f, done);
        },

        function (json, done){
            if ( !exports.is_cortex_json(file) ) {
                json = exports.merge_package_json(json, use_inherits);
            }

            done(null, json);
        }

    ], callback);
};


exports._filter_package_fields = function (json) {
    ['dependencies', 'asyncDependencies', 'scripts'].forEach(function (key) {
        if ( !json.hasOwnProperty(key) ) {
            json[key] = {};
        }
    });
};


exports.save_package = function (cwd, json, callback) {
    exports.get_package_file(cwd, function (err, file) {
        if ( err ) {
            return callback(err);
        }

        if ( exports.is_cortex_json(file) ) {
            exports.save_to_file(file, json, callback);

        } else {
            exports.read_json(file, function (err, pkg) {
                if ( err ) {
                    return callback(err);
                }

                pkg.cortex = json;

                exports.save_to_file(file, pkg, callback);
            });
        }
    });
};


exports.save_to_file = function (file, json, callback) {
    node_fs.writeFile(file, JSON.stringify(json, null, 2), function (err) {
        callback(err && {
            code: 'ESAVEPKG',
            message: 'fail to save package to "' + file + '", error: ' + err.stack,
            data: {
                error: err,
                file: file
            }
        });
    });
};


exports.read_json = function (file, callback) {
    try {
        var pkg = fs.readJSON( file );
        callback(null, pkg);

    } catch(e) {
        callback({
            code: 'EPARSEPKG',
            message: 'Error parsing "' + file + '": \n' + e.stack,
            data: {
                error: e
            }
        });
    }    
};


exports.enhance_package_file = function (file, callback) {
    readPkgJSON(file, callback);
};


// Merge the fields of package.json into the field cortex
// @param {boolean} use_inherits 
exports.merge_package_json = function (pkg, use_inherits) {
    var cortex;

    if ( use_inherits ) {
        var F = function () {};
        F.prototype = pkg;

        var cortex = new F;
        lang.mix(cortex, pkg.cortex || {});
        delete pkg.cortex;

        exports._filter_package_fields(cortex);
    
    } else {
        cortex = pkg.cortex || {};
        exports._filter_package_fields(cortex);

        lang.mix(cortex, pkg, false);
        delete cortex.cortex;
    }

    return cortex;
};


exports.package_styles = function (cwd, pkg) {
    var directories_css = lang.object_member_by_namespaces(pkg, 'directories.css', 'css');
    var styles;
    var dir;

    if ( directories_css && fs.isDir(dir = node_path.join(cwd, directories_css)) ) {
        styles = fs.expand('**/*.css', {
            cwd: dir
        });
    }

    return styles || [];
};


// Get the root path of the project
exports.repo_root = function (cwd) {
    do {
        if(fs.exists(cwd, 'package.json') || fs.exists(cwd, 'cortex.json')){
            return cwd;
        }

        cwd = node_path.dirname(cwd);
    
    }while(cwd !== '/');

    return null;
};


// Get the cached document of a specific package,
// which will be saved by the last `cortex install` or `cortex publish`
// @param {Object} options
// - name
// - cache_root
// @param {fuction(err, json)} callback
exports.get_cached_document = function (options, callback) {
    var document_file = node_path.join(options.cache_root, options.name, 'document.cache');

    var json;

    if ( fs.exists(document_file) ) {
        var content = fs.read(document_file);

        try {
            json = modified.parse(content).data;
        } catch(e) {
        }
    }

    callback(null, json || {});
};

