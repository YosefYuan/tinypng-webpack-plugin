'use strict';
const co = require('co');
const _ = require('lodash');
const tinify = require('tinify');
const fs = require('fs');
const md5 = require('md5');
const path = require('path');
const readline = require('readline');
const util = require('util');

let readdir = util.promisify(fs.readdir);
let stat = util.promisify(fs.lstat);
let readFile = util.promisify(fs.readFile);

let dict = {},
  appendDict = {},
  splitCode = '$$$';

let configOptions = null;

function getImgQueue(list, reg) {
  //对应分成三个队列，开启3个线程进行上传
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
 *
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
 *
 * @param {*} imgBuffer
 * @param {*} md5
 */
function* getImgMap() {
  let reg = new RegExp('.(' + configOptions.ext.join('|') + ')$', 'i');
  let map = {};
  const files = yield walk(configOptions.root, reg);
  // eslint-disable-next-line no-console
  console.log('files', files);
  return co(function* () {
    for (let filePath of files) {
      const buffer = yield readFile(filePath);
      map[md5(buffer)] = filePath;
    }
    return map;
  });
}

/**
 * 写操作，将压缩后的图片存储在一个固定的位置
 * @param {*} md5 压缩前 md5指纹
 * @param {*} imgBuffer 压缩后的 img buffer
 */
function* writeImg(imgBuffer, md5, map) {
  yield new Promise(function (resolve, reject) {
    //获取md5值
    const filePath = map[md5];
    if (filePath) {
      fs.writeFile(filePath, imgBuffer, function (err) {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    }
  });
}

function deImgQueue(queue, keys, map) {
  if (queue.length > 0) {
    let reTryCount = 3;
    let uploadErrorList = [];
    return co(function* () {
      function* upload(fileInfo, reTryCount) {
        if (reTryCount < 0) {
          //超过尝试次数
          uploadErrorList.push(fileInfo.name);
          return;
        }

        // 添加缓存，防止多次走服务器 md5
        let fileMd5 = md5(fileInfo.source.source());
        try {
          if (dict[fileMd5]) {
            return;
          }
        } catch (e) {
          throw e;
        }

        try {
          let compressImg = yield new Promise((resolve, reject) => {
            const originSource = fileInfo.source.source();
            if (configOptions.init) {
              resolve(originSource);
            } else {
              tinify.fromBuffer(originSource).toBuffer((err, resultData) => {
                if (err) {
                  reject(err);
                } else {
                  fileMd5 = md5(resultData);
                  resolve(resultData);
                }
              });
            }
          });
          //压缩图片成功
          fileInfo.source._value = compressImg;
          // 缓存压缩后的文件
          yield writeImg(compressImg, fileMd5, map);
          appendDict[fileMd5] = fileMd5;
        } catch (err) {
          if (err instanceof tinify.AccountError) {
            // Verify your API key and account limit.
            if (!keys) {
              //输出文件名 fileInfo.name
              uploadErrorList.push(fileInfo.name);
              return;
            }
            //tinify key 更换
            tinify.key = _.first(keys);
            keys = _.drop(keys);
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
    return [];
  }
}

/**
 * 初始化字典对象
 */
function* initDict() {
  let dictPath = path.resolve(configOptions.cacheDir, 'dict');
  yield new Promise(function (resolve, reject) {
    let rl = readline.createInterface({
      input: fs.createReadStream(dictPath),
    });
    rl.on('line', function (line) {
      //给dict对象 添加属性与对应的值
      if (line && line.indexOf(splitCode) >= 0) {
        let list = line.split(splitCode);
        dict[list[0]] = list[1];
      }
    });
    rl.on('close', function () {
      resolve(dict);
    });
  });
}

/**
 * 将appendDict内容导入到dict文件中
 */
function* appendDictFile() {
  let dictPath = path.resolve(configOptions.cacheDir, 'dict');
  function append(filePath, data) {
    return new Promise(function (resolve, reject) {
      fs.appendFile(filePath, data, function (err) {
        if (err) {
          reject(err);
        } else {
          resolve(resolve);
        }
      });
    });
  }
  for (let key in appendDict) {
    yield append(dictPath, key + splitCode + appendDict[key] + '\n');
  }
}

/**
 * 进行图片上传主操作
 * @param  {[type]} compilation     [webpack 构建对象]
 * @param  {[type]} options         [选项]
 * @return {Promise}
 */
module.exports = (compilation, options) => {
  //过滤文件尾缀名称
  configOptions = options;
  let reg = new RegExp('.(' + configOptions.ext.join('|') + ')$', 'i');
  let keys = options.key;
  if (options.proxy) {
    //这里启用proxy 但是proxy因为建立scoket连接，最后需要有个超时的等待时间来关闭这个scoket
    tinify.proxy = options.proxy;
  }
  return co(function* () {
    // const x = yield walk(configOptions.root);
    // console.log('x', x);
    const map = yield getImgMap;
    // eslint-disable-next-line no-console
    console.log('map', map);
    //初始化字典
    yield initDict;
    let imgQueue = getImgQueue(compilation.assets, reg);
    tinify.key = _.first(keys);
    keys = _.drop(keys);
    let result = yield Promise.all([
      deImgQueue(imgQueue[0], keys, map),
      deImgQueue(imgQueue[1], keys, map),
      deImgQueue(imgQueue[2], keys, map),
    ]);

    //将appendDict 保存到dict文件中
    yield appendDictFile;
    return result;
  });
};
