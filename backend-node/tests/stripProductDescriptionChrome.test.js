import { describe, it, expect } from 'vitest';
import { stripProductDescriptionChrome } from '../src/lib/stripProductDescriptionChrome.js';

const SAMPLE = `<p>Great keto bar.</p>
<h3><b>How to Use:</b></h3>
<ul><li><p>Enjoy as snack.</p></li></ul>
</div></div></div></main></div><footer class="wd-footer footer-container"><div class="main-footer">
<link rel="stylesheet" href="elementor-post-129543.css">
<div class="elementor elementor-129543"><section class="wd-negative-gap">
Selling premium Fitness & Health products all over Egypt since 2018
Top Categories Healthy Crocieries USEFUL LINKS Privacy Policy
</section></div></footer>`;

describe('stripProductDescriptionChrome', () => {
  it('removes footer and site chrome after product content', () => {
    const out = stripProductDescriptionChrome(SAMPLE);
    expect(out).toContain('Great keto bar');
    expect(out).toContain('How to Use');
    expect(out).not.toMatch(/wd-footer/i);
    expect(out).not.toMatch(/Selling premium Fitness/i);
    expect(out).not.toMatch(/USEFUL LINKS/i);
  });
});
