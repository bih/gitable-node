const path = require('path');
const nodeExternals = require('webpack-node-externals');

module.exports = {
  entry: './lib/application.js',
  mode: 'production',
  target: 'node',
  output: {
    path: path.join(__dirname, 'dist'),
    filename: 'application.js',
    libraryTarget: 'commonjs',
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        use: 'babel-loader',
      },
    ],
  },
  node: {
    fs: 'empty',
  },
  externals: [nodeExternals()],
  resolve: {
    modules: ['node_modules'],
  },
};
