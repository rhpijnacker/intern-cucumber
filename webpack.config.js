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
	externals: {
		intern: 'intern',
		global: '@dojo/shim/global',
		Task: '@dojo/core/async/Task'
	},
	devtool: '#inline-source-map',
	module: {
		rules: [
			{
				test: /\.js$/,
				use: 'umd-compat-loader'
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
