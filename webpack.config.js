const path = require('path');
const webpack = require('webpack');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');

let config = {
  entry: {
    plugin: './src/plugin.js'
  },
  output: {
    filename: '[name].js',
    path: path.join(__dirname, '_tmp/browser')
  },
  devtool: 'source-map',
  module: {
    rules: [
      {
        test: /\.js$/,
        include: /node_modules/,
        use: 'umd-compat-loader'
      }
    ]
  },
  plugins: [
    new CleanWebpackPlugin({
      cleanOnceBeforeBuildPatterns: [
        path.resolve('_build'),
        path.resolve('_tmp')
      ]
    }),
    new CopyWebpackPlugin([
      { from: path.resolve('LICENSE'), to: path.resolve('_build/') },
      { from: path.resolve('package.json'), to: path.resolve('_build/') },
      { from: path.resolve('README.md'), to: path.resolve('_build/') },
      {
        from: path.resolve('src/interface/cucumber.js'),
        to: path.resolve('_build/interface/')
      },
      { from: path.resolve('src/plugin.js'), to: path.resolve('_build/') },
      { from: path.resolve('src/plugin.d.ts'), to: path.resolve('_build/') }
    ])
  ],
  stats: {
    assets: false,
    entrypoints: true,
    errors: true,
    hash: false,
    modules: false,
    version: false,
    warnings: false
  },
  resolve: {
    alias: {
      cucumber: 'cucumber/dist/cucumber'
    },
    extensions: ['.ts', '.js']
  }
};
module.exports = config;
