# miniscript-languageserver

Language server for MiniScript. Provides several features such as auto-completion, hover tooltips and more.

Should work with any other client which is following [LSP standards](https://code.visualstudio.com/api/language-extensions/language-server-extension-guide). Feel free to take a look at a full [implementation](https://github.com/ayecue/miniscript-vs) into VSCode.

## Supported providers

It supports the following providers:
- completion
- hover
- color
- definition
- formatter
- signature help
- document symbol
- workspace symbol
- diagnostic

## Install

```bash
npm install -g miniscript-languageserver
```

## Usage
```bash
miniscript-languageserver
```

## Example implementations

#### VSCode implementation
```ts
import * as path from 'path';
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind
} from 'vscode-languageclient/node';

const serverModule = context.asAbsolutePath(
  path.join('node_modules', 'miniscript-languageserver', 'index.js')
);

const serverOptions: ServerOptions = {
  run: { module: serverModule, transport: TransportKind.ipc }
};

const clientOptions: LanguageClientOptions = {
  documentSelector: [{ scheme: 'file', language: 'miniscript' }],
  synchronize: {
    fileEvents: workspace.createFileSystemWatcher('**/*')
  },
  diagnosticCollectionName: 'miniscript'
};

const client = new LanguageClient(
  'languageServerExample',
  'Language Server Example',
  serverOptions,
  clientOptions
);

client.registerProposedFeatures();
client.start();
```

#### Sublime implementation
Install [LSP Package](https://lsp.sublimetext.io/) and create the following configuration:
```json
{
  "show_diagnostics_panel_on_save": 0,
  "clients": {
    "miniscript": {
      "enabled": true,
      "command": ["miniscript-languageserver", "--stdio"],
      "selector": "source.miniscript"
    }
  }
}
```

Example sublime syntax file (for testing)
```yaml
%YAML 1.2
---
name: miniscript
file_extensions:
  - src
scope: source.miniscript

contexts:
  main:
    - match: '.+'
      scope: text.miniscript
```

## How to add tooltips

You can add your own meta descriptions in [this repository](https://github.com/ayecue/miniscript-meta). The workflow for this is as follows:
- create a PR with your changes in the [meta repository](https://github.com/ayecue/miniscript-meta)
- create a PR with the raised version to this repository

Additionally, there is the option to define methods via comments in the code.

```js
// @type Bar
// @property {string} virtualMoo
Bar = {}
Bar.moo = ""

// Hello world
// I am **bold**
// @description Alternative description
// @example test("title", 123)
// @param {string} title - The title of the book.
// @param {string|number} author - The author of the book.
// @return {Bar} - Some info about return
Bar.test = function(test, abc)
  print "test"
  return self
end function

// @type Foo
Foo = new Bar
// @return {Foo}
Foo.New = function(message)
  result = new Foo
  return result
end function

myVar = Foo.New

myVar.test // shows defined signature of Bar.test on hover
myVar.virtualMoo // shows virtual property of type string on hover
```