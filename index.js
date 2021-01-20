'use strict';

const _ = require('lodash');
const path = require('path');
const uploader = require('./src/uploader.js');
const stdout = require('./src/stdout.js');

class TinyPNGPlugin {
  constructor(options) {
    this.pluginName = 'tinypng-webpack-plugin';
    this.options = _.assign(
      {
        key: '',
        ext: ['png', 'jpeg', 'jpg'],
        proxy: '',
        cacheDir: path.resolve(__dirname, 'map'),
        init: false,
      },
      options
    );

    if (!this.options.key) {
      throw new Error('need tinyPNG key');
    }

    if (!this.options.ext instanceof Array) {
      throw new Error('ext should be an array');
    }

    if (_.isString(this.options.proxy) && this.options.proxy !== '') {
      if (this.options.proxy.indexOf('http://') === -1) {
        throw new Error('the proxy must be HTTP proxy!');
      }
    }
  }
  apply(compiler) {
    compiler.hooks.emit.tapPromise(this.pluginName, (compilation) => {
      stdout.render();
      return uploader(compilation, this.options)
        .then((failList) => {
          stdout.stop();
          stdout.renderErrorList(failList);
        })
        .catch((e) => {
          stdout.stop();
          compilation.errors.push(e);
        });
    });
  }
}

module.exports = TinyPNGPlugin;
