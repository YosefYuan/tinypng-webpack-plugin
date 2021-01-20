'use strict';
const co = require('co');
const _ = require('lodash');
const tinify = require('tinify');
const fs = require('fs');
const md5 = require('md5');
const path = require('path');
const util = require('util');
const helper = require('./helper');

let readdir = util.promisify(fs.readdir);
let stat = util.promisify(fs.lstat);
let readFile = util.promisify(fs.readFile);
let writeFile = util.promisify(fs.writeFile);

let dict = {},
  options = null,
  reg,
  key = '',
  dictPath;

function getImgQueue(list, reg) {
  // upload using 3 threads
  let queue = [[], [], []];
  let count = 0;
  _.each(list, function (val, key) {
    if (reg.exec(key)) {
      //val RawSource 对象
      queue[count % queue.length].push({
        name: key,
        source: val,
      });
      count++;
    }
  });
  return queue;
}

/**
 * traverse a folder recursively and get a files array
 * @param {*} imgBuffer
 * @param {*} md5
 */
function walk(dir, reg) {
  return readdir(dir)
    .then((files) => {
      return Promise.all(
        files.map((f) => {
          let file = path.join(dir, f);
          return stat(file).then((stat) => {
            if (stat.isDirectory()) {
              return walk(file, reg);
            } else {
              return reg.exec(file) ? [file] : [];
            }
          });
        })
      );
    })
    .then((files) => {
      return files.reduce((pre, cur) => pre.concat(cur));
    });
}

/**
 * get the img map,like this: { md5: filePath }
 */
function* getImgMap() {
  let reg = new RegExp('.(' + options.ext.join('|') + ')$', 'i');
  let map = {};
  const files = yield walk(options.root, reg);
  return co(function* () {
    for (let filePath of files) {
      const buffer = yield readFile(filePath);
      const fileMd5 = md5(buffer);
      if (map[fileMd5]) {
        if (map[fileMd5] instanceof Array) {
          map[fileMd5] = [...map[fileMd5], filePath];
        } else {
          map[fileMd5] = [map[fileMd5], filePath];
        }
      } else {
        map[fileMd5] = filePath;
      }
    }
    return map;
  });
}

/**
 * write img buffer to a path
 * @param {*} md5 img's fingerprint before compress
 * @param {*} imgBuffer compressed img buffer
 */
function* writeImg(imgBuffer, md5, map) {
  const filePath = map[md5];
  if (filePath) {
    if (filePath instanceof Array) {
      for (let singleFilePath of filePath) {
        yield writeFile(singleFilePath, imgBuffer);
      }
    } else {
      yield writeFile(filePath, imgBuffer);
    }
  }
}

function formatDict(newFilePath) {
  newFilePath = formatPath(newFilePath);
  const dictEntries = Object.entries(dict);
  for (const [key, val] of dictEntries) {
    if (val instanceof Array) {
      dict[key] = helper.removeValInArr(val, newFilePath);
      if (dict[key].length === 0) delete dict[key];
    } else if (dict[key] === newFilePath) {
      delete dict[key];
    }
  }
}

/**
 * format filePath
 * @param {*} newFilePath
 */
function formatPath(newFilePath) {
  const formatSinglePath = (originSinglePath) =>
    originSinglePath.split(options.root).join('');
  if (newFilePath instanceof Array) {
    return newFilePath.map((singleFilePath) =>
      formatSinglePath(singleFilePath)
    );
  } else {
    return formatSinglePath(newFilePath);
  }
}

function deImgQueue(queue, map) {
  if (queue.length > 0) {
    let reTryCount = 3;
    let uploadErrorList = [];
    return co(function* () {
      function* upload(fileInfo, reTryCount) {
        // check if exceed the retry times
        if (reTryCount < 0) {
          uploadErrorList.push(fileInfo.name);
          return;
        }

        let fileMd5 = md5(fileInfo.source.source());
        let newFilePath = map[fileMd5];
        let originPath = dict[fileMd5];
        formatDict(newFilePath);

        // check cache and update path
        if (originPath) {
          dict[fileMd5] = formatPath(newFilePath);
          return;
        }

        // compress img
        try {
          let compressedMd5;
          let compressImg;
          const originSource = fileInfo.source.source();
          if (options.init) {
            dict[fileMd5] = formatPath(newFilePath);
            return;
          }
          compressImg = yield new Promise((resolve, reject) => {
            tinify.fromBuffer(originSource).toBuffer((err, resultData) => {
              if (err) {
                reject(err);
              } else {
                compressedMd5 = md5(resultData);
                resolve(resultData);
              }
            });
          });
          // success
          fileInfo.source._value = compressImg;
          // save to origin file
          if (compressedMd5) {
            dict[compressedMd5] = formatPath(newFilePath);
            yield writeImg(compressImg, fileMd5, map);
          }
        } catch (err) {
          if (err instanceof tinify.AccountError) {
            yield upload(fileInfo, reTryCount);
          } else {
            // Something else went wrong, unrelated to the Tinify API.
            yield upload(fileInfo, reTryCount - 1);
          }
        }
      }

      for (let fileInfo of queue) {
        yield upload(fileInfo, reTryCount);
      }
      return uploadErrorList;
    });
  } else {
    return Promise.resolve();
  }
}

/**
 * init dict
 */
function* initDict() {
  dictPath = path.resolve(options.cacheDir, 'dict.json');
  yield helper.checkAndCreateFile(dictPath, '{}');
  const data = yield readFile(dictPath, 'utf8');
  dict = JSON.parse(data);
}

/**
 * save content to file
 */
function* appendDictFile() {
  yield writeFile(dictPath, JSON.stringify(dict));
}

function init(innerOptions) {
  options = innerOptions;
  reg = new RegExp('.(' + options.ext.join('|') + ')$', 'i');
  key = options.key;
  if (options.proxy) {
    // Proxy is enabled.
    // Because it's scoket connect，it takes a little time (timeout) to close.
    tinify.proxy = options.proxy;
  }
  tinify.key = key;
}

/**
 * main program
 * @param  {[type]} compilation     [webpack compilation object]
 * @param  {[type]} options         [custom options]
 * @return {Promise}
 */
module.exports = (compilation, innerOptions) => {
  init(innerOptions);
  return co(function* () {
    const map = yield getImgMap;
    //init dict
    yield initDict;
    let imgQueue = getImgQueue(compilation.assets, reg);
    let result = yield Promise.all([
      deImgQueue(imgQueue[0], map),
      deImgQueue(imgQueue[1], map),
      deImgQueue(imgQueue[2], map),
    ]);

    // save cache content to dict
    yield appendDictFile;
    return result;
  });
};
