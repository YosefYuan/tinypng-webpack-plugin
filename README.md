# tinypng-webpack-plugin

a img compress plugin use with tinyPNG for webpack.

## Get TinyPNG key

[For Developer](https://tinypng.com/developers)

## Installation
```shell
yarn add tinypng-webpack-plugin@https://gitlab.jiliguala.com/npm/tinypng-webpack-plugin.git

or

npm install git+https://gitlab.jiliguala.com/npm/tinypng-webpack-plugin.git --save-dev
```

## Example Webpack Config

```javascript
var tinyPngWebpackPlugin = require('tinypng-webpack-plugin');

    //in your webpack plugins array
    module.exports = {
      plugins: [
          new tinyPngWebpackPlugin({
              key:"your tinyPNG key",
              cacheDir: path.resolve(__dirname, 'src/assets/cache'),
              root: path.resolve(__dirname, 'src')
          })
      ]
    }
```

## Usage
```javascript
new tinyPngWebpackPlugin({
    key:"your tinyPNG key", //string, 'your key',
    ext: ['png', 'jpeg', 'jpg'],//img ext name
    proxy:'http://user:pass@192.168.0.1:8080',// If you are from China and can use the shadowsocks(vpn), the default proxy will be 'http:127.0.0.1:1080'.
    cacheDir: path.resolve(__dirname, 'src/assets/cache'),
    init: false
})
```
### Options Description
* key: Required, tinyPNG key.
* cacheDir: Required, the plugin will create a json file to include all the compressed img file.
* root: Required, the folder's path including all the source img.
* init: not Required  
At first, this options should be set <font color=red>true</font> if you think all the imgs at present are with no need to compress. Just run the 'yarn serve'(or other command) to init all the imgs' cache.
Then, this options should be <font color=red>deleted</font> or set <font color=red>false</font>.
* ext: not Required, img's ext to be compress.
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
