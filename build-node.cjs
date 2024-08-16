const esbuild = require('esbuild');

const build = async () => {
  try {
    await esbuild
      .build({
        entryPoints: ['./dist/node.js'],
        bundle: true,
        outfile: 'node.js',
        globalName: 'miniscriptLanguageserver',
        sourcemap: false,
        minify: true,
        minifyWhitespace: true,
        minifyIdentifiers: true,
        minifySyntax: true,
        target: 'ESNext',
        platform: 'node',
        treeShaking: true
      });
  } catch (err) {
    console.error('Failed building project', { err });
    process.exit(1);
  }
};

build();
