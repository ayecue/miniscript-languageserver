import EventEmitter from 'events';
import { ASTChunkAdvanced, Parser } from 'greybel-core';
import LRU from 'lru-cache';
import { ASTBaseBlockWithScope } from 'miniscript-core';
import { schedule } from 'non-blocking-schedule';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { URI, Utils } from 'vscode-uri';

import { IActiveDocument, IContext, IDocumentManager } from '../types';
import typeManager from './type-manager';

export interface ActiveDocumentOptions {
  documentManager: DocumentManager;
  content: string;
  textDocument: TextDocument;
  document: ASTBaseBlockWithScope | null;
  errors: Error[];
}

export class DocumentURIBuilder {
  readonly workspaceFolderUri: URI | null;
  readonly rootPath: URI;

  constructor(rootPath: URI, workspaceFolderUri: URI = null) {
    this.workspaceFolderUri = workspaceFolderUri;
    this.rootPath = rootPath;
  }

  getFromWorkspaceFolder(path: string): string {
    if (this.workspaceFolderUri == null) {
      throw new Error('Workspace folder is not defined!');
    }

    return Utils.joinPath(this.workspaceFolderUri, path).toString();
  }

  getFromRootPath(path: string): string {
    return Utils.joinPath(this.rootPath, path).toString();
  }
}

export class ActiveDocument implements IActiveDocument {
  documentManager: DocumentManager;
  content: string;
  textDocument: TextDocument;
  document: ASTBaseBlockWithScope | null;
  errors: Error[];

  private dependencies?: string[];

  constructor(options: ActiveDocumentOptions) {
    this.documentManager = options.documentManager;
    this.content = options.content;
    this.textDocument = options.textDocument;
    this.document = options.document;
    this.errors = options.errors;
  }

  getDirectory(): URI {
    return Utils.joinPath(URI.parse(this.textDocument.uri), '..');
  }

  private getImportsAndIncludes(workspaceFolderUri: URI = null): string[] {
    if (this.document == null) {
      return [];
    }

    const rootChunk = this.document as ASTChunkAdvanced;
    const rootPath = this.getDirectory();
    const context = this.documentManager.context;
    const builder = new DocumentURIBuilder(rootPath, workspaceFolderUri);
    const getPath = (path: string) => {
      if (path.startsWith('/')) {
        return context.fs.findExistingPath(
          builder.getFromWorkspaceFolder(path),
          builder.getFromWorkspaceFolder(`${path}.src`)
        );
      }
      return context.fs.findExistingPath(
        builder.getFromRootPath(path),
        builder.getFromRootPath(`${path}.src`)
      );
    };

    return [
      ...rootChunk.imports
        .filter((nonNativeImport) => nonNativeImport.path)
        .map((nonNativeImport) => getPath(nonNativeImport.path)),
      ...rootChunk.includes
        .filter((includeImport) => includeImport.path)
        .map((includeImport) => getPath(includeImport.path))
    ];
  }

  async getDependencies(): Promise<string[]> {
    if (this.document == null) {
      return [];
    }

    if (this.dependencies) {
      return this.dependencies;
    }

    const workspacePaths =
      await this.documentManager.context.fs.getWorkspaceFolderUris();
    const importsAndIncludes = this.getImportsAndIncludes(workspacePaths[0]);
    const dependencies: Set<string> = new Set([...importsAndIncludes]);

    this.dependencies = Array.from(dependencies);

    return this.dependencies;
  }

  async getImports(): Promise<ActiveDocument[]> {
    if (this.document == null) {
      return [];
    }

    const imports: Set<ActiveDocument> = new Set();
    const visited: Set<string> = new Set([this.textDocument.uri]);
    const traverse = async (rootResult: ActiveDocument) => {
      const dependencies = await rootResult.getDependencies();

      for (const dependency of dependencies) {
        if (visited.has(dependency)) continue;

        const item = await this.documentManager.open(dependency);

        visited.add(dependency);

        if (item === null) continue;

        imports.add(item);

        if (item.document !== null) {
          await traverse(item);
        }
      }
    };

    await traverse(this);

    return Array.from(imports);
  }
}

