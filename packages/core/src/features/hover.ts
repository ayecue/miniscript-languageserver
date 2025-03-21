import {
  ASTFeatureImportExpression,
  ASTType as ASTTypeExtended
} from 'greybel-core';
import {
  SignatureDefinitionBaseType,
  SignatureDefinitionTypeMeta
} from 'meta-utils';
import path from 'path';
import type { Hover, HoverParams } from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { URI, Utils } from 'vscode-uri';

import { LookupASTResult, LookupHelper } from '../helper/lookup-type';
import { MarkdownString } from '../helper/markdown-string';
import { createHover, formatKind, formatTypes } from '../helper/tooltip';
import { IContext, LanguageId } from '../types';
import { DocumentURIBuilder } from '../helper/document-manager';

export function activate(context: IContext) {
  async function generateImportHover(
    textDocument: TextDocument,
    astResult: LookupASTResult
  ): Promise<Hover> {
    // shows link to import/include resource
    const hoverText = new MarkdownString('');
    const importCodeAst = astResult.closest as ASTFeatureImportExpression;
    const fileDir = importCodeAst.path;

    const documentUriBuilder = await DocumentURIBuilder.fromTextDocument(
      textDocument,
      context
    );
    const target = await documentUriBuilder.getPathWithContext(
      fileDir,
      context
    );
    const output: string[] =
      target == null
        ? ['Cannot open file.']
        : [
          `[Inserts file "${path.basename(
            target
          )}" inside this code when building](${target.toString()})`,
          '***',
          'Click the link above to open the file.'
        ];

    hoverText.appendMarkdown(output.join('\n'));

    return {
      contents: hoverText.toString()
    };
  }

  context.connection.onHover(async (params: HoverParams): Promise<Hover> => {
    if (!context.getConfiguration().hoverdocs) {
      return;
    }

    const document = await context.fs.getTextDocument(params.textDocument.uri);

    if (document == null) {
      return;
    }

    const helper = new LookupHelper(document, context);
    const astResult = await helper.lookupAST(params.position);

    if (!astResult) {
      return;
    }

    if (
      astResult.closest.type === ASTTypeExtended.FeatureImportExpression ||
      astResult.closest.type === ASTTypeExtended.FeatureIncludeExpression
    ) {
      return await generateImportHover(document, astResult);
    }

    const entity = await helper.lookupTypeInfo(astResult);

    if (!entity) {
      return;
    }

    if (entity.isCallable()) {
      return createHover(entity);
    }

    const hoverText = new MarkdownString('');
    const metaTypes = entity.toMeta().map(SignatureDefinitionTypeMeta.parse);
    let label = `(${formatKind(entity.kind)}) ${entity.label}: ${formatTypes(metaTypes)}`;

    if (entity.types.has(SignatureDefinitionBaseType.Map)) {
      const records: Record<string, string> = {};

      for (const [key, item] of entity.values) {
        const metaTypes = item.toMeta().map(SignatureDefinitionTypeMeta.parse);
        records[key.slice(2)] = formatTypes(metaTypes);
      }

      label += ' ' + JSON.stringify(records, null, 2);
    }

    hoverText.appendCodeblock(LanguageId, label);

    return {
      contents: hoverText.toString()
    };
  });
}
