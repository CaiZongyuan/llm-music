import { visit } from 'unist-util-visit';

export default function headingIds() {
  return tree => visit(tree, 'heading', node => {
    const last = node.children.at(-1);
    if (last?.type !== 'text') return;
    const marker = /\s+\{#([a-z][a-z0-9-]*)\}$/.exec(last.value);
    if (!marker) return;
    last.value = last.value.slice(0, marker.index);
    node.data = { ...node.data, hProperties: { ...node.data?.hProperties, id: marker[1] } };
  });
}
