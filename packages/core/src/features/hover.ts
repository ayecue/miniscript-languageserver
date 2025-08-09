import {
  ASTFeatureImportExpression,
  ASTType as ASTTypeExtended
} from 'greybel-core';
import { isFunctionType, isUnionType } from 'greybel-type-analyzer';
import {
  SignatureDefinitionBaseType,
  SignatureDefinitionTypeMeta
} from 'meta-utils';
import path from 'path';
import type { Hover, HoverParams } from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';

import { LookupASTResult, LookupHelper } from '../helper/lookup-type';
import { MarkdownString } from '../helper/markdown-string';
import {
  createHover,
  createTypeBody,
  formatKind,
  formatTypes
} from '../helper/tooltip';
import { IContext, LanguageId } from '../types';
import { DocumentURIBuilder } from '../helper/document-manager/document-uri-builder';

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

    const activeDocument = context.documentManager.get(document);
    const helper = new LookupHelper(activeDocument, context);
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

    if (
      isFunctionType(entity.item) ||
      (isUnionType(entity.item) && entity.item.variants.some(isFunctionType))
    ) {
      return createHover(entity);
    }

    const hoverText = new MarkdownString('');
    const metaTypes = entity.item
      .toMeta()
      .map(SignatureDefinitionTypeMeta.parse);
    const displayName = entity.value
      ? entity.value
      : entity.path;
    let label = `(${formatKind(entity.completionItemKind)}) ${displayName}: ${formatTypes(metaTypes)}`;
    const labelBody = createTypeBody(entity.item);

    if (labelBody) {
      label += ` ${JSON.stringify(labelBody, null, 2)}`;
    }

    hoverText.appendCodeblock(LanguageId, label);

    return {
      contents: hoverText.toString()
    };
  });
}
