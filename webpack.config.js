const createExpoWebpackConfigAsync = require('@expo/webpack-config');

module.exports = async function (env, argv) {
    const config = await createExpoWebpackConfigAsync(env, argv);

    // Force le chemin de base pour GitHub Pages (/ToDoux/)
    config.output.publicPath = '/ToDoux/';

    return config;
};
