import { ASTBase, ASTCallExpression, ASTType } from 'miniscript-core';
import type { SignatureHelp, SignatureHelpParams } from 'vscode-languageserver';
import { isFunctionType, isUnionType } from 'greybel-type-analyzer';

import { LookupASTResult, LookupHelper } from '../helper/lookup-type';
import { createSignatureInfo } from '../helper/tooltip';
import { IContext } from '../types';

const getClosestCallExpression = (
  astResult: LookupASTResult
): ASTCallExpression | null => {
  if (astResult.closest.type === ASTType.CallExpression) {
    return astResult.closest as ASTCallExpression;
  }

  for (let index = astResult.outer.length - 1; index >= 0; index--) {
    const current = astResult.outer[index];

    if (current.type === ASTType.CallExpression) {
      return current as ASTCallExpression;
    }
  }

  return null;
};

export function activate(context: IContext) {
  context.connection.onSignatureHelp(async (params: SignatureHelpParams) => {
    if (!context.getConfiguration().autocomplete) {
      return;
    }

    const document = await context.fs.getTextDocument(params.textDocument.uri);

    if (document == null) {
      return;
    }

    const activeDocument = await context.documentManager.getLatest(document);
    const helper = new LookupHelper(activeDocument, context);
    const astResult = await helper.lookupAST(params.position);

    if (!astResult) {
      return;
    }

    // filter out root call expression for signature
    const { closest } = astResult;
    const closestCallExpr = getClosestCallExpression(astResult);

    if (closestCallExpr === null) {
      return;
    }

    const entity = await helper.lookupTypeInfo({
      closest: closestCallExpr.base,
      outer: closest.scope ? [closest.scope] : []
    });

    if (
      !entity ||
      (!isFunctionType(entity.item) &&
        (!isUnionType(entity.item) ||
          !entity.item.variants.some(isFunctionType)))
    ) {
      return;
    }

    // figure out argument position
    const astArgs = closestCallExpr.arguments;
    const selectedIndex = astArgs.findIndex((argItem: ASTBase) => {
      const leftIndex = argItem.start!.character - 1;
      const rightIndex = argItem.end!.character;

      return (
        leftIndex <= params.position.character &&
        rightIndex >= params.position.character
      );
    });

    const signatureHelp: SignatureHelp = {
      activeParameter: selectedIndex === -1 ? 0 : selectedIndex,
      signatures: [],
      activeSignature: 0
    };

    signatureHelp.signatures.push(...createSignatureInfo(entity));

    return signatureHelp;
  });
}
