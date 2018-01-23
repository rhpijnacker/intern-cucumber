const path = require('path');
const webpack = require('webpack');
var CleanWebpackPlugin = require('clean-webpack-plugin');
var CopyWebpackPlugin = require('copy-webpack-plugin');

let config = {
	entry: {
		plugin: './src/plugin.js'
	},
	output: {
		filename: '[name].js',
		path: path.join(__dirname, '_build/browser')
	},
	devtool: 'source-map',
	module: {
		rules: [
			{
				test: /\.js$/,
				include: /node_modules/,
				use: 'umd-compat-loader'
			},
			{
				test: /\.js$/,
				exclude: /node_modules/,
				use: {
					loader: 'babel-loader',
					options: {
						presets: ['babel-preset-env']
					}
				}
			}
		]
	},
	plugins: [
 		new CleanWebpackPlugin(['_build']),
		new CopyWebpackPlugin([
			{ from: path.resolve('LICENSE'), to: path.resolve('_build/') },
			{ from: path.resolve('package.json'), to: path.resolve('_build/') },
			{ from: path.resolve('README.md'), to: path.resolve('_build/') },
			{ from: path.resolve('src/interface/cucumber.js'), to: path.resolve('_build/interface/') },
			{ from: path.resolve('src/plugin.js'), to: path.resolve('_build/') }
		])
  	],
	stats: {
		assets: false,
		entrypoints: true,
		errors: true,
		hash: false,
		modules: false,
		version: false,
		warnings: true
	},
	resolve: {
		alias: {
			cucumber: 'cucumber/dist/cucumber'
		},
		extensions: ['.ts', '.js']
	}
};
if (
	process.env['NODE_ENV'] === 'production' ||
	process.env['INTERN_BUILD'] === 'release'
) {
	config.plugins = [new webpack.optimize.UglifyJsPlugin()];
}
module.exports = config;
