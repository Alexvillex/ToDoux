const createExpoWebpackConfigAsync = require('@expo/webpack-config');

module.exports = async function (env, argv) {
    const config = await createExpoWebpackConfigAsync(
        { ...env, publicPath: '/ToDoux/' },
        argv
    );

    // Double sécurité : force directement la propriété webpack
    config.output.publicPath = '/ToDoux/';

    return config;
};
