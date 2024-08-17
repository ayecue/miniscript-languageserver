import type { EventEmitter } from "stream";
import type {
  createConnection
} from 'vscode-languageserver';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import type { URI } from 'vscode-uri';
import type LRU from 'lru-cache';
import type { ASTBaseBlockWithScope } from 'miniscript-core';

export type LanguageId = 'miniscript';
export const LanguageId: LanguageId = 'miniscript';
export type ConfigurationNamespace = 'miniscript';
export const ConfigurationNamespace: ConfigurationNamespace = 'miniscript';

export enum IndentationType {
  Tab = 'Tab',
  Whitespace = 'Whitespace'
}

export interface IConfiguration {
  formatter: boolean;
  autocomplete: boolean;
  hoverdocs: boolean;
  diagnostic: boolean;
  transpiler: {
    beautify: {
      keepParentheses: boolean;
      indentation: IndentationType;
      indentationSpaces: number;
    };
  };
}

export interface IActiveDocument {
  documentManager: IDocumentManager;
  content: string;
  textDocument: TextDocument;
  document: ASTBaseBlockWithScope | null;
  errors: Error[];

  getDirectory(): URI;
  getDependencies(): Promise<string[]>;
  getImports(): Promise<IActiveDocument[]>
}

export interface IDocumentManager extends EventEmitter {
  readonly results: LRU<string, IActiveDocument>
  readonly context: IContext;

  setContext(context: IContext)

  refresh(document: TextDocument): IActiveDocument;
  schedule(document: TextDocument): boolean;
  open(target: string): Promise<IActiveDocument | null>;
  get(document: TextDocument): IActiveDocument;
  getLatest(document: TextDocument, timeout?: number): Promise<IActiveDocument>;
  clear(document: TextDocument): void;
}

export interface IContext extends EventEmitter {
  readonly connection: ReturnType<typeof createConnection>;
  readonly fs: IFileSystem;
  readonly documentManager: IDocumentManager;

  features: IContextFeatures;

  getConfiguration(): IConfiguration;
  listen(): Promise<void>;
}

export interface IFileSystem extends EventEmitter {
  getWorkspaceFolderUris(): Promise<URI[]>;
  getAllTextDocuments(): TextDocument[];
  findExistingPath(...uris: string[]): string;
  fetchTextDocument(targetUri: string): Promise<TextDocument>;
  getTextDocument(targetUri: string): Promise<TextDocument>
  readFile(targetUri: string): Promise<string>;
  listen(connection: ReturnType<typeof createConnection>);
}

export interface IContextFeatures {
  configuration: boolean;
  workspaceFolder: boolean;
}