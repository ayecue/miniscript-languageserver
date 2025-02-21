import EventEmitter from 'events';
import { ASTChunkGreybel, Parser } from 'greybel-core';
import LRU from 'lru-cache';
import { ASTBaseBlockWithScope, ASTChunkOptions, ASTIdentifier } from 'miniscript-core';
import { schedule } from 'non-blocking-schedule';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { URI, Utils } from 'vscode-uri';

import {
  DependencyRawLocation,
  DependencyType,
  IActiveDocument,
  IActiveDocumentImport,
  IContext,
  IDependencyLocation,
  IDocumentManager,
  parseDependencyLocation,
  parseDependencyRawLocation
} from '../types';
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

  static async fromTextDocument(
    textDocument: TextDocument,
    context: IContext
  ): Promise<DocumentURIBuilder> {
    const textDocumentUri = URI.parse(textDocument.uri);
    const workspaceFolderUri =
      await context.fs.getWorkspaceFolderUri(textDocumentUri);

    return new DocumentURIBuilder(
      Utils.joinPath(textDocumentUri, '..'),
      workspaceFolderUri
    );
  }

  constructor(rootPath: URI, workspaceFolderUri: URI = null) {
    this.workspaceFolderUri = workspaceFolderUri;
    this.rootPath = rootPath;
  }

  private getFromWorkspaceFolder(path: string): string {
    if (this.workspaceFolderUri == null) {
      console.warn(
        'Workspace folders are not available. Falling back to only relative paths.'
      );
      return Utils.joinPath(this.rootPath, path).toString();
    }

    return Utils.joinPath(this.workspaceFolderUri, path).toString();
  }

  private getFromRootPath(path: string): string {
    return Utils.joinPath(this.rootPath, path).toString();
  }

  private getAlternativePathsWithContext(
    path: string,
    context: IContext
  ): string[] {
    if (path.startsWith('/')) {
      return context.getConfiguration().fileExtensions.map((ext) => {
        return this.getFromWorkspaceFolder(`${path}.${ext}`);
      });
    }
    return context.getConfiguration().fileExtensions.map((ext) => {
      return this.getFromRootPath(`${path}.${ext}`);
    });
  }

  private getOriginalPath(path: string): string {
    if (path.startsWith('/')) {
      return this.getFromWorkspaceFolder(path);
    }
    return this.getFromRootPath(path);
  }

  async getPathWithContext(
    path: string,
    context: IContext
  ): Promise<string | null> {
    return context.fs.findExistingPath(
      this.getOriginalPath(path),
      ...this.getAlternativePathsWithContext(path, context)
    );
  }
}

export class ActiveDocument implements IActiveDocument {
  documentManager: DocumentManager;
  content: string;
  textDocument: TextDocument;
  document: ASTBaseBlockWithScope | null;
  errors: Error[];

  private dependencies?: IDependencyLocation[];

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

  async getImportUris(
    workspaceFolderUri: URI = null
  ): Promise<DependencyRawLocation[]> {
    if (this.document == null) {
      return [];
    }

    const rootChunk = this.document as ASTChunkGreybel;
    const rootPath = this.getDirectory();
    const context = this.documentManager.context;
    const builder = new DocumentURIBuilder(rootPath, workspaceFolderUri);

    const paths = await Promise.all([
      ...rootChunk.imports
        .filter((nonNativeImport) => nonNativeImport.path)
        .map(async (nonNativeImport) => {
          const path = await builder.getPathWithContext(
            nonNativeImport.path,
            context
          );

          if (path == null) {
            return null;
          }

          return parseDependencyLocation({
            type: DependencyType.Import,
            location: path,
            args: [(nonNativeImport.name as ASTIdentifier)?.name]
          });
        })
    ]);

    return paths.filter((path) => path != null);
  }

  async getIncludeUris(
    workspaceFolderUri: URI = null
  ): Promise<DependencyRawLocation[]> {
    if (this.document == null) {
      return [];
    }

    const rootChunk = this.document as ASTChunkGreybel;
    const rootPath = this.getDirectory();
    const context = this.documentManager.context;
    const builder = new DocumentURIBuilder(rootPath, workspaceFolderUri);

    const paths = await Promise.all([
      ...rootChunk.includes
        .filter((includeImport) => includeImport.path)
        .map(async (includeImport) => {
          const path = await builder.getPathWithContext(
            includeImport.path,
            context
          );

          if (path == null) {
            return null;
          }

          return parseDependencyLocation({
            type: DependencyType.Include,
            location: path
          });
        })
    ]);

    return paths.filter((path) => path != null);
  }

  async getDependencies(): Promise<IDependencyLocation[]> {
    if (this.document == null) {
      return [];
    }

    if (this.dependencies) {
      return this.dependencies;
    }

    const workspacePathUri =
      await this.documentManager.context.fs.getWorkspaceFolderUri(
        URI.parse(this.textDocument.uri)
      );
    const [imports, includes] = await Promise.all([
      this.getImportUris(workspacePathUri),
      this.getIncludeUris(workspacePathUri)
    ]);
    const dependencies: Set<string> = new Set([
      ...imports,
      ...includes
    ]);

    this.dependencies = Array.from(dependencies).map(
      parseDependencyRawLocation
    );

    return this.dependencies;
  }

  async getImports(nested: boolean = true): Promise<IActiveDocumentImport[]> {
    if (this.document == null) {
      return [];
    }

    const imports: Set<IActiveDocumentImport> = new Set();
    const visited: Set<string> = new Set([this.textDocument.uri]);
    const traverse = async (rootResult: ActiveDocument) => {
      const dependencies = await rootResult.getDependencies();

      for (const dependency of dependencies) {
        if (visited.has(dependency.location)) continue;

        const item = await this.documentManager.open(dependency.location);

        visited.add(dependency.location);

        if (item === null) continue;

        imports.add({
          document: item,
          location: dependency
        });

        if (item.document !== null && nested) {
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

  private _timer: NodeJS.Timeout;
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
    this._timer = null;
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
    if (this.scheduledItems.size === 0) {
      this._timer = null;
      return;
    }

    const currentTime = Date.now();
    const items = Array.from(this.scheduledItems.values());

    for (let index = 0; index < items.length; index++) {
      const item = items[index];
      if (currentTime - item.createdAt > this.processingTimeout) {
        schedule(() => this.refresh(item.document));
      }
    }

    this._timer = setTimeout(this.tickRef, 0);
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
    const chunk = parser.parseChunk() as ASTChunkGreybel;

    this._context.documentMerger.flushCacheKey(document.uri);
    typeManager.analyze(document.uri, chunk);

    return new ActiveDocument({
      documentManager: this,
      content,
      textDocument: document,
      document: chunk,
      errors: [...parser.lexer.errors, ...parser.errors]
    });
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

    if (this._timer === null) {
      this._timer = setTimeout(this.tickRef, 0);
    }

    return true;
  }

  async open(target: string): Promise<ActiveDocument | null> {
    try {
      const textDocument = await this.context.fs.getTextDocument(target);

      if (textDocument == null) {
        return null;
      }

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
