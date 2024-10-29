import { createConnection, ProposedFeatures } from 'vscode-languageserver/node';

import { CoreContext, DocumentManager, IContext } from '../../packages/core/src';
import { FileSystem } from './fs';
import { DocumentMerger } from '../../packages/core/src/helper/document-merger';

export class NodeContext extends CoreContext {
  readonly connection: ReturnType<typeof createConnection>;
  readonly fs: FileSystem;
  readonly documentManager: DocumentManager;
  readonly documentMerger: DocumentMerger;

  constructor() {
    super();

    this.documentManager = new DocumentManager().setContext(this as unknown as IContext);
    this.documentMerger = new DocumentMerger();
    this.connection = createConnection(ProposedFeatures.all);
    this.fs = new FileSystem(this as unknown as IContext);
  }
}