import {
  Document as TypeDocument,
  TypeManager
} from 'greybel-type-analyzer';

import {
  DependencyType,
  IActiveDocument,
  IActiveDocumentImportGraphNode,
  IDependencyLocation
} from '../types';
import { miniscriptMeta } from 'miniscript-meta';

export type ImportWithNamespace = {
  namespace: string;
  typeDoc: TypeDocument;
};

const typeManager = new TypeManager({
  container: miniscriptMeta
});

export default typeManager;

export function aggregateImportsWithNamespaceFromLocations(
  dependencyLocation: IDependencyLocation[],
  refs: Map<string, IActiveDocument | null>
): ImportWithNamespace[] {
  const result: ImportWithNamespace[] = [];

  if (dependencyLocation == null) {
    return result;
  }

  dependencyLocation.forEach((importDef) => {
    const namespace = importDef.args[0];
    if (namespace == null) return;
    const itemTypeDoc = refs.get(importDef.location)?.typeDocument;
    if (itemTypeDoc == null) return;
    result.push({
      namespace,
      typeDoc: itemTypeDoc
    });
  });

  return result;
}

export function aggregateImportsWithNamespaceFromGraph(
  node: IActiveDocumentImportGraphNode,
  refs: Map<string, TypeDocument | null>
): ImportWithNamespace[] {
  const result: ImportWithNamespace[] = [];

  if (node == null) {
    return result;
  }

  const importUris = node.children
    .filter((child) => child.item.location.type === DependencyType.Import)
    .map((child) => child.item.location);

  importUris.forEach((importDef) => {
    const namespace = importDef.args[0];
    if (namespace == null) return;
    const itemTypeDoc = refs.get(importDef.location);
    if (itemTypeDoc == null) return;
    result.push({
      namespace,
      typeDoc: itemTypeDoc
    });
  });

  return result;
}