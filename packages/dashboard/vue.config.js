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
    module: {
      rules: [
        {
          test: /\.html$/,
          loader: 'raw-loader',
          exclude: ['/public/index.html']
        }
      ]
    }
  }
};
