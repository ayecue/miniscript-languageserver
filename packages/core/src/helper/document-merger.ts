import LRU from 'lru-cache';
import { Document as TypeDocument } from 'miniscript-type-analyzer';
import toposort from 'toposort';
import { TextDocument } from 'vscode-languageserver-textdocument';

import {
  IActiveDocument,
  IContext,
  IDocumentMerger,
  TypeAnalyzerStrategy
} from '../types';
import { hash } from './hash';
import typeManager from './type-manager';

export class DocumentMerger implements IDocumentMerger {
  readonly results: LRU<number, TypeDocument>;
  private keyToDocumentUriMap: Map<string, number>;

  constructor() {
    this.keyToDocumentUriMap = new Map();
    this.results = new LRU({
      ttl: 1000 * 60 * 20,
      ttlAutopurge: true
    });
  }

  private createCacheKey(
    source: TextDocument,
    documents: IActiveDocument[]
  ): number {
    let result = hash(`main-${source.uri}-${source.version}`);

    for (let index = 0; index < documents.length; index++) {
      const document = documents[index];
      result ^= hash(
        `${document.textDocument.uri}-${document.textDocument.version}`
      );
      result = result >>> 0;
    }

    return result;
  }

  private registerCacheKey(key: number, documentUri: string) {
    this.flushCacheKey(documentUri);
    this.keyToDocumentUriMap.set(documentUri, key);
  }

  flushCacheKey(documentUri: string) {
    const key = this.keyToDocumentUriMap.get(documentUri);
    if (key) {
      this.results.delete(key);
      this.keyToDocumentUriMap.delete(documentUri);
    }
  }

  flushCache() {
    this.results.clear();
  }

  private async processByDependencies(
    document: TextDocument,
    context: IContext,
    refs: Map<string, TypeDocument | null>
  ): Promise<TypeDocument> {
    const documentUri = document.uri;

    if (refs.has(documentUri)) {
      return refs.get(documentUri);
    }

    const typeDoc = typeManager.get(documentUri);

    refs.set(documentUri, null);

    if (!typeDoc) {
      return null;
    }

    const externalTypeDocs: TypeDocument[] = [];
    const allImports = await context.documentManager.get(document).getImports();
    const cacheKey = this.createCacheKey(document, allImports);

    if (this.results.has(cacheKey)) {
      return this.results.get(cacheKey);
    }

    this.registerCacheKey(cacheKey, documentUri);

    const importUris = await context.documentManager
      .get(document)
      .getDependencies();

    await Promise.all(
      importUris.map(async (itemUri) => {
        const item = context.documentManager.results.get(itemUri);

        if (!item) {
          return;
        }

        const { document, textDocument } = item;

        if (!document) {
          return;
        }

        const itemTypeDoc = await this.processByDependencies(
          textDocument,
          context,
          refs
        );

        if (itemTypeDoc === null) return;
        externalTypeDocs.push(itemTypeDoc);
      })
    );

    const mergedTypeDoc = typeDoc.merge(...externalTypeDocs);
    refs.set(documentUri, mergedTypeDoc);
    this.results.set(cacheKey, mergedTypeDoc);
    return mergedTypeDoc;
  }

  private async buildByDependencies(
    document: TextDocument,
    context: IContext
  ): Promise<TypeDocument> {
    const documentUri = document.uri;
    const typeDoc = typeManager.get(documentUri);

    if (!typeDoc) {
      return null;
    }

    const externalTypeDocs: TypeDocument[] = [];
    const allImports = await context.documentManager.get(document).getImports();
    const cacheKey = this.createCacheKey(document, allImports);

    if (this.results.has(cacheKey)) {
      return this.results.get(cacheKey);
    }

    this.registerCacheKey(cacheKey, documentUri);

    const importUris = await context.documentManager
      .get(document)
      .getDependencies();
    const refs: Map<string, TypeDocument | null> = new Map([
      [documentUri, null]
    ]);

    await Promise.all(
      importUris.map(async (itemUri) => {
        const item = context.documentManager.results.get(itemUri);

        if (!item) {
          return;
        }

        const { document, textDocument } = item;

        if (!document) {
          return;
        }

        const itemTypeDoc = await this.processByDependencies(
          textDocument,
          context,
          refs
        );

        if (itemTypeDoc === null) return;
        externalTypeDocs.push(itemTypeDoc);
      })
    );

    const mergedTypeDoc = typeDoc.merge(...externalTypeDocs);
    this.results.set(cacheKey, mergedTypeDoc);
    return mergedTypeDoc;
  }

  private async buildByWorkspace(
    document: TextDocument,
    context: IContext
  ): Promise<TypeDocument> {
    const documentUri = document.uri;
    const typeDoc = typeManager.get(documentUri);

    if (!typeDoc) {
      return null;
    }

    const externalTypeDocs: TypeDocument[] = [];
    const config = context.getConfiguration();
    const allFileUris = await context.fs.getWorkspaceFileUris(
      `**/*.{${config.fileExtensions.join(',')}}`,
      config.typeAnalyzer.exclude
    );
    const allDocuments = await Promise.all(
      allFileUris.map(async (uri) => {
        const textDocument = await context.documentManager.open(uri.toString());
        return textDocument;
      })
    );
    const cacheKey = this.createCacheKey(document, allDocuments);

    if (this.results.has(cacheKey)) {
      return this.results.get(cacheKey);
    }

    this.registerCacheKey(cacheKey, documentUri);

    // sort by it's usage
    const documentGraph: [string, string][][] = await Promise.all(
      allDocuments.map(async (item) => {
        const depUris = await item.getDependencies();

        return depUris.map((depUri) => {
          return [item.textDocument.uri, depUri];
        });
      })
    );
    const topoSorted = toposort(documentGraph.flat());

    for (let index = topoSorted.length - 1; index >= 0; index--) {
      const itemUri = topoSorted[index];
      if (itemUri === documentUri) continue;
      const itemTypeDoc = typeManager.get(itemUri);

      if (itemTypeDoc === null) return;
      externalTypeDocs.push(itemTypeDoc);
    }

    const mergedTypeDoc = typeDoc.merge(...externalTypeDocs);
    this.results.set(cacheKey, mergedTypeDoc);
    return mergedTypeDoc;
  }

  async build(
    document: TextDocument,
    context: IContext
  ): Promise<TypeDocument> {
    if (
      context.getConfiguration().typeAnalyzer.strategy ===
      TypeAnalyzerStrategy.Workspace
    ) {
      return this.buildByWorkspace(document, context);
    }
    return this.buildByDependencies(document, context);
  }
}
