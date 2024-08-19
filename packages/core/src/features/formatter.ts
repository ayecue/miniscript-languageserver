import { BuildType, DirectTranspiler } from 'greybel-transpiler';
import type { DocumentFormattingParams, Range } from 'vscode-languageserver';

import { IConfiguration, IContext } from '../types';

export function activate(context: IContext) {
  async function tryFormat(content: string): Promise<string | null> {
    try {
      const config: IConfiguration = context.getConfiguration();

      return new DirectTranspiler({
        code: content,
        buildType: BuildType.BEAUTIFY,
        buildOptions: {
          isDevMode: true,
          keepParentheses: config.transpiler.beautify.keepParentheses,
          indentation: config.transpiler.beautify.indentation === 'Tab' ? 0 : 1,
          indentationSpaces: config.transpiler.beautify.indentationSpaces
        }
      }).parse();
    } catch (err) {
      return null;
    }
  }

  context.connection.onDocumentFormatting(
    async (params: DocumentFormattingParams) => {
      if (!context.getConfiguration().formatter) {
        return;
      }

      const document = await context.fs.getTextDocument(
        params.textDocument.uri
      );

      if (document == null) {
        return;
      }

      const activeDocument = await context.documentManager.getLatest(document);
      const result = await tryFormat(document.getText());

      if (result === null) {
        return [];
      }

      const textRange: Range = {
        start: { line: 0, character: 0 },
        end: activeDocument.document.end
      };

      return [
        {
          range: textRange,
          newText: result
        }
      ];
    }
  );
}
