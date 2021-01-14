# tinypng-webpack-plugin

a img compress plugin use with tinyPNG for webpack.

## Get TinyPNG key

[link](https://tinypng.com/developers)

## Installation
```shell
# for webpack 4
$ npm install tinypng-webpack-plugin --save-dev
```

## Example Webpack Config

```javascript
var tinyPngWebpackPlugin = require('tinypng-webpack-plugin');

    //in your webpack plugins array
    module.exports = {
      plugins: [
          new tinyPngWebpackPlugin({
              key:"your tinyPNG key",
              cacheDir: path.resolve(__dirname, 'src/assets/cache')
          })
      ]
    }
```

PS: src/assets/cache 文件夹中需要包含名称为<font color=red>dict</font>的文件
## Usage
```javascript
new tinyPngWebpackPlugin({
    key:"your tinyPNG key",//can be Array, eg:['your key 1','your key 2'....]
    ext: ['png', 'jpeg', 'jpg'],//img ext name
    proxy:'http://user:pass@192.168.0.1:8080',//http proxy,eg:如果你来自中国，同时拥有shadowsocks，翻墙默认配置为 http:127.0.0.1:1080 即可。（注，该参数因为需要超时断开连接的原因，导致最后会延迟执行一会webpack。但相对于国内网络环境，用此参数还是非常划算的，测试原有两张图片，无此参数耗时2000ms+，有此参数耗时1000ms+节约近半。）
    cacheDir: path.resolve(__dirname, 'src/assets/cache'), // cache 文件夹中需要包含名称为"dict"的文件
    init: false
})
```
### Options Description
* key: Required, tinyPNG key.
* cacheDir: Required, if you'd like to be tracked by <font color=red>git</font>.
* init: not Required  
At first, this options should be set <font color=red>true</font> if you think all the imgs at present are with no need to compress. Just run the 'yarn serve'(or other command) to init all the imgs' cache.
Then, this options should be <font color=red>deleted</font> or set <font color=red>false</font>.

* ext: not Required, to be compress img ext name.
* proxy：not Required, a http proxy to improve the network environment.eg:http://127.0.0.1:1080.

### Defaults Options
```javascript
    {
        key:'',
        ext: ['png', 'jpeg', 'jpg'],
        proxy:'',
        cacheDir: path.resolve(__dirname, 'map'),
        init: false
    }
```
## License
http://www.opensource.org/licenses/mit-license.php