export interface ScheduledItem {
  document: TextDocument;
  createdAt: number;
}

export const PROCESSING_TIMEOUT = 100;

export class DocumentManager extends EventEmitter implements IDocumentManager {
  readonly results: LRU<string, ActiveDocument>;

  private _context: IContext | null;
  private scheduledItems: Map<string, ScheduledItem>;
  private tickRef: () => void;
  private readonly processingTimeout: number;

  get context() {
    return this._context;
  }

  setContext(context: IContext) {
    this._context = context;
    return this;
  }

  constructor(processingTimeout: number = PROCESSING_TIMEOUT) {
    super();
    this._context = null;
    this.results = new LRU({
      ttl: 1000 * 60 * 20,
      ttlAutopurge: true
    });
    this.scheduledItems = new Map();
    this.tickRef = this.tick.bind(this);
    this.processingTimeout = processingTimeout;

    schedule(this.tickRef);
  }

  private tick() {
    const currentTime = Date.now();
    const items = Array.from(this.scheduledItems.values());

    for (let index = 0; index < items.length; index++) {
      const item = items[index];
      if (currentTime - item.createdAt > this.processingTimeout) {
        schedule(() => this.refresh(item.document));
      }
    }

    schedule(this.tickRef);
  }

  refresh(document: TextDocument): ActiveDocument {
    const key = document.uri;

    if (!this.scheduledItems.has(key) && this.results.has(key)) {
      return this.results.get(key)!;
    }

    const result = this.create(document);
    this.results.set(key, result);
    this.emit('parsed', document, result);
    this.scheduledItems.delete(key);

    return result;
  }

  private create(document: TextDocument): ActiveDocument {
    const content = document.getText();
    const parser = new Parser(content, {
      unsafe: true
    });
    const chunk = parser.parseChunk() as ASTChunkAdvanced;

    if (chunk.body?.length > 0) {
      typeManager.analyze(document.uri, chunk);

      return new ActiveDocument({
        documentManager: this,
        content,
        textDocument: document,
        document: chunk,
        errors: [...parser.lexer.errors, ...parser.errors]
      });
    }

    try {
      const strictParser = new Parser(document.getText());
      const strictChunk = strictParser.parseChunk() as ASTChunkAdvanced;

      typeManager.analyze(document.uri, strictChunk);

      return new ActiveDocument({
        documentManager: this,
        content,
        textDocument: document,
        document: strictChunk,
        errors: []
      });
    } catch (err: any) {
      return new ActiveDocument({
        documentManager: this,
        content,
        textDocument: document,
        document: null,
        errors: [err]
      });
    }
  }

  schedule(document: TextDocument): boolean {
    const fileUri = document.uri;
    const content = document.getText();

    if (this.results.get(fileUri)?.content === content) {
      return false;
    }

    this.scheduledItems.set(fileUri, {
      document,
      createdAt: Date.now()
    });

    return true;
  }

  async open(target: string): Promise<ActiveDocument | null> {
    try {
      const textDocument = await this.context.fs.getTextDocument(target);
      return this.get(textDocument);
    } catch (err) {
      return null;
    }
  }

  get(document: TextDocument): ActiveDocument {
    return this.results.get(document.uri) || this.refresh(document);
  }

  getLatest(
    document: TextDocument,
    timeout: number = 5000
  ): Promise<ActiveDocument> {
    return new Promise((resolve) => {
      schedule(() => {
        if (!this.scheduledItems.has(document.uri))
          return resolve(this.get(document));

        const onTimeout = () => {
          this.removeListener('parsed', onParse);
          resolve(this.get(document));
        };
        const onParse = (evDocument: TextDocument) => {
          if (evDocument.uri === document.uri) {
            this.removeListener('parsed', onParse);
            clearTimeout(timer);
            resolve(this.get(document));
          }
        };
        const timer = setTimeout(onTimeout, timeout);

        this.addListener('parsed', onParse);
      });
    });
  }

  clear(document: TextDocument): void {
    this.results.delete(document.uri);
    this.emit('cleared', document);
  }
}
