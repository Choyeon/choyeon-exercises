/**
 * Lightweight React Native renderer for tests.
 *
 * The bleeding-edge RN 0.86 + React 19 stack makes @testing-library/react-native
 * 14 (which relies on the legacy `TestRenderer.create` API) fail silently, so we
 * render with `test-renderer`'s `createRoot` + React `act` and expose a small set
 * of tree-traversal queries. This is fully controlled and dependency-light.
 */
import React from 'react';
import TestRenderer from 'test-renderer';
import { act } from 'react';

type HostNode = {
  type: string;
  props: Record<string, any>;
  children?: Array<HostNode | string>;
};

function isNode(x: any): x is HostNode {
  return x && typeof x === 'object' && typeof x.type === 'string';
}

function collectText(node: HostNode | string | undefined): string {
  if (node == null) return '';
  if (typeof node === 'string') return node;
  if (!isNode(node)) return '';
  const parts = (node.children || []).map(collectText);
  return parts.join('');
}

function walk(node: HostNode | string | undefined, cb: (n: HostNode) => void) {
  if (node == null || typeof node === 'string') return;
  if (!isNode(node)) return;
  cb(node);
  (node.children || []).forEach((c) => walk(c, cb));
}

export interface RenderResult {
  getByText: (t: string) => HostNode;
  getAllByText: (t: string) => HostNode[];
  queryByText: (t: string) => HostNode | null;
  getByType: (type: string) => HostNode;
  getAllByType: (type: string) => HostNode[];
  queryByType: (type: string) => HostNode | null;
  getByProps: (pred: (p: Record<string, any>) => boolean) => HostNode;
  getAllByProps: (pred: (p: Record<string, any>) => boolean) => HostNode[];
  queryByProps: (pred: (p: Record<string, any>) => boolean) => HostNode | null;
  getByTestId: (id: string) => HostNode;
  queryByTestId: (id: string) => HostNode | null;
  /** Find a node by accessibilityLabel. */
  getByLabelText: (label: string) => HostNode;
  queryByLabelText: (label: string) => HostNode | null;
  /** Find a node by accessibilityRole. */
  getByRole: (role: string) => HostNode;
  queryByRole: (role: string) => HostNode | null;
  /** all host nodes flattened */
  getAll: () => HostNode[];
  unmount: () => void;
}

export function render(element: React.ReactElement): RenderResult {
  const root: any = (TestRenderer as any).createRoot();
  act(() => {
    root.render(element);
  });
  const tree: HostNode = root.container as HostNode;

  const getAll = () => {
    const out: HostNode[] = [];
    walk(tree, (n) => out.push(n));
    return out;
  };

  const norm = (t: string) => t.trim();
  const findByText = (t: string, all: boolean) => {
    const target = norm(t);
    const found: HostNode[] = [];
    walk(tree, (n) => {
      if (norm(collectText(n)) === target || norm(collectText(n)).includes(target)) {
        found.push(n);
      }
    });
    if (all) return found;
    if (found.length === 0) throw new Error(`Unable to find node with text "${t}"`);
    return found[0];
  };

  const findByType = (type: string, all: boolean) => {
    const found = getAll().filter((n) => n.type === type);
    if (all) return found;
    if (found.length === 0) throw new Error(`Unable to find node with type "${type}"`);
    return found[0];
  };

  const findByProps = (pred: (p: Record<string, any>) => boolean, all: boolean) => {
    const found = getAll().filter((n) => pred(n.props || {}));
    if (all) return found;
    if (found.length === 0) throw new Error('Unable to find node matching props predicate');
    return found[0];
  };

  return {
    getByText: (t) => findByText(t, false) as HostNode,
    getAllByText: (t) => findByText(t, true),
    queryByText: (t) => (findByText(t, true)[0] ?? null),
    getByType: (type) => findByType(type, false) as HostNode,
    getAllByType: (type) => findByType(type, true),
    queryByType: (type) => findByType(type, true)[0] ?? null,
    getByProps: (pred) => findByProps(pred, false) as HostNode,
    getAllByProps: (pred) => findByProps(pred, true),
    queryByProps: (pred) => findByProps(pred, true)[0] ?? null,
    getByTestId: (id) => findByProps((p) => p.testID === id, false) as HostNode,
    queryByTestId: (id) => findByProps((p) => p.testID === id, true)[0] ?? null,
    getByLabelText: (label) =>
      findByProps((p) => p.accessibilityLabel === label, false) as HostNode,
    queryByLabelText: (label) =>
      findByProps((p) => p.accessibilityLabel === label, true)[0] ?? null,
    getByRole: (role) => findByProps((p) => p.accessibilityRole === role, false) as HostNode,
    queryByRole: (role) =>
      findByProps((p) => p.accessibilityRole === role, true)[0] ?? null,
    getAll,
    unmount: () => act(() => root.unmount()),
  };
}
