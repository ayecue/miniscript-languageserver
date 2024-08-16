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
        format: 'cjs',
        treeShaking: true,
        external: [
          'vscode-languageserver/browser'
        ]
      });
  } catch (err) {
    console.error('Failed building project', { err });
    process.exit(1);
  }
};

build();
