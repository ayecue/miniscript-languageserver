import { createConnection, ProposedFeatures } from 'vscode-languageserver/node';

import { CoreContext, DocumentManager } from 'miniscript-languageserver-core';
import { FileSystem } from './fs';
import { DocumentMerger } from 'miniscript-languageserver-core/dist/helper/document-merger';

export class NodeContext extends CoreContext {
  readonly connection: ReturnType<typeof createConnection>;
  readonly fs: FileSystem;
  readonly documentManager: DocumentManager;
  readonly documentMerger: DocumentMerger;

  constructor() {
    super();

    this.documentManager = new DocumentManager().setContext(this);
    this.documentMerger = new DocumentMerger();
    this.connection = createConnection(ProposedFeatures.all);
    this.fs = new FileSystem(this);
  }
}
