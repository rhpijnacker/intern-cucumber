const path = require('path');
const webpack = require('webpack');

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
