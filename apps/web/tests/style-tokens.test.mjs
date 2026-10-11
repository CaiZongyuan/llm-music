import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';

const source = new URL('../src/', import.meta.url);
async function styles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return (await Promise.all(entries.map(async entry => {
    const url = new URL(entry.name + (entry.isDirectory() ? '/' : ''), directory);
    return entry.isDirectory() ? styles(url) : entry.name.endsWith('.css') ? [{ url, css: await readFile(url, 'utf8') }] : [];
  }))).flat();
}
const files = await styles(source);
const global = files.find(file => file.url.href === new URL('styles.css', source).href);
assert.ok(global, 'Global stylesheet exists');
const root = /^:root\s*\{([^}]+)\}/.exec(global.css);
assert.ok(root, 'The global root owns all tokens');
const definitions = [...root[1].matchAll(/(--[\w-]+)\s*:\s*([^;\n]+)/g)];
const tokens = new Map(definitions.map(([, name, value]) => [name, value.trim()]));

test('Acid Hardware exposes the confirmed palette and shared typography/control tokens', () => {
  const expected = {
    '--bg': '#050505', '--panel': '#101010', '--panel2': '#161616', '--line': '#232923', '--line2': '#39413a',
    '--text': '#eefff0', '--muted': '#7d8a7d', '--faint': '#4a544b', '--acc': '#e1f607', '--acc-ink': '#050505',
    '--err': '#ff4d3d', '--warn': '#ffb800', '--radius': '3px', '--focus-width': '2px',
  };
  for (const [name, value] of Object.entries(expected)) assert.equal(tokens.get(name), value, name);
  for (const name of ['--sans', '--mono', '--disp']) assert.ok(tokens.get(name), name);
  assert.equal(tokens.size, definitions.length, 'Tokens must have a single definition');
  for (const name of ['--surface', '--soft', '--accent', '--accent-text', '--error']) assert.ok(!tokens.has(name), `Retired alias ${name}`);
});

test('Every stylesheet variable resolves in the single global token layer', () => {
  for (const { url, css } of files) {
    for (const [, name] of css.matchAll(/var\(\s*(--[\w-]+)/g)) assert.ok(tokens.has(name), `${url.pathname}: undefined ${name}`);
    const outside = url === global.url ? css.replace(root[0], '') : css;
    assert.doesNotMatch(outside, /--[\w-]+\s*:/, `${url.pathname}: token defined outside root`);
  }
});

// CSS named colors are literals too. transparent/currentColor intentionally remain allowed.
const namedColors = new Set(`aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue blueviolet brown burlywood cadetblue chartreuse chocolate coral cornflowerblue cornsilk crimson cyan darkblue darkcyan darkgoldenrod darkgray darkgreen darkgrey darkkhaki darkmagenta darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen darkslateblue darkslategray darkslategrey darkturquoise darkviolet deeppink deepskyblue dimgray dimgrey dodgerblue firebrick floralwhite forestgreen fuchsia gainsboro ghostwhite gold goldenrod gray green greenyellow grey honeydew hotpink indianred indigo ivory khaki lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan lightgoldenrodyellow lightgray lightgreen lightgrey lightpink lightsalmon lightseagreen lightskyblue lightslategray lightslategrey lightsteelblue lightyellow lime limegreen linen magenta maroon mediumaquamarine mediumblue mediumorchid mediumpurple mediumseagreen mediumslateblue mediumspringgreen mediumturquoise mediumvioletred midnightblue mintcream mistyrose moccasin navajowhite navy oldlace olive olivedrab orange orangered orchid palegoldenrod palegreen paleturquoise palevioletred papayawhip peachpuff peru pink plum powderblue purple rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown seagreen seashell sienna silver skyblue slateblue slategray slategrey snow springgreen steelblue tan teal thistle tomato turquoise violet wheat white whitesmoke yellow yellowgreen`.split(' '));
test('Colors, font stacks, focus widths and radii stay in the token layer', () => {
  for (const { url, css } of files) {
    const outside = (url === global.url ? css.replace(root[0], '') : css).replace(/\/\*[\s\S]*?\*\//g, '');
    assert.doesNotMatch(outside, /#[\da-f]{3,8}\b|\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\s*\(/i, `${url.pathname}: color literal`);
    for (const [, value] of outside.matchAll(/(?:^|[;{])\s*[\w-]+\s*:\s*([^;}]+)/g)) {
      const words = value.replace(/--[\w-]+/g, '').match(/[a-z]+/gi) ?? [];
      for (const word of words) assert.ok(!namedColors.has(word.toLowerCase()), `${url.pathname}: named color ${word}`);
    }
    assert.doesNotMatch(outside, /font(?:-family)?\s*:[^;}]*["']|border-radius\s*:\s*\d|outline\s*:\s*\d/i, `${url.pathname}: untokenized typography/control`);
  }
});
