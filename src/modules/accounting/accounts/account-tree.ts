import { ChartAccount, AccountTreeNode } from './types'

/**
 * Converte uma lista flat de contas contábeis em uma estrutura de árvore hierárquica
 * utilizando as referências de parent_id.
 */
export function buildAccountTree(accounts: ChartAccount[]): AccountTreeNode[] {
  const accountMap = new Map<string, AccountTreeNode>()
  const roots: AccountTreeNode[] = []

  // Inicializa os nós da árvore
  accounts.forEach((acc) => {
    accountMap.set(acc.id, { ...acc, children: [] })
  })

  // Monta a hierarquia
  accounts.forEach((acc) => {
    const node = accountMap.get(acc.id)!
    if (acc.parent_id && accountMap.has(acc.parent_id)) {
      const parentNode = accountMap.get(acc.parent_id)!
      parentNode.children.push(node)
    } else {
      roots.push(node)
    }
  })

  // Ordena os filhos de cada nó recursivamente pelo código da conta
  const sortTree = (nodes: AccountTreeNode[]) => {
    nodes.sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }))
    nodes.forEach((n) => sortTree(n.children))
  }

  sortTree(roots)
  return roots
}

/**
 * Converte a árvore de volta para uma lista flat mantendo a ordem correta de travessia (Pre-order traversal).
 * Isso garante que as contas filhas fiquem aninhadas logo abaixo das contas pai.
 */
export function flattenAccountTree(nodes: AccountTreeNode[]): AccountTreeNode[] {
  const result: AccountTreeNode[] = []
  
  const traverse = (node: AccountTreeNode) => {
    result.push(node)
    node.children.forEach(traverse)
  }

  nodes.forEach(traverse)
  return result
}
