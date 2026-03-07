# miniscript-languageserver

[![miniscript-languageserver](https://circleci.com/gh/ayecue/miniscript-languageserver.svg?style=svg)](https://circleci.com/gh/ayecue/miniscript-languageserver)

A [Language Server Protocol](https://microsoft.github.io/language-server-protocol/) implementation for [MiniScript](https://miniscript.org) written in TypeScript. It provides IDE features such as autocompletion, hover documentation, go-to-definition, diagnostics, and more. For GreyScript-specific support, see [greybel-languageserver](../greybel-lsp).

## Features

* Autocompletion with type-aware suggestions
* Hover documentation for functions and variables
* Go-to-definition and symbol lookup
* Diagnostics (syntax errors and type warnings)
* Signature help for function calls
* Document and workspace symbol search
* Semantic token highlighting
* Code formatting via the built-in transpiler (beautify)
* Color picker support
* Folding ranges
* Configurable type analyzer strategy (dependency-based or workspace-wide)

## Packages

| Package | Description |
|---------|-------------|
| [core](packages/core) | Shared LSP feature implementations |
| [node](packages/node) | Node.js language server binary |
| [browser](packages/browser) | Browser-compatible language server |

## Install

```bash
npm install -g miniscript-languageserver
```

## Usage

After installing globally the server can be started from the command line:

```bash
miniscript-languageserver --stdio
```

Point your editor's LSP client at this command to enable MiniScript support. For detailed configuration options, see the [node package README](packages/node/README.md).

## Testing

```bash
npm test
```