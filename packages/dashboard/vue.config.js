const webpack = require('webpack');
const childProcess = require('child_process');
const fs = require('fs');
const __versionString__ = process.env.CI_COMMIT_SHORT_SHA || childProcess.execSync('git rev-parse --short HEAD').toString();
const package = require('./package.json');

module.exports = {
  lintOnSave: true,
  publicPath: '',
  configureWebpack: {
    resolve: {
      symlinks: false,
      alias: {
        '@': 'src/'
      }
    },
    plugins: [new webpack.DefinePlugin({
      'process.env': {
        VUE_APP_VERSION_SHA: JSON.stringify(__versionString__),
        VUE_APP_VERSION_TIME: JSON.stringify((new Date()).toUTCString()),
        VUE_APP_PACKAGE_VERSION: JSON.stringify(package.version),
      }
    })],
    module: {
      rules: [
        {
          test: /\.s(c|a)ss$/,
          use: [
            'vue-style-loader',
            'css-loader',
            {
              loader: 'sass-loader',
              options: {
                implementation: require('sass'),
                fiber: require('fibers'),
                indentedSyntax: true // optional
              }
            }
          ]
        },
        {
          test: /\.html$/,
          loader: 'raw-loader',
          exclude: ['/public/index.html']
        }
      ]
    }
  }
};
