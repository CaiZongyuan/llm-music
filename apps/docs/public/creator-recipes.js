// Documentation-only input examples. No HTTP, Runtime, generation, or save calls.
class MusicInputRecipes extends HTMLElement {
  connectedCallback() {
    const source = this.querySelector('pre code');
    if (!source) return;
    const baseline = JSON.parse(source.textContent);
    const output = document.createElement('pre');
    const code = document.createElement('code');
    output.append(code);
    source.closest('.expressive-code').replaceWith(output);
    const description = this.querySelector('[data-recipe-description]');
    const status = this.querySelector('[data-recipe-status]');
    const facts = this.querySelector('[data-recipe-facts]');
    const copyStatus = this.querySelector('[data-copy-status]');
    const buttons = [...this.querySelectorAll('[data-recipe]')];
    let inputs = { ...baseline };
    const choose = (button) => {
      inputs = { ...baseline };
      if (button.dataset.recipe === 'style') inputs.style = button.dataset.value;
      if (button.dataset.recipe === 'lyrics') inputs.lyrics = inputs.lyrics.replace('Morning gathers on the window', button.dataset.value);
      if (button.dataset.recipe === 'seed') inputs.seed = Number(button.dataset.value);
      for (const option of buttons) option.setAttribute('aria-pressed', String(option === button));
      description.textContent = button.dataset.note;
      status.textContent = button.dataset.recipe === 'baseline' ? this.dataset.verified : this.dataset.inspiration;
      facts.textContent = `${this.dataset.styleLabel}: ${inputs.style} · Seed: ${inputs.seed}`;
      code.textContent = JSON.stringify(inputs, null, 2);
      copyStatus.textContent = '';
    };
    choose(buttons[0]);
    this.addEventListener('click', async (event) => {
      const button = event.target.closest('[data-recipe]');
      if (button) choose(button);
      if (event.target.closest('[data-copy-recipe]')) {
        try {
          await navigator.clipboard.writeText(JSON.stringify(inputs, null, 2));
          copyStatus.textContent = this.dataset.copied;
        } catch {
          copyStatus.textContent = this.dataset.copyFailed;
        }
      }
    });
  }
}
customElements.define('music-input-recipes', MusicInputRecipes);
