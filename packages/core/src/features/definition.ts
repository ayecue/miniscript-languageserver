import { TypeSource } from 'greybel-type-analyzer';
import {
  ASTBase,
  ASTMemberExpression,
  ASTForGenericStatement,
  ASTType
} from 'miniscript-core';
import type {
  DefinitionLink,
  DefinitionParams,
  Position
} from 'vscode-languageserver';

import { LookupHelper } from '../helper/lookup-type';
import { IContext } from '../types';

const definitionLinkToString = (link: DefinitionLink): string => {
  return `${link.targetUri}:${link.targetRange.start.line}:${link.targetRange.start.character}-${link.targetRange.end.line}:${link.targetRange.end.character}`;
};

const getLocation = (item: TypeSource): DefinitionLink => {
  const node = item.astRef;
  let start: Position;
  let end: Position;
  switch (node.type) {
    case ASTType.ForGenericStatement: {
      const stmt = node as ASTForGenericStatement;
      start = {
        line: stmt.variable.start.line - 1,
        character: stmt.variable.start.character - 1
      };
      end = {
        line: stmt.variable.end.line - 1,
        character: stmt.variable.end.character - 1
      };
      break;
    }
    default: {
      start = {
        line: node.start.line - 1,
        character: node.start.character - 1
      };
      end = {
        line: node.end.line - 1,
        character: node.end.character - 1
      };
    }
  }
  return {
    targetUri: item.document,
    targetRange: { start, end },
    targetSelectionRange: { start, end }
  };
};

const findAllDefinitions = async (
  helper: LookupHelper,
  item: ASTBase
): Promise<DefinitionLink[]> => {
  const result = await helper.findAllAssignmentsOfItem(item);
  const sources = result?.getSource();

  if (sources == null || sources.length === 0) {
    return [];
  }

  const definitions: DefinitionLink[] = [];
  const visited = new Set<string>();

  for (const source of sources) {
    const node = source.astRef;

    if (!node.start || !node.end) {
      continue;
    }

    const definitionLink = getLocation(source);
    const linkString = definitionLinkToString(definitionLink);

    if (visited.has(linkString)) {
      continue;
    }

    visited.add(linkString);
    definitions.push(definitionLink);
  }

  return definitions;
};

export function activate(context: IContext) {
  context.connection.onDefinition(async (params: DefinitionParams) => {
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

    const { outer, closest } = astResult;

    const previous = outer.length > 0 ? outer[outer.length - 1] : undefined;
    let target: ASTBase = closest;

    if (previous) {
      if (
        previous instanceof ASTMemberExpression &&
        previous.identifier === closest
      ) {
        target = previous;
      }
    }

    return await findAllDefinitions(helper, target);
  });
}
