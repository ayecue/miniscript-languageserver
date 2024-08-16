import { EventEmitter } from "stream";
import type {
  createConnection
} from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { URI } from 'vscode-uri';

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

export interface IContext extends EventEmitter {
  readonly connection: ReturnType<typeof createConnection>;
  readonly fs: IFileSystem;

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