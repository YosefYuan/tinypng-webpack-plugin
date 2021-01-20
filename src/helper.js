const fs = require('fs');

exports.checkAndCreateFile = function (path_way, content) {
  return new Promise((resolve, reject) => {
    fs.access(path_way, (err) => {
      if (err) {
        fs.appendFileSync(path_way, content, 'utf-8', (err) => {
          if (err) {
            reject(Error(`Encounter error when trying to create ${path_way}`));
          }
        });
      } else {
        resolve(true);
      }
    });
  });
};

exports.removeValInArr = function (arr, val) {
  arr = [...new Set(arr)];
  if (val instanceof Array) {
    val.forEach((v) => {
      arr = arguments.callee(arr, v);
    });
  } else {
    let index = arr.indexOf(val);
    if (index > -1) {
      arr.splice(index, 1);
    }
  }
  return arr;
};
